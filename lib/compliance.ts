/**
 * Regulated wording, in one place.
 *
 * Every screen that says anything about the credit file reads it from here,
 * so the customer app, the agent's script, the Pressure Index, the rewriter
 * and the Claude prompt can never disagree with each other.
 *
 * The setting is the UK. Capital One UK's own guidance is that an account is
 * reported to the credit reference agencies as in arrears once a payment is
 * more than 30 days late, and that a payment plan or breathing space does not
 * stop a late payment being reported. So the wording below is deliberately
 * cautious: it gives a date, says "should", and never promises that an
 * arrangement protects the file.
 *
 * Softening tone is the product. Removing a consequence the customer needs in
 * order to decide is not — the FCA expects communications to be clear, fair
 * and not misleading. A real consequence, stated once, calmly, with a date,
 * is information; a threat is pressure. The Pressure Index treats them
 * differently for that reason.
 */

import type { CreditAccount } from "./types";
import { addDays, longDate } from "./format";

/** Days past due after which Capital One UK reports arrears. */
export const REPORTING_DAYS = 30;

/** Days of margin we leave for a payment to land before that point. */
const PAYMENT_MARGIN_DAYS = 2;

/** How long a missed-payment marker stays on a UK credit file. */
export const CREDIT_FILE_RETENTION = "six years";

/** ISO date by which paying should keep the missed payment off the file. */
export function payByIso(credit: Pick<CreditAccount, "dueDate">): string {
  return addDays(credit.dueDate, REPORTING_DAYS - PAYMENT_MARGIN_DAYS);
}

/** "Monday 29 November" — the human form of `payByIso`. */
export function payByDate(credit: Pick<CreditAccount, "dueDate">): string {
  return longDate(payByIso(credit));
}

/** The one consequence sentence. Cautious, dated, stated once. */
export function creditFileLine(date: string): string {
  return `Paying it by ${date} should keep it off your credit file.`;
}

/** For the glossary and other places with no specific date in hand. */
export const CREDIT_FILE_GENERAL =
  "If a payment is still unpaid 30 days after its date, Capital One reports it to the credit reference agencies, and it can stay on your credit file for six years. A payment plan doesn't stop that, but paying does.";

export interface LockedSegment {
  id: string;
  label: string;
  /** Why this wording is required, for the agent. */
  why: string;
  text: (ctx: { payBy: string }) => string;
}

/**
 * Wording a rewrite may not touch. Illustrative, not legal advice: a real
 * deployment would take these from Capital One's compliance team verbatim.
 */
export const LOCKED_SEGMENTS: LockedSegment[] = [
  {
    id: "credit-file",
    label: "Credit-file date",
    why: "A real consequence the customer needs to decide. Stated once, with the date.",
    text: ({ payBy }) => creditFileLine(payBy),
  },
  {
    id: "debt-advice",
    label: "Free debt advice",
    why: "Arrears contact should point to free, independent debt advice (FCA CONC 7).",
    text: () =>
      "If money's tight, free and confidential debt advice is available from MoneyHelper.",
  },
];
