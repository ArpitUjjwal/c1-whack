import { getProvider } from "@/lib/ai/providers";
import { parseCoachCustomer } from "@/lib/ai/prompt";
import type { RewriteInput } from "@/lib/ai/provider";

/**
 * Rewrite a draft so it says the same true thing without applying pressure.
 *
 * The constraint that matters is that the facts survive. A rewrite that
 * quietly drops the amount, implies nothing is owed, or deletes a real
 * consequence would be a worse failure than the hostile original — and in
 * the UK, a misleading one. The instruction carrying that rule lives with the
 * provider; this route's job is to validate what reaches it.
 *
 * Locked compliance wording is never sent here to be rewritten. It is passed
 * only so the rewrite does not repeat or contradict it.
 */
export async function POST(request: Request) {
  const provider = getProvider();
  if (!provider.available()) {
    return Response.json({ error: "not_configured" }, { status: 503 });
  }

  let input: RewriteInput;
  try {
    const body = (await request.json()) as {
      text?: unknown;
      context?: Record<string, unknown>;
    };
    if (typeof body.text !== "string" || !body.text.trim()) {
      return Response.json({ error: "bad_request" }, { status: 400 });
    }
    const c = body.context ?? {};
    const str = (v: unknown, max: number) =>
      typeof v === "string" ? v.slice(0, max) : undefined;

    input = {
      text: body.text.slice(0, 2000),
      amount: str(c.amount, 40),
      agentName: str(c.agentName, 60),
      firstName: str(c.firstName, 40),
      payBy: str(c.payBy, 60),
      tone: c.tone === "warm" || c.tone === "celebrate" ? c.tone : "calm",
      goodNews: c.goodNews === true,
      customer: parseCoachCustomer(c.customer),
      locked: Array.isArray(c.locked)
        ? c.locked
            .filter((x): x is string => typeof x === "string")
            .slice(0, 4)
            .map((x) => x.slice(0, 300))
        : [],
    };
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const text = await provider.rewrite(input);
  if (!text) return Response.json({ error: "upstream" }, { status: 502 });

  return Response.json({ text });
}
