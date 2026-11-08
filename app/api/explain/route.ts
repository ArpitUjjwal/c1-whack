import { getProvider } from "@/lib/ai/providers";
import {
  ExplainRequest,
  explainLocally,
  factsFor,
  subjectLabel,
  type ExplainSubject,
} from "@/lib/explain";
import { analyseReadability } from "@/lib/engines/readability";
import type { ExplainDraft } from "@/lib/ai/provider";

/**
 * "What does this mean?" on the customer's own screen.
 *
 * The one piece of AI in this product that serves the customer rather than
 * the agent. It explains a figure they are already looking at, in plain
 * words, using only facts the server composed from the numbers they sent.
 *
 * Unlike the coaching routes, this one always answers. With no key, or on any
 * failure, it returns the deterministic explanation and says so — a customer
 * who taps "what does this mean?" should never be told the feature is
 * unavailable.
 */

/**
 * The plain-language ceiling, taken from the brief the app already gives
 * agents: Flesch–Kincaid grade 8.
 *
 * This is the part worth keeping. The console refuses to let an agent send
 * the customer prose above this grade; it would be incoherent for the app's
 * own explanations to sit above it because a model wrote them. So the answer
 * is measured by the same engine that measures the agent, and a dense one is
 * thrown away in favour of the local text rather than shipped.
 */
const GRADE_CEILING = 8;

export async function GET() {
  return Response.json({ claude: getProvider().available() });
}

export async function POST(request: Request) {
  let subject: ExplainSubject;
  try {
    const parsed = ExplainRequest.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "bad_request" }, { status: 400 });
    }
    subject = parsed.data;
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const local = explainLocally(subject);
  const provider = getProvider();
  if (!provider.available()) {
    return Response.json({ explanation: local, source: "local" });
  }

  const written = await provider.explain({
    subject: subjectLabel(subject),
    facts: factsFor(subject),
    firstName: "The customer",
  });

  if (!written || !usable(written)) {
    return Response.json({ explanation: local, source: "local" });
  }

  return Response.json({ explanation: written, source: "claude" });
}

/**
 * Is this fit to put in front of someone?
 *
 * Three ways it can fail: empty, over-long, or above the reading grade. The
 * grade is measured over the whole answer joined together, because that is
 * what the customer reads — a set of individually short lines can still add
 * up to dense prose.
 */
function usable(draft: ExplainDraft): boolean {
  if (!draft.headline.trim() || draft.plainWords.length === 0) return false;
  if (draft.plainWords.length > 4 || draft.whatYouCouldDo.length > 4) return false;

  const all = [draft.headline, ...draft.plainWords, ...draft.whatYouCouldDo].join(" ");
  if (all.length > 900) return false;

  return analyseReadability(all).grade <= GRADE_CEILING;
}
