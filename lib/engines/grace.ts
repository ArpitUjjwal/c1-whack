/**
 * The grace rule: a record of paying on time earns one forgiven late fee.
 *
 * If the last three statements were paid on time, and the rule hasn't been
 * used in the past year, the next late fee is waived automatically. It is a
 * policy, not a judgement call — nobody has to ask, explain, or qualify by
 * describing their circumstances — and it rewards a track record of paying,
 * never a period of silence.
 *
 * Illustrative: this is not a published Capital One UK policy.
 */

import { addDays } from "../format";
import type { CreditAccount } from "../types";

/** On-time payments in a row needed to earn grace. */
export const GRACE_STREAK = 3;

/** Grace can be used once in this many days. */
const GRACE_WINDOW_DAYS = 365;

export interface GraceCheck {
  eligible: boolean;
  /** Consecutive on-time payments, counting back from the latest. */
  streak: number;
  /** One plain sentence, for either screen. */
  reason: string;
}

export function onTimeStreak(credit: Pick<CreditAccount, "paymentHistory">): number {
  let streak = 0;
  for (let i = credit.paymentHistory.length - 1; i >= 0; i -= 1) {
    if (!credit.paymentHistory[i].onTime) break;
    streak += 1;
  }
  return streak;
}

/**
 * Would a late fee charged on `onDate` be waived under the rule?
 * Pure: the date is passed in.
 */
export function checkGrace(
  credit: Pick<CreditAccount, "paymentHistory" | "graceUsedOn">,
  onDate: string,
): GraceCheck {
  const streak = onTimeStreak(credit);
  const usedRecently =
    credit.graceUsedOn !== null && addDays(credit.graceUsedOn, GRACE_WINDOW_DAYS) > onDate;

  if (usedRecently) {
    return {
      eligible: false,
      streak,
      reason: "Grace was already used in the last 12 months.",
    };
  }
  if (streak >= GRACE_STREAK) {
    return {
      eligible: true,
      streak,
      reason: `The last ${streak} payments were on time, so this late fee is waived automatically.`,
    };
  }
  return {
    eligible: false,
    streak,
    reason: `Needs ${GRACE_STREAK} on-time payments in a row; the latest run is ${streak}.`,
  };
}
