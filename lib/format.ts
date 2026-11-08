/** Formatting helpers. Locale is pinned so server and client render identically. */

/*
  The setting is the UK: pounds, day-month dates, 24-hour clock. Pinned to
  en-GB so a judge's browser locale can never change what the demo says.
*/
const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
});

const gbpWhole = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

export function money(value: number): string {
  return gbp.format(value);
}

export function moneyWhole(value: number): string {
  return gbpWhole.format(value);
}

/** "12 Nov" — short, no year, no ambiguity. Parsed as UTC to stay stable. */
export function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** "Thursday 12 November" — used where the extra words reduce ambiguity. */
export function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** `iso` shifted by `days`, as yyyy-mm-dd. Pure: no reference to today. */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return shifted.toISOString().slice(0, 10);
}

/** Today's date as yyyy-mm-dd in the viewer's own timezone. */
export function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = `${now.getMonth() + 1}`.padStart(2, "0");
  const d = `${now.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** yyyy-mm-dd for `offset` days from today. Negative values go backwards. */
export function isoDaysFromToday(offset: number): string {
  const now = new Date();
  const shifted = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
  const y = shifted.getFullYear();
  const m = `${shifted.getMonth() + 1}`.padStart(2, "0");
  const d = `${shifted.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Whole days from today until `iso`. Positive = future. */
export function daysUntil(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const target = Date.UTC(y, m - 1, d);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86_400_000);
}

/** "just now" / "4 min ago" / "14:14" — only ever rendered after mount. */
export function relativeTime(at: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - at) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/** Clock time for the timeline, e.g. "14:14". */
export function clockTime(at: number): string {
  return new Date(at).toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Shows only the last four digits: •••• 4417 */
export function maskTail(value: string): string {
  return `•••• ${value.slice(-4)}`;
}
