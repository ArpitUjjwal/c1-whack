import { CREDIT_FILE_RETENTION, REPORTING_DAYS } from "@/lib/compliance";

/**
 * The shared brief given to Claude on the coaching routes.
 *
 * Built from what the customer has actually chosen to share — their
 * preference labels and note, exactly as the agent console shows them — and
 * nothing else. If they haven't shared anything, Claude is told so and falls
 * back to plain language for everyone. It never sees what the customer ticked
 * as hard, or anything from their phone.
 */

export interface CoachCustomer {
  name: string;
  firstName: string;
  /** Shared preference labels; empty if the customer isn't sharing. */
  preferences: string[];
  /** Shared note; empty if none. */
  note: string;
  minimumDue: number;
  daysOverdue: number;
}

const FALLBACK: CoachCustomer = {
  name: "the customer",
  firstName: "the customer",
  preferences: [],
  note: "",
  minimumDue: 0,
  daysOverdue: 0,
};

/** Validate the customer context a client sends. Anything odd falls back. */
export function parseCoachCustomer(value: unknown): CoachCustomer {
  if (!value || typeof value !== "object") return FALLBACK;
  const v = value as Record<string, unknown>;
  const str = (x: unknown, max: number) => (typeof x === "string" ? x.slice(0, max) : "");
  const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : 0);
  return {
    name: str(v.name, 60) || FALLBACK.name,
    firstName: str(v.firstName, 40) || FALLBACK.firstName,
    preferences: Array.isArray(v.preferences)
      ? v.preferences.filter((p): p is string => typeof p === "string").slice(0, 10).map((p) => p.slice(0, 60))
      : [],
    note: str(v.note, 300),
    minimumDue: num(v.minimumDue),
    daysOverdue: num(v.daysOverdue),
  };
}

export function coachSystem(c: CoachCustomer): string {
  const shared =
    c.preferences.length || c.note
      ? `${c.firstName}'s preferences, which they chose to share (preferences, not a diagnosis — never ask why):
${c.preferences.map((x) => `- "${x}"`).join("\n")}${c.note ? `\n- "${c.note}"` : ""}`
      : `${c.firstName} hasn't shared any preferences. Use plain language, one thing at a time, and no pressure — which is right for everyone.`;

  return `You review messages a Capital One UK support agent is about to send to one specific customer, ${c.name}. UK English, UK terms.

${shared}

Context: ${c.firstName} is £${c.minimumDue.toFixed(2)} past due on a Capital One credit card by ${c.daysOverdue} days. Capital One reports an account to the credit reference agencies once a payment is more than ${REPORTING_DAYS} days late, and a missed payment can stay on a credit file for ${CREDIT_FILE_RETENTION}. A payment plan or extension does not stop a late payment being reported.

What matters, in order:
0. Insults, swearing or contempt aimed at the customer, including text-speak ("u") and obfuscated spellings. Any of these makes a message unsendable.
1. Pressure, urgency and deadline language. Pressure reliably produces silence, which makes the outcome worse for both sides.
2. Blame or shame aimed at the customer, including counting previous contact attempts.
3. Threats: escalation, vague consequences, and credit reporting used as a stick. Distinguish these from a real consequence stated once, calmly, with a specific date — that is information the customer needs to decide, and UK rules expect it to be clear and not misleading. Do not penalise it.
4. Collections jargon with no plain-language gloss.
5. Asking for more than one thing at once.
6. Long sentences and reading level above Flesch–Kincaid grade 8.

Judge the message as ${c.firstName} would receive it, not as a policy reviewer would. A sentence can be technically accurate, perfectly polite, and still be the thing that stops someone opening the app for another fortnight.`;
}
