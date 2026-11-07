import type { AppState } from "./types";
import { daysUntil } from "./format";

export interface SafeToSpendLine {
  id: string;
  label: string;
  amount: number;
  note: string;
}

export interface SafeToSpend {
  /** What the ledger says is in the account. */
  balance: number;
  /** Everything already promised to someone else in the next two weeks. */
  committed: number;
  /** balance − committed. The only number the customer sees by default. */
  available: number;
  lines: SafeToSpendLine[];
  /** How far out the calculation looks. */
  horizonDays: number;
}

const HORIZON_DAYS = 14;

/**
 * "Safe to Spend" replaces the ledger. Instead of showing a balance the
 * customer has to mentally subtract bills from, we do the subtraction and show
 * only the result. Upcoming bills inside the horizon are committed money, and
 * so is an unpaid credit-card minimum.
 */
export function selectSafeToSpend(state: AppState): SafeToSpend {
  const lines: SafeToSpendLine[] = [];

  for (const bill of state.bills) {
    const days = daysUntil(bill.dueDate);
    if (days < 0 || days > HORIZON_DAYS) continue;
    lines.push({
      id: bill.id,
      label: bill.name,
      amount: bill.amount,
      note: bill.autopay
        ? `Pays itself ${days === 0 ? "today" : `in ${days} day${days === 1 ? "" : "s"}`}`
        : `Due ${days === 0 ? "today" : `in ${days} day${days === 1 ? "" : "s"}`}`,
    });
  }

  // Money already owed never counts as spendable, whatever arrangement it is
  // under. Keeping this consistent is what makes Safe-to-Spend hold still when
  // the customer pays: the figure moves from "committed" to "gone", and the
  // number they were relying on does not change.
  if (state.credit.minimumDue > 0) {
    if (state.credit.status === "overdue" || state.credit.status === "extended") {
      lines.push({
        id: "credit-minimum",
        label: "Credit card minimum",
        amount: state.credit.minimumDue,
        note:
          state.credit.status === "extended"
            ? "Extension granted — more time to pay"
            : "Past due",
      });
    } else if (state.credit.status === "split_plan") {
      // The first of three instalments has already left the account.
      const remaining = round((state.credit.minimumDue * 2) / 3);
      if (remaining > 0) {
        lines.push({
          id: "credit-plan",
          label: "Payment plan",
          amount: remaining,
          note: "2 instalments left — they pay themselves",
        });
      }
    }
  }

  const committed = round(lines.reduce((sum, l) => sum + l.amount, 0));
  const balance = round(state.checking.balance);

  return {
    balance,
    committed,
    available: round(balance - committed),
    lines,
    horizonDays: HORIZON_DAYS,
  };
}

/** Percentage of the credit limit in use, 0–100. */
export function selectCreditUtilisation(state: AppState): number {
  if (state.credit.creditLimit <= 0) return 0;
  return Math.min(100, Math.round((state.credit.balance / state.credit.creditLimit) * 100));
}

/** True while there is a past-due payment with nothing arranged. */
export function selectNeedsCatchUp(state: AppState): boolean {
  return state.credit.status === "overdue";
}

/** Nudges that should currently be on screen for the customer. */
export function selectActiveNudges(state: AppState) {
  return state.nudges.filter((n) => !n.dismissed);
}

/** The single most recent thing that happened, for the agent's status line. */
export function selectLatestEvent(state: AppState) {
  return state.timeline[state.timeline.length - 1] ?? null;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
