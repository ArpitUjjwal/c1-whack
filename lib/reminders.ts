/**
 * Payment reminders the customer asked for.
 *
 * Set on a calm day ("remind me 2 days before"), shown in the app on the day,
 * and listed in the Time Machine. Only payments made by hand are reminded —
 * a Direct Debit pays itself — plus the card when it has an agreed new date.
 * In-app only and requested, so they never count toward the weekly contact
 * limit.
 */

import { addDays, daysUntil } from "./format";
import type { AppState } from "./types";

export interface Reminder {
  id: string;
  label: string;
  amount: number;
  /** ISO date the payment is due. */
  dueDate: string;
  /** ISO date the reminder shows. */
  remindOn: string;
  /** True from the reminder date until the payment is due. */
  active: boolean;
}

export function remindersFor(state: AppState): Reminder[] {
  const days = state.customer.contactPreferences.remindDaysBefore;
  if (!days) return [];

  const items: Omit<Reminder, "remindOn" | "active">[] = state.bills
    .filter((b) => !b.autopay)
    .map((b) => ({ id: b.id, label: b.name, amount: b.amount, dueDate: b.dueDate }));

  if (state.credit.status === "extended" && state.credit.minimumDue > 0) {
    items.push({
      id: "card",
      label: "Card minimum (new date)",
      amount: state.credit.minimumDue,
      dueDate: state.credit.dueDate,
    });
  }

  return items
    .filter((i) => daysUntil(i.dueDate) >= 0)
    .map((i) => {
      const remindOn = addDays(i.dueDate, -days);
      return { ...i, remindOn, active: daysUntil(remindOn) <= 0 };
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}
