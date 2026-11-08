import Anthropic from "@anthropic-ai/sdk";
import { coachSystem, parseCoachCustomer, type CoachCustomer } from "@/lib/ai/prompt";


/**
 * Rewrite a draft so it says the same true thing without applying pressure.
 *
 * The constraint that matters is that the facts survive. A rewrite that
 * quietly drops the amount, implies nothing is owed, or deletes a real
 * consequence would be a worse failure than the hostile original — and in
 * the UK, a misleading one. So the instruction separates threats (remove)
 * from a real consequence (keep, once, calmly, with the date).
 *
 * Locked compliance wording is never sent here to be rewritten. It is passed
 * only so the rewrite does not repeat or contradict it.
 */
export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "not_configured" }, { status: 503 });
  }

  let text: string;
  let context: {
    amount?: string;
    agentName?: string;
    firstName?: string;
    payBy?: string;
    locked?: string[];
    tone?: "calm" | "warm" | "celebrate";
    goodNews?: boolean;
    customer?: CoachCustomer;
  } = {};
  try {
    const body = (await request.json()) as {
      text?: unknown;
      context?: {
        amount?: unknown;
        agentName?: unknown;
        firstName?: unknown;
        payBy?: unknown;
        locked?: unknown;
        tone?: unknown;
        goodNews?: unknown;
        customer?: unknown;
      };
    };
    if (typeof body.text !== "string" || !body.text.trim()) {
      return Response.json({ error: "bad_request" }, { status: 400 });
    }
    text = body.text.slice(0, 2000);
    const c = body.context ?? {};
    const str = (v: unknown, max: number) =>
      typeof v === "string" ? v.slice(0, max) : undefined;
    context = {
      amount: str(c.amount, 40),
      agentName: str(c.agentName, 60),
      firstName: str(c.firstName, 40),
      tone: c.tone === "warm" || c.tone === "celebrate" ? c.tone : "calm",
      goodNews: c.goodNews === true,
      customer: parseCoachCustomer(c.customer),
      payBy: str(c.payBy, 60),
      locked: Array.isArray(c.locked)
        ? c.locked.filter((x): x is string => typeof x === "string").slice(0, 4).map((x) => x.slice(0, 300))
        : [],
    };
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 1200,
      system: coachSystem(context.customer ?? parseCoachCustomer(null)),
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
      messages: [
        {
          role: "user",
          content: `Rewrite this draft so ${context.firstName ?? "the customer"} can act on it.

Rules:
- Keep every factual claim true. The amount owed is ${context.amount ?? "the minimum payment"}; do not change it, and do not imply nothing is owed.
- Remove every insult, swear word or contemptuous phrase completely — never soften or paraphrase it.
- Tone: ${
            context.tone === "warm"
              ? "warm — a friendly greeting by first name and one kind closing line, still adult and plain."
              : context.tone === "celebrate" && context.goodNews
                ? "celebratory — lead with the good news, short and genuine."
                : "calm — plain, steady, no flourishes."
          }${context.tone === "celebrate" && !context.goodNews ? " (Celebrate was picked, but there is no good news yet, so write it warm instead.)" : ""}
- Remove threats, escalation, blame, manufactured urgency and vague consequences ("consequences", "further action", "to avoid collections"). No collections vocabulary.
- A real consequence is information, not a threat. If the draft states or implies one (for example, credit reporting), keep it: say it once, calmly, with the date${context.payBy ? ` — "Paying it by ${context.payBy} should keep it off your credit file."` : ""}. Never invent a consequence and never delete a real one.${
            context.locked?.length
              ? `\n- This wording will be appended verbatim after your message. Do not repeat it, paraphrase it, or contradict it:\n${context.locked.map((l) => `  - ${l}`).join("\n")}`
              : ""
          }
- UK English and UK terms: pounds, "credit file", "credit reference agencies".
- Short sentences. Plain English, Flesch–Kincaid grade 8 or below.
- Exactly one thing to do, and say it plainly.
- Warm, adult, not saccharine. ${context.agentName ? `You are ${context.agentName}.` : ""}
- Under 60 words.

Reply with the rewritten message and nothing else — no preamble, no quotes, no explanation.

---
${text}
---`,
        },
      ],
    });

    // Safety classifiers can decline; check before reading content.
    if (response.stop_reason === "refusal") {
      return Response.json({ error: "refused" }, { status: 502 });
    }

    const out = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    if (!out) return Response.json({ error: "empty" }, { status: 502 });

    return Response.json({ text: out });
  } catch (error) {
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
