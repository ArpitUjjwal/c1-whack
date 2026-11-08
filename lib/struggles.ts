/**
 * "What do you find hard?" — the first-run choices, and what each one does.
 *
 * Described in the customer's terms (tasks and experiences), never as
 * conditions. Each choice can change three separate things, kept apart on
 * purpose because they have different privacy rules:
 *
 *  · `device`  — reading, display and Safe Mode settings. Stored on the phone
 *                only (lib/device.ts). Never shared.
 *  · `labels`  — plain preference labels ("Written messages over calls")
 *                that the support team sees, but ONLY if the customer chooses
 *                to share their preferences.
 *  · `contact` — contact rules (reminders). These are always visible to
 *                support, because a rule nobody can see can't be followed —
 *                and the setup screen says so.
 *
 * Which boxes the customer ticked is itself never shared: the bank only ever
 * sees the labels, and only with consent.
 */

import type { DevicePrefs } from "./device";
import type { ContactPreferences } from "./types";

export type StruggleId =
  | "reading"
  | "seeing"
  | "listening"
  | "remembering"
  | "overwhelmed"
  | "calls";

/** The device settings a choice is allowed to change. */
export type DevicePatch = Partial<
  Pick<
    DevicePrefs,
    "font" | "textSize" | "wideSpacing" | "tint" | "highContrast" | "listenFirst" | "safeMode"
  >
>;

export interface Struggle {
  id: StruggleId;
  /** What the customer finds hard, in their words. */
  label: string;
  /** What ticking it will do, said before they tick. */
  effect: string;
  device: DevicePatch;
  labels: string[];
  contact?: Partial<Pick<ContactPreferences, "remindDaysBefore">>;
}

export const STRUGGLES: Struggle[] = [
  {
    id: "reading",
    label: "Reading long bits of text",
    effect: "Easier-to-read font, wider spacing, a cream background and larger text.",
    device: { font: "lexend", wideSpacing: true, tint: "cream", textSize: "large" },
    labels: ["Plain language", "Amounts and dates first"],
  },
  {
    id: "seeing",
    label: "Seeing small text",
    effect: "Extra-large, high-contrast text in a font made for low vision.",
    device: { font: "atkinson", textSize: "xlarge", highContrast: true },
    labels: ["Large text"],
  },
  {
    id: "listening",
    label: "I'd rather listen than read",
    effect: "A clear “Listen” button on every card, ready to read it aloud.",
    device: { listenFirst: true },
    labels: ["Read it to me"],
  },
  {
    id: "remembering",
    label: "Remembering dates",
    effect: "A reminder in the app 3 days before payments you make yourself.",
    device: {},
    labels: ["Remind me before payments"],
    contact: { remindDaysBefore: 3 },
  },
  {
    id: "overwhelmed",
    label: "Starting money tasks, or too much on screen",
    effect: "The app opens in Safe Mode: just the one thing that needs you. One tap to see everything.",
    device: { safeMode: true },
    labels: ["One step at a time", "No urgency or pressure language"],
  },
  {
    id: "calls",
    label: "Phone calls",
    effect: "Support contacts you by message in the app, not by phone.",
    device: {},
    labels: ["Written messages over calls"],
  },
];

export function struggle(id: StruggleId): Struggle {
  return STRUGGLES.find((s) => s.id === id)!;
}

/** The preference labels a set of choices would share, in a stable order. */
export function labelsFor(selected: StruggleId[]): string[] {
  const out: string[] = [];
  for (const s of STRUGGLES) {
    if (!selected.includes(s.id)) continue;
    for (const l of s.labels) if (!out.includes(l)) out.push(l);
  }
  return out;
}

/** Everything a set of choices turns on, merged (later choices win). */
export function devicePatchFor(selected: StruggleId[]): DevicePatch {
  return STRUGGLES.filter((s) => selected.includes(s.id)).reduce<DevicePatch>(
    (acc, s) => ({ ...acc, ...s.device }),
    {},
  );
}

/**
 * Untick one choice without undoing anything the customer set by hand.
 *
 * For each setting the removed choice turned on: if it still holds the value
 * that choice gave it, it goes back to what the remaining choices say (or the
 * default). If the customer has since changed it themselves, it is left alone.
 */
export function deviceRevertFor(
  removed: StruggleId,
  remaining: StruggleId[],
  current: DevicePrefs,
  defaults: DevicePrefs,
): DevicePatch {
  const gone = struggle(removed).device;
  const still = devicePatchFor(remaining);
  const patch: DevicePatch = {};
  for (const key of Object.keys(gone) as (keyof DevicePatch)[]) {
    if (current[key] !== gone[key]) continue; // changed by hand since: leave it
    (patch as Record<string, unknown>)[key] = key in still ? still[key] : defaults[key];
  }
  return patch;
}

export interface StruggleChange {
  /** Device settings to write (includes the new `struggles` list). */
  device: Partial<DevicePrefs>;
  /** Contact rules to write, or null if unchanged. */
  contact: Partial<Pick<ContactPreferences, "remindDaysBefore">> | null;
  /** The labels these choices would share (used only if sharing is on). */
  labels: string[];
}

/**
 * Tick or untick one choice. The single place this logic lives, so the
 * first-run setup and Settings can never disagree.
 */
export function toggleStruggle(
  id: StruggleId,
  current: DevicePrefs,
  contact: Pick<ContactPreferences, "remindDaysBefore">,
  defaults: DevicePrefs,
): StruggleChange {
  const on = current.struggles.includes(id);
  const next = on ? current.struggles.filter((s) => s !== id) : [...current.struggles, id];
  const choice = struggle(id);

  const device: Partial<DevicePrefs> = on
    ? { ...deviceRevertFor(id, next, current, defaults), struggles: next }
    : { ...choice.device, struggles: next };

  let contactPatch: StruggleChange["contact"] = null;
  if (choice.contact?.remindDaysBefore !== undefined) {
    if (!on) {
      contactPatch = { remindDaysBefore: choice.contact.remindDaysBefore };
    } else if (contact.remindDaysBefore === choice.contact.remindDaysBefore) {
      // Only switch reminders off if they're still at the value this choice set.
      contactPatch = { remindDaysBefore: 0 };
    }
  }

  return { device, contact: contactPatch, labels: labelsFor(next) };
}
