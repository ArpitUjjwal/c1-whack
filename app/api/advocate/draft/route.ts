import { z } from "zod";
import { getProvider } from "@/lib/ai/providers";

/**
 * Draft a support request in the customer's voice, from validated facts.
 *
 * The model gets the facts the customer chose, and nothing else — no
 * account history, no behaviour, nothing about how they are feeling. It
 * writes; the customer reviews, edits and sends. The client falls back to a
 * deterministic local draft on any failure, so this route is optional.
 *
 * The schema below is the gate on the way *in*. Validating here rather than
 * trusting the caller is what lets the provider treat its input as already
 * safe, and it is the only place that decides what a support request may
 * ever contain.
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

export async function POST(request: Request) {
  const provider = getProvider();
  if (!provider.available()) {
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

  const draft = await provider.draftAdvocate(facts);
  if (!draft) return Response.json({ error: "upstream" }, { status: 502 });

  return Response.json(draft);
}
