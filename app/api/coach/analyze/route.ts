import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { coachSystem, parseCoachCustomer, type CoachCustomer } from "@/lib/ai/prompt";

import {
  analysePressure,
  bandFor,
  type FindingKind,
  type PressureReport,
  type PressureSpan,
} from "@/lib/engines/pressure";

/**
 * The deeper pass over a draft message.
 *
 * The local lexicon runs in the browser on every keystroke; this adds what a
 * word list cannot see — tone, implication, and a sentence that is hostile
 * without containing a single flagged word.
 *
 * Design note: the model is never asked for character offsets, because models
 * are unreliable at counting characters. It returns the exact phrases it
 * objects to, and the server locates them in the text. That keeps the
 * highlighting correct even when the model's own idea of position is wrong.
 */

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
  "shouting",
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

export async function GET() {
  // Lets the client show which engines are live without exposing anything.
  return Response.json({ claude: Boolean(process.env.ANTHROPIC_API_KEY) });
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "not_configured" }, { status: 503 });
  }

  let text: string;
  let locked: string[] = [];
  let customer: CoachCustomer = parseCoachCustomer(null);
  try {
    const body = (await request.json()) as { text?: unknown; locked?: unknown; customer?: unknown };
    customer = parseCoachCustomer(body.customer);
    if (typeof body.text !== "string" || !body.text.trim()) {
      return Response.json({ error: "bad_request" }, { status: 400 });
    }
    text = body.text.slice(0, 2000);
    if (Array.isArray(body.locked)) {
      locked = body.locked
        .filter((x): x is string => typeof x === "string")
        .slice(0, 4)
        .map((x) => x.slice(0, 300));
    }
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const client = new Anthropic();

  try {
    const response = await client.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 2000,
      system: coachSystem(customer),
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

    const parsed = response.parsed_output;
    if (!parsed) {
      return Response.json({ error: "unparsed" }, { status: 502 });
    }

    return Response.json({ report: merge(text, parsed, locked) });
  } catch (error) {
    // Most specific first. Every branch leaves the client on the local engine.
    if (error instanceof Anthropic.BadRequestError) {
      return Response.json({ error: "bad_request" }, { status: 400 });
    }
    if (error instanceof Anthropic.AuthenticationError) {
      return Response.json({ error: "auth" }, { status: 503 });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return Response.json({ error: "rate_limited" }, { status: 429 });
    }
    if (error instanceof Anthropic.APIError) {
      return Response.json({ error: "upstream" }, { status: 502 });
    }
    return Response.json({ error: "unknown" }, { status: 500 });
  }
}

/**
 * Combine Claude's judgement with the local structural analysis.
 *
 * Claude owns the score — it sees context the lexicon cannot. The spans are
 * the union of both, so a phrase the word list already caught stays
 * highlighted even if the model did not mention it, and readability stays
 * locally computed because it is arithmetic, not judgement.
 */
function merge(
  text: string,
  parsed: z.infer<typeof AnalysisSchema>,
  locked: string[],
): PressureReport {
  const local = analysePressure(text, { locked });
  const spans: PressureSpan[] = [...local.spans];

  for (const finding of parsed.findings) {
    const index = text.indexOf(finding.phrase);
    if (index === -1) continue; // Model quoted something not in the text.
    const overlaps = spans.some(
      (s) => index < s.end && index + finding.phrase.length > s.start,
    );
    if (overlaps) continue;
    spans.push({
      start: index,
      end: index + finding.phrase.length,
      kind: finding.kind as FindingKind,
      text: finding.phrase,
      why: finding.why,
    });
  }

  spans.sort((a, b) => a.start - b.start);

  const score = Math.max(0, Math.min(100, Math.round(parsed.score)));

  return {
    score,
    band: bandFor(score),
    spans,
    findings: local.findings,
    readability: local.readability,
    source: "claude",
  };
}
