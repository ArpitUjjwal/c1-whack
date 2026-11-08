/**
 * The Financial Time Machine.
 *
 * Answers one question: "What happens if I don't touch my finances for the
 * next N days?" From known facts only — the balance, scheduled bills, due
 * dates, which ones are Direct Debits, and the card's real terms — with every
 * assumption printed beside the result.
 *
 * It is read-only by design. It never pays, extends, waives or sends
 * anything. It sorts what is coming into "needs you" and "pays itself",
 * projects the balance after scheduled payments, and writes a short plan
 * that names the one thing to do first. Financial continuity, not advice.
 *
 * Pure apart from reading today's date via `daysUntil`, so it is only ever
 * called on the client after hydration.
 */

import { creditFileLine, payByDate } from "../compliance";
import { daysUntil, money, shortDate } from "../format";
import type { AppState } from "../types";

export const BREAK_MIN_DAYS = 1;
export const BREAK_MAX_DAYS = 14;

/** How far past the break "can wait" items are listed. */
const LATER_HORIZON_DAYS = 30;

export type Bucket = "needs_you" | "pays_itself";

export interface Obligation {
  id: string;
  label: string;
  amount: number;
  /** ISO date. */
  dueDate: string;
  /** Negative when already past its date. */
  inDays: number;
  bucket: Bucket;
  /** One plain sentence about it — a real consequence, stated calmly. */
  note: string;
  /** Balance after this payment, if everything before it also went through. */
  balanceAfter: number;
}

export interface BreakProjection {
  days: number;
  balance: number;
  /** Everything due on or before the last day of the break, in date order. */
  during: Obligation[];
  /** Due after the break but within the month: these can wait. */
  later: Obligation[];
  totalDuring: number;
  /** Balance after every scheduled payment in the break goes through. */
  projected: number;
  /** The first payment the balance would not cover, if any. */
  shortfall: Obligation | null;
  /** The gentle action plan. Deterministic, built from the facts above. */
  plan: string;
  assumptions: string[];
}

export function dueLabel(inDays: number, dueDate: string): string {
  if (inDays < 0) return `Past its date (${shortDate(dueDate)})`;
  if (inDays === 0) return "Due today";
  if (inDays === 1) return "Due tomorrow";
  return `Due in ${inDays} days · ${shortDate(dueDate)}`;
}

export function projectBreak(state: AppState, rawDays: number): BreakProjection {
  const days = Math.max(BREAK_MIN_DAYS, Math.min(BREAK_MAX_DAYS, Math.round(rawDays)));
  const balance = state.current.balance;
  const { credit } = state;

  const items: Omit<Obligation, "balanceAfter">[] = [];

  // The card. Past its date or under an agreed new date, it needs a person.
  if (credit.minimumDue > 0 && (credit.status === "overdue" || credit.status === "extended")) {
    const overdue = credit.status === "overdue";
    items.push({
      id: "card",
      label: overdue ? "Card minimum" : "Card minimum (new date)",
      amount: credit.minimumDue,
      dueDate: credit.dueDate,
      inDays: overdue ? -credit.daysOverdue : daysUntil(credit.dueDate),
      bucket: "needs_you",
      note: overdue
        ? `${credit.ddReturnedOn ? "Your Direct Debit didn't go through, so this one needs paying by hand. " : ""}${creditFileLine(payByDate(credit))}`
        : "Agreed new date. Paying by then keeps the arrangement on track.",
    });
  }

  for (const bill of state.bills) {
    items.push({
      id: bill.id,
      label: bill.name,
      amount: bill.amount,
      dueDate: bill.dueDate,
      inDays: daysUntil(bill.dueDate),
      bucket: bill.autopay ? "pays_itself" : "needs_you",
      note: bill.autopay
        ? "Direct Debit. It pays itself if the money is there."
        : "Paid by hand. Check it's arranged before your break.",
    });
  }

  items.sort((a, b) => a.inDays - b.inDays);

  let running = balance;
  let shortfall: Obligation | null = null;
  const during: Obligation[] = [];
  const later: Obligation[] = [];

  for (const item of items) {
    if (item.inDays <= days) {
      running = round(running - item.amount);
      const withBalance = { ...item, balanceAfter: running };
      if (running < 0 && !shortfall) shortfall = withBalance;
      during.push(withBalance);
    } else if (item.inDays <= LATER_HORIZON_DAYS) {
      later.push({ ...item, balanceAfter: running });
    }
  }

  const totalDuring = round(during.reduce((s, o) => s + o.amount, 0));

  return {
    days,
    balance,
    during,
    later,
    totalDuring,
    projected: running,
    shortfall,
    plan: buildPlan(days, during, shortfall),
    assumptions: [
      "Every listed payment goes through on its date.",
      "No other income or spending during the break.",
      "Fictional demo data, not a guaranteed forecast. A production version would check scheduled payments, account terms, uncertainties and available balances before classifying anything as urgent.",
    ],
  };
}

function buildPlan(days: number, during: Obligation[], shortfall: Obligation | null): string {
  const span = `${days} day${days === 1 ? "" : "s"}`;
  if (during.length === 0) {
    return `Nothing is due in the next ${span}. You can step away — everything will still be here.`;
  }

  const needs = during.filter((o) => o.bucket === "needs_you");
  const auto = during.filter((o) => o.bucket === "pays_itself");
  const parts: string[] = [];

  parts.push(
    `${during.length} payment${during.length === 1 ? "" : "s"} fall${during.length === 1 ? "s" : ""} in the next ${span}.`,
  );

  if (needs.length === 0) {
    parts.push("They all pay themselves. Nothing needs you during this break.");
  } else {
    const [first, ...rest] = needs;
    parts.push(
      `Start with ${first.label.toLowerCase()} (${money(first.amount)})${
        first.inDays < 0 ? " — it's past its date" : ""
      }.`,
    );
    if (rest.length) {
      parts.push(
        `Then check ${rest.map((o) => `${o.label.toLowerCase()} (${money(o.amount)})`).join(" and ")} is arranged.`,
      );
    }
  }

  if (auto.length && needs.length) {
    parts.push(`${auto.map((o) => o.label).join(" and ")} pay${auto.length === 1 ? "s" : ""} itself.`);
  }

  if (shortfall) {
    parts.push(
      `The balance may not cover ${shortfall.label.toLowerCase()} — that's the one to ask for help with.`,
    );
  } else {
    parts.push("Everything else can wait until you're back.");
  }

  return parts.join(" ");
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
