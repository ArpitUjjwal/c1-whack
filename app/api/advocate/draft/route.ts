import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

/**
 * Draft a support request in the customer's voice, from validated facts.
 *
 * The model gets the facts the customer chose, and nothing else — no
 * account history, no behaviour, nothing about how they are feeling. It
 * writes; the customer reviews, edits and sends. The client falls back to a
 * deterministic local draft on any failure, so this route is optional.
 *
 * Unauthenticated, like the coaching routes: do not deploy publicly with
 * ANTHROPIC_API_KEY set.
 */

const Facts = z.object({
  firstName: z.string().max(40),
  task: z.string().max(120),
  amount: z.string().max(20),
  dueDate: z.string().max(40),
  difficulty: z.string().max(80),
  difficultySummary: z.string().max(80),
  helpWanted: z.string().max(80),
  canPay: z.string().max(60).nullable(),
  contact: z.string().max(40),
  keepRepliesShort: z.boolean(),
});

const Draft = z.object({
  message: z
    .string()
    .describe("The request, first person, as the customer would send it. Under 70 words."),
  summary: z
    .string()
    .describe("One neutral line for the support team, third person, under 25 words."),
});

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "not_configured" }, { status: 503 });
  }

  let facts: z.infer<typeof Facts>;
  try {
    const parsed = Facts.safeParse(((await request.json()) as { facts?: unknown }).facts);
    if (!parsed.success) return Response.json({ error: "bad_request" }, { status: 400 });
    facts = parsed.data;
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const client = new Anthropic();

  try {
    const response = await client.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 1200,
      thinking: { type: "adaptive" },
      output_config: { effort: "low", format: zodOutputFormat(Draft) },
      system: `You help a Capital One UK customer write a short support request about one payment. UK English. Use only the facts given — never add reasons, feelings, health information, or anything the customer did not choose. Do not ask for a specific concession unless the facts say so. Plain, calm, adult. No apology, no grovelling.`,
      messages: [
        {
          role: "user",
          content: `Facts the customer chose to share:\n${JSON.stringify(facts, null, 2)}\n\nWrite the request and the one-line summary.`,
        },
      ],
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return Response.json({ error: "unparsed" }, { status: 502 });
    }
    return Response.json(response.parsed_output);
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return Response.json({ error: "rate_limited" }, { status: 429 });
    }
    if (error instanceof Anthropic.APIError) {
      return Response.json({ error: "upstream" }, { status: 502 });
    }
    return Response.json({ error: "unknown" }, { status: 500 });
  }
}
