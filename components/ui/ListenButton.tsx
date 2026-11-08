"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import { speechSupported, useReadAloud } from "@/lib/useReadAloud";

/** The customer's chosen speech rate, provided once at the app root. */
export const SpeechRateContext = createContext(1);

/** True when the customer asked for listening first: every Listen button stands out. */
export const ListenFirstContext = createContext(false);

/**
 * "Listen" on a card. Reads `text` aloud on the device; pressing again stops.
 * Hidden entirely where the browser can't speak, rather than shown broken.
 *
 * `text` is written for the ear: whole sentences, amounts in words the voice
 * reads well, no symbols or layout.
 */
export function ListenButton({
  id,
  text,
  label = "Listen",
}: {
  id: string;
  text: string;
  label?: string;
}) {
  const rate = useContext(SpeechRateContext);
  const prominent = useContext(ListenFirstContext);
  const { speakingId, toggle } = useReadAloud();
  const speaking = speakingId === id;

  // Only knowable in the browser; the server snapshot says "no" so the first
  // client render matches the prerender.
  const supported = useSyncExternalStore(noSubscribe, speechSupported, () => false);

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={() => toggle(id, text, rate)}
      aria-pressed={speaking}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition-colors ${
        speaking
          ? "border-calm bg-calm-dim text-calm"
          : prominent
            ? "border-calm bg-calm text-white hover:opacity-90"
            : "border-edge bg-glass text-fg-2 hover:text-fg"
      }`}
    >
      <span aria-hidden="true">{speaking ? "■" : "▶"}</span>
      {speaking ? "Stop" : label}
    </button>
  );
}

function noSubscribe(): () => void {
  return () => {};
}

/** Marks the region being read, for the visible outline. */
export function useIsReading(id: string): boolean {
  return useReadAloud().speakingId === id;
}
