"use client";

/**
 * Device-local preferences.
 *
 * Safe Mode, the "don't offer that again" answer, the adaptive switch and the
 * welcome-back card are the customer's business, not the bank's. They live
 * here — in this browser's storage, under their own key — and never enter
 * the shared `AppState`, so they are never broadcast and the console has no
 * code path that could read them.
 *
 * (In the demo both windows share one origin, so the key is technically
 * reachable from the console tab. Nothing on that surface reads it; in a real
 * deployment this would be the phone's own storage.)
 */

import { useCallback, useSyncExternalStore } from "react";
import type { StruggleId } from "./struggles";

export interface DevicePrefs {
  /** "I can't handle banking today": the whole app reduced to what matters. */
  safeMode: boolean;
  /** The customer turned down the on-device offer to simplify. Never asked again. */
  focusDeclined: boolean;
  /** Master switch for on-device measurement and the simplify offer. */
  adaptiveEnabled: boolean;
  /** The welcome-back summary has been read. */
  welcomeBackSeen: boolean;

  /* ---- Reading and display. Set from the first-run choices; never shared. ---- */
  /** Typeface for the whole app. Lexend is built for reading ease; Atkinson Hyperlegible for low vision. */
  font: ReadingFont;
  /** Scales the whole phone screen. */
  textSize: TextSize;
  /** Wider letter, word and line spacing, and no italics. */
  wideSpacing: boolean;
  /** A soft background tint, which some readers find easier than white. */
  tint: Tint;
  /** Darker text and stronger edges throughout. */
  highContrast: boolean;
  /** In-app tips this customer has closed. They stay closed. */
  dismissedTips: string[];

  /* ---- First-run setup ("what do you find hard?"). Never shared. ---- */
  /** True once the setup has been completed or skipped. It is never shown again. */
  onboarded: boolean;
  /** What the customer said they find hard. Stays on this phone. */
  struggles: StruggleId[];
  /**
   * Whether the customer agreed to share their preference labels with the
   * support team. Only the labels are shared — never `struggles`.
   */
  sharePreferences: boolean;
  /** Which demo run these belong to; a reset starts them afresh. */
  epoch: number;
}

export type ReadingFont = "standard" | "lexend" | "atkinson";
export type TextSize = "standard" | "large" | "xlarge";
export type Tint = "none" | "cream" | "blue";

const KEY = "c1a:device:v1";

const DEFAULTS: Omit<DevicePrefs, "epoch"> = {
  safeMode: false,
  focusDeclined: false,
  adaptiveEnabled: true,
  welcomeBackSeen: false,
  font: "standard",
  textSize: "standard",
  wideSpacing: false,
  tint: "none",
  highContrast: false,
  dismissedTips: [],
  onboarded: false,
  struggles: [],
  sharePreferences: false,
};

const SERVER: DevicePrefs = { ...DEFAULTS, epoch: 0 };

/** Factory defaults, for putting a setting back when a choice is unticked. */
export const DEVICE_DEFAULTS: DevicePrefs = SERVER;

let cache: DevicePrefs | null = null;
const listeners = new Set<() => void>();

function read(): DevicePrefs {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    cache = raw ? { ...SERVER, ...(JSON.parse(raw) as Partial<DevicePrefs>) } : SERVER;
  } catch {
    cache = SERVER;
  }
  return cache;
}

function write(next: DevicePrefs): void {
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: preferences last for this page only */
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Read and update this device's preferences for the current demo run.
 * Preferences saved under a different `epoch` read as defaults — derived,
 * not reset by an effect — so "Reset demo" clears them on the next render.
 */
export function useDevicePrefs(
  epoch: number,
  /** What this customer had already set on their own phone before the demo. */
  starting: Partial<DevicePrefs> = {},
): [DevicePrefs, (patch: Partial<Omit<DevicePrefs, "epoch">>) => void] {
  const stored = useSyncExternalStore(subscribe, read, () => SERVER);
  const fresh = (): DevicePrefs => ({ ...DEFAULTS, ...starting, epoch });
  const prefs: DevicePrefs = stored.epoch === epoch ? stored : fresh();

  const update = useCallback(
    (patch: Partial<Omit<DevicePrefs, "epoch">>) => {
      const current = read();
      const base = current.epoch === epoch ? current : { ...DEFAULTS, ...starting, epoch };
      write({ ...base, ...patch, epoch });
    },
    // `starting` comes from static profile data; its identity is stable per profile.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [epoch],
  );

  return [prefs, update];
}
