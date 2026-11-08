import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { coachSystem } from "../prompt";
import type {
  AdvocateDraft,
  AiProvider,
  AnalyseInput,
  AnalysisDraft,
  ExplainDraft,
  ExplainInput,
  RewriteInput,
  ScriptDraft,
  ScriptInput,
} from "../provider";
import type { AdvocateFacts } from "@/lib/advocate";

/**
 * Claude, behind the provider seam.
 *
 * Every call here follows the same five rules, which is why they all read
 * alike:
 *
 *  · structured output via `zodOutputFormat` wherever the result has a shape,
 *    so a malformed answer is a parse failure rather than a rendering bug;
 *  · `effort: "low"` on the paths a person is waiting through, higher only
 *    where the writing quality is the point;
 *  · a cached system prefix, because it is identical on every call in a
 *    session and the volatile part lives in the user turn;
 *  · `stop_reason === "refusal"` checked before the content is read;
 *  · every failure — refusal, rate limit, parse, network — returns `null`,
 *    because the caller already has a deterministic answer in hand.
 */

const MODEL = "claude-opus-5-5";

/*
  One client for the process rather than one per request, so connections are
  reused. It reads ANTHROPIC_API_KEY from the environment itself.
*/
let client: Anthropic | null = null;
function sdk(): Anthropic {
  client ??= new Anthropic();
  return client;
}

/**
 * Mark the system prompt cacheable.
 *
 * It is byte-identical for every call in a session while the draft in the
 * user turn changes on each one, which is exactly the shape prompt caching
 * wants. Whether it actually caches depends on the prefix clearing the
 * model's minimum cacheable length; below that the API silently declines and
 * the call costs what it did before, so this is free to ask for either way.
 */
function cachedSystem(text: string) {
  return [
    { type: "text" as const, text, cache_control: { type: "ephemeral" as const } },
  ];
}

/** Everything the SDK can throw is the same to a caller: no answer. */
function swallow(error: unknown): null {
  if (error instanceof Anthropic.APIError) return null;
  return null;
}

/* ------------------------------------------------------------ schemas ---- */

const KINDS = [
  "urgency",
  "shame",
  "threat",
  "jargon",
  "long-sentence",
  "grade",
  "multiple-asks",
  "passive",
  "consequence",
  "abuse",
] as const;

const AnalysisSchema = z.object({
  score: z
    .number()
    .describe(
      "0-100. How likely this message is to make the customer disengage. 0 is safe to send, 65+ would plausibly cause another silence.",
    ),
  findings: z
    .array(
      z.object({
        kind: z.enum(KINDS),
        phrase: z
          .string()
          .describe("The exact substring from the message, copied character for character."),
        why: z.string().describe("One sentence an agent can act on."),
      }),
    )
    .describe("Only phrases genuinely present in the message. Empty if it is fine."),
});

const DraftSchema = z.object({
  message: z
    .string()
    .describe("The request, first person, as the customer would send it. Under 70 words."),
  summary: z
    .string()
    .describe("One neutral line for the support team, third person, under 25 words."),
});

const ExplainSchema = z.object({
  headline: z
    .string()
    .describe("One short sentence answering 'what is this?'. Under 12 words."),
  plainWords: z
    .array(z.string())
    .describe("Two or three short lines explaining it. Each must stand alone."),
  whatYouCouldDo: z
    .array(z.string())
    .describe("Options the customer could take. Empty if there is genuinely nothing to do."),
});

const ScriptSchema = z.object({
  situation: z.string().describe("One line naming the situation the agent is in."),
  opener: z.string().describe("Word-for-word opening line. Under 35 words."),
  lines: z.array(z.string()).describe("Two to four supporting lines, in order."),
  avoid: z
    .array(z.object({ phrase: z.string(), why: z.string() }))
    .describe("Two or three phrasings to stay away from, each with the reason."),
  nextStep: z.string().describe("The single next action for the agent."),
});

/* ----------------------------------------------------------- provider ---- */

export const claudeProvider: AiProvider = {
  name: "Claude",

  available() {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  },

  async analysePressure({ text, locked, customer }: AnalyseInput): Promise<AnalysisDraft | null> {
    try {
      const response = await sdk().messages.parse({
        model: MODEL,
        max_tokens: 2000,
        system: cachedSystem(coachSystem(customer)),
        thinking: { type: "adaptive" },
        // Latency matters here: this runs while the agent pauses mid-sentence.
        output_config: { effort: "low", format: zodOutputFormat(AnalysisSchema) },
        messages: [
          {
            role: "user",
            content: `Score this draft message and list the exact phrases that do the damage.${
              locked.length
                ? `\n\nThese sentences are required compliance wording. Do not score or flag them:\n${locked.map((l) => `- ${l}`).join("\n")}`
                : ""
            }\n\n---\n${text}\n---`,
          },
        ],
      });
      if (response.stop_reason === "refusal" || !response.parsed_output) return null;
      return response.parsed_output as AnalysisDraft;
    } catch (error) {
      return swallow(error);
    }
  },

  async rewrite(input: RewriteInput): Promise<string | null> {
    const { text, amount, agentName, firstName, payBy, locked, tone, goodNews, customer } = input;
    try {
      const response = await sdk().messages.create({
        model: MODEL,
        max_tokens: 1200,
        system: cachedSystem(coachSystem(customer)),
        thinking: { type: "adaptive" },
        output_config: { effort: "low" },
        messages: [
          {
            role: "user",
            content: `Rewrite this draft so ${firstName ?? "the customer"} can act on it.

Rules:
- Keep every factual claim true. The amount owed is ${amount ?? "the minimum payment"}; do not change it, and do not imply nothing is owed.
- Remove every insult, swear word or contemptuous phrase completely — never soften or paraphrase it.
- Tone: ${
              tone === "warm"
                ? "warm — a friendly greeting by first name and one kind closing line, still adult and plain."
                : tone === "celebrate" && goodNews
                  ? "celebratory — lead with the good news, short and genuine."
                  : "calm — plain, steady, no flourishes."
            }${tone === "celebrate" && !goodNews ? " (Celebrate was picked, but there is no good news yet, so write it warm instead.)" : ""}
- Remove threats, escalation, blame, manufactured urgency and vague consequences ("consequences", "further action", "to avoid collections"). No collections vocabulary.
- A real consequence is information, not a threat. If the draft states or implies one (for example, credit reporting), keep it: say it once, calmly, with the date${payBy ? ` — "Paying it by ${payBy} should keep it off your credit file."` : ""}. Never invent a consequence and never delete a real one.${
              locked.length
                ? `\n- This wording will be appended verbatim after your message. Do not repeat it, paraphrase it, or contradict it:\n${locked.map((l) => `  - ${l}`).join("\n")}`
                : ""
            }
- UK English and UK terms: pounds, "credit file", "credit reference agencies".
- Short sentences. Plain English, Flesch–Kincaid grade 8 or below.
- Exactly one thing to do, and say it plainly.
- Warm, adult, not saccharine. ${agentName ? `You are ${agentName}.` : ""}
- Under 60 words.

Reply with the rewritten message and nothing else — no preamble, no quotes, no explanation.

---
${text}
---`,
          },
        ],
      });

      if (response.stop_reason === "refusal") return null;

      const out = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("")
        .trim();
      return out || null;
    } catch (error) {
      return swallow(error);
    }
  },

  async draftAdvocate(facts: AdvocateFacts): Promise<AdvocateDraft | null> {
    try {
      const response = await sdk().messages.parse({
        model: MODEL,
        max_tokens: 1200,
        thinking: { type: "adaptive" },
        output_config: { effort: "low", format: zodOutputFormat(DraftSchema) },
        system: cachedSystem(
          `You help a Capital One UK customer write a short support request about one payment. UK English. Use only the facts given — never add reasons, feelings, health information, or anything the customer did not choose. Do not ask for a specific concession unless the facts say so. Plain, calm, adult. No apology, no grovelling.`,
        ),
        messages: [
          {
            role: "user",
            content: `Facts the customer chose to share:\n${JSON.stringify(facts, null, 2)}\n\nWrite the request and the one-line summary.`,
          },
        ],
      });
      if (response.stop_reason === "refusal" || !response.parsed_output) return null;
      return response.parsed_output as AdvocateDraft;
    } catch (error) {
      return swallow(error);
    }
  },

  async explain({ subject, facts, firstName }: ExplainInput): Promise<ExplainDraft | null> {
    try {
      const response = await sdk().messages.parse({
        model: MODEL,
        max_tokens: 1200,
        thinking: { type: "adaptive" },
        output_config: { effort: "low", format: zodOutputFormat(ExplainSchema) },
        system: cachedSystem(
          `You explain one thing on a Capital One UK customer's banking screen, to the customer, in plain words. UK English, pounds.

Hard rules:
- Use only the figures and dates given. Never estimate, never infer, never add a number that is not in the facts.
- Never tell them what they ought to do, and never imply urgency. Options are offered, not prescribed.
- Never mention credit scores, arrears consequences or collections unless a fact given says so.
- No reassurance you cannot back up ("don't worry", "it'll be fine").
- Short sentences. One idea per line. Flesch–Kincaid grade 8 or below — this is checked after you answer, and anything above it is discarded.
- Say "you" and "your". Never refer to the customer in the third person.
- No greeting, no sign-off, no preamble.`,
        ),
        messages: [
          {
            role: "user",
            content: `${firstName} tapped "what does this mean?" on: ${subject}

The facts on their screen right now:
${facts.map((f) => `- ${f.label}: ${f.value}`).join("\n")}

Explain it.`,
          },
        ],
      });
      if (response.stop_reason === "refusal" || !response.parsed_output) return null;
      return response.parsed_output as ExplainDraft;
    } catch (error) {
      return swallow(error);
    }
  },

  async agentScript({ situation, firstName, facts, preferences }: ScriptInput): Promise<ScriptDraft | null> {
    try {
      const response = await sdk().messages.parse({
        model: MODEL,
        max_tokens: 2000,
        thinking: { type: "adaptive" },
        // The writing itself is the deliverable here, so this one thinks harder
        // than the keystroke path does.
        output_config: { effort: "medium", format: zodOutputFormat(ScriptSchema) },
        system: cachedSystem(
          `You write what a Capital One UK support agent should say to one customer, right now, about one overdue credit card payment. UK English.

The rules are the product, not decoration:
- Short sentences. One instruction at a time. No collections vocabulary.
- No urgency, no deadlines framed as pressure, no counting previous contact attempts, no blame.
- Never lead with a concession. A fee refund or an arrangement is the bank's decision under its own policy, and the agent cannot promise one.
- A real consequence is information: state it once, calmly, with its date. Never remove it — leaving it out would mislead — and never use it as leverage.
- The "avoid" list is the most useful part. Give phrasings an agent would plausibly reach for, and say in one line what each one does to the person hearing it.
- Everything you write will be scored by the same pressure model that scores the agent's own messages, and discarded if it scores badly.`,
        ),
        messages: [
          {
            role: "user",
            content: `Situation: ${situation}

Customer: ${firstName}
${facts.map((f) => `- ${f.label}: ${f.value}`).join("\n")}
${
              preferences.length
                ? `\n${firstName} chose to share these preferences with support (preferences, not a diagnosis — never ask why):\n${preferences.map((p) => `- "${p}"`).join("\n")}`
                : `\n${firstName} has not shared any preferences. Write plainly, one thing at a time — which is right for everyone.`
            }

Write the script.`,
          },
        ],
      });
      if (response.stop_reason === "refusal" || !response.parsed_output) return null;
      return response.parsed_output as ScriptDraft;
    } catch (error) {
      return swallow(error);
    }
  },
};
