import Anthropic from "@anthropic-ai/sdk";
import { COACH_SYSTEM } from "@/lib/ai/prompt";

/**
 * Rewrite a draft so it says the same true thing without applying pressure.
 *
 * The constraint that matters is that the facts survive. A rewrite that
 * quietly drops the amount, or implies nothing is owed, would be a worse
 * failure than the hostile original — so the instruction below is explicit
 * about keeping every factual claim and changing only how it lands.
 */
export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "not_configured" }, { status: 503 });
  }

  let text: string;
  let context: { amount?: string; agentName?: string } = {};
  try {
    const body = (await request.json()) as {
      text?: unknown;
      context?: { amount?: string; agentName?: string };
    };
    if (typeof body.text !== "string" || !body.text.trim()) {
      return Response.json({ error: "bad_request" }, { status: 400 });
    }
    text = body.text.slice(0, 2000);
    context = body.context ?? {};
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 1200,
      system: COACH_SYSTEM,
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
      messages: [
        {
          role: "user",
          content: `Rewrite this draft so Alex can act on it.

Rules:
- Keep every factual claim true. The amount owed is ${context.amount ?? "the minimum payment"}; do not change it, and do not imply nothing is owed.
- No urgency, no deadline, no blame, no consequence framing, no collections vocabulary.
- Short sentences. US grade 8 or below.
- Exactly one thing to do, and say it plainly.
- Warm, adult, not saccharine. ${context.agentName ? `You are ${context.agentName}.` : ""}
- Under 55 words.

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
