import { z } from "zod";
import { getProvider } from "@/lib/ai/providers";
import { analysePressure } from "@/lib/engines/pressure";
import type { ScriptDraft } from "@/lib/ai/provider";

/**
 * Write the agent's script for the situation the account is actually in.
 *
 * The local `buildAgentScript` assembles a script from templates keyed on
 * state. It is good, and it is still what runs without a key — but it can
 * only say the sentences someone wrote in advance. This writes new ones for
 * the case in front of the agent.
 *
 * The part that makes it safe to ship: **the script is scored by the same
 * pressure model that scores the agent's own messages, and discarded if it
 * scores badly.** The entire premise of the console is that outgoing language
 * gets checked before it reaches the customer. A script the model wrote is
 * outgoing language. Exempting it because it came from the product rather
 * than the person would hollow out the claim.
 *
 * On any failure the route answers 502 and the console keeps the template
 * script it already rendered, so nothing is lost.
 */

const Brief = z.object({
  situation: z.string().min(1).max(300),
  firstName: z.string().min(1).max(40),
  facts: z
    .array(z.object({ label: z.string().max(60), value: z.string().max(120) }))
    .max(12),
  preferences: z.array(z.string().max(80)).max(10),
});

/**
 * Anything at "pressuring" or worse is rejected outright.
 *
 * `firm` is allowed: a real consequence stated once, calmly, with its date is
 * firm by construction, and the product's whole argument is that removing it
 * would mislead rather than help.
 */
const REJECT_FROM = 40;

export async function POST(request: Request) {
  const provider = getProvider();
  if (!provider.available()) {
    return Response.json({ error: "not_configured" }, { status: 503 });
  }

  let brief: z.infer<typeof Brief>;
  try {
    const parsed = Brief.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "bad_request" }, { status: 400 });
    brief = parsed.data;
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const draft = await provider.agentScript(brief);
  if (!draft || !shaped(draft)) {
    return Response.json({ error: "upstream" }, { status: 502 });
  }

  const worst = worstPressure(draft);
  if (worst >= REJECT_FROM) {
    // Not an error — the model answered, and the answer failed our own bar.
    // The console falls back to the template script either way.
    return Response.json({ error: "rejected", worst }, { status: 422 });
  }

  return Response.json({ script: draft, worst, source: "claude" });
}

/** Enough of a script to render. */
function shaped(d: ScriptDraft): boolean {
  return (
    Boolean(d.situation?.trim()) &&
    Boolean(d.opener?.trim()) &&
    Array.isArray(d.lines) &&
    d.lines.length > 0 &&
    d.lines.length <= 6 &&
    Array.isArray(d.avoid) &&
    d.avoid.length <= 5 &&
    Boolean(d.nextStep?.trim())
  );
}

/**
 * The worst score across everything the agent would actually say.
 *
 * Scored line by line rather than as one blob, because a single calm
 * paragraph can hide one hostile sentence inside an otherwise fine average —
 * and the agent says the sentences one at a time.
 *
 * The `avoid` list is excluded on purpose: those phrases are *quotations of
 * bad language*, shown so the agent recognises them. Scoring them would
 * reject every script for containing the examples that make it useful.
 */
function worstPressure(d: ScriptDraft): number {
  const spoken = [d.opener, ...d.lines, d.nextStep];
  return spoken.reduce((worst, line) => {
    const { score } = analysePressure(line);
    return Math.max(worst, score);
  }, 0);
}
