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

export interface DevicePrefs {
  /** "I can't handle banking today": the whole app reduced to what matters. */
  safeMode: boolean;
  /** The customer turned down the on-device offer to simplify. Never asked again. */
  focusDeclined: boolean;
  /** Master switch for on-device measurement and the simplify offer. */
  adaptiveEnabled: boolean;
  /** The welcome-back summary has been read. */
  welcomeBackSeen: boolean;
  /** Which demo run these belong to; a reset starts them afresh. */
  epoch: number;
}

const KEY = "c1a:device:v1";

const DEFAULTS: Omit<DevicePrefs, "epoch"> = {
  safeMode: false,
  focusDeclined: false,
  adaptiveEnabled: true,
  welcomeBackSeen: false,
};

const SERVER: DevicePrefs = { ...DEFAULTS, epoch: 0 };

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
): [DevicePrefs, (patch: Partial<Omit<DevicePrefs, "epoch">>) => void] {
  const stored = useSyncExternalStore(subscribe, read, () => SERVER);
  const prefs: DevicePrefs = stored.epoch === epoch ? stored : { ...DEFAULTS, epoch };

  const update = useCallback(
    (patch: Partial<Omit<DevicePrefs, "epoch">>) => {
      const current = read();
      const base = current.epoch === epoch ? current : { ...DEFAULTS, epoch };
      write({ ...base, ...patch, epoch });
    },
    [epoch],
  );

  return [prefs, update];
}
