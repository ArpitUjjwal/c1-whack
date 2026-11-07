/**
 * Contact preferences and the frequency guard.
 *
 * Alex sets the rules on a calm day; the console honours them on a hard one.
 * Nothing here is inferred — every rule is something the customer chose, so
 * it cannot be gamed and it does not depend on reading anyone's state.
 *
 * The frequency guard exists because volume is itself harm: Money and Mental
 * Health found people receiving five or more creditor calls a month were far
 * more likely to say contact hurt their mental health (91%, against 57% for
 * four or fewer).
 */

import type { AppState, ContactChannel, ContactPreferences } from "./types";

export const CHANNEL_LABEL: Record<ContactChannel, string> = {
  in_app: "In-app message",
  email: "Email",
  phone: "Phone call",
  letter: "Letter",
};

const WEEK_MS = 7 * 86_400_000;

export function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function quietHoursLabel(prefs: ContactPreferences): string {
  return `${hourLabel(prefs.quietHours.start)}–${hourLabel(prefs.quietHours.end)}`;
}

/** True if `hour` falls inside the quiet window, which may wrap midnight. */
export function isQuietHour(prefs: ContactPreferences, hour: number): boolean {
  const { start, end } = prefs.quietHours;
  if (start === end) return false;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  const suffix = ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suffix}`;
}

export interface ContactCheck {
  /** Contacts on any channel in the last seven days. */
  sentThisWeek: number;
  /** What the next message would be: 1 = first this week. */
  nextOrdinal: number;
  /** True when the next message would exceed Alex's weekly limit. */
  overLimit: boolean;
  /** Each rule the next message would break, in plain words. */
  breaches: string[];
}

/**
 * Would sending one more message on `channel`, right now, break any of Alex's
 * rules? Pure: the caller passes the time and the hour.
 */
export function checkContact(
  state: AppState,
  now: number,
  hour: number,
  channel: ContactChannel = "in_app",
): ContactCheck {
  const prefs = state.customer.contactPreferences;
  const sentThisWeek = state.contactLog.filter((c) => now - c.at < WEEK_MS).length;
  const nextOrdinal = sentThisWeek + 1;
  const overLimit = nextOrdinal > prefs.maxPerWeek;
  const breaches: string[] = [];

  if (channel !== prefs.channel) {
    breaches.push(`Alex asked for ${CHANNEL_LABEL[prefs.channel].toLowerCase()}s only.`);
  }
  if (overLimit) {
    breaches.push(
      `This would be the ${ordinal(nextOrdinal)} message this week. Alex's limit is ${prefs.maxPerWeek}.`,
    );
  }
  if (isQuietHour(prefs, hour)) {
    breaches.push(`It's inside Alex's quiet hours (${quietHoursLabel(prefs)}).`);
  }

  return { sentThisWeek, nextOrdinal, overLimit, breaches };
}

/** The statistic behind the guard, with its source, for on-screen citation. */
export const FREQUENCY_EVIDENCE = {
  text: "People getting five or more calls a month from creditors were much more likely to say the contact harmed their mental health: 91%, against 57% for four or fewer.",
  source: "Money and Mental Health Policy Institute",
};
