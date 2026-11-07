/** Formatting helpers. Locale is pinned so server and client render identically. */

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const usdWhole = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function money(value: number): string {
  return usd.format(value);
}

export function moneyWhole(value: number): string {
  return usdWhole.format(value);
}

/** "Nov 12" — short, no year, no ambiguity. Parsed as UTC to stay stable. */
export function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** "Thursday, November 12" — used where the extra words reduce ambiguity. */
export function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
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

/** "just now" / "4 min ago" / "2:14 PM" — only ever rendered after mount. */
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

/** Clock time for the timeline, e.g. "2:14 PM". */
export function clockTime(at: number): string {
  return new Date(at).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Shows only the last four digits: •••• 4417 */
export function maskTail(value: string): string {
  return `•••• ${value.slice(-4)}`;
}
