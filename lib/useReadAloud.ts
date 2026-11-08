"use client";

/**
 * Read aloud, with the browser's own speech synthesis.
 *
 * For people who'd rather listen than read — dyslexia, low vision, or just a
 * long day. It works alongside a real screen reader rather than replacing
 * one: it reads a whole card as plain sentences, on request, at the speed the
 * customer chose. Nothing is sent anywhere; speech is generated on the device.
 *
 * One utterance plays at a time across the whole app, so the state lives in a
 * tiny module-level store rather than in each button.
 */

import { useCallback, useSyncExternalStore } from "react";

let speakingId: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Prefer a British English voice, to match the app; fall back to any English. */
function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === "en-GB") ??
    voices.find((v) => v.lang.startsWith("en")) ??
    null
  );
}

export function stopReading(): void {
  if (!speechSupported()) return;
  window.speechSynthesis.cancel();
  speakingId = null;
  emit();
}

export function readAloud(id: string, text: string, rate = 1): void {
  if (!speechSupported() || !text.trim()) return;
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-GB";
  utterance.rate = rate;
  const voice = pickVoice();
  if (voice) utterance.voice = voice;

  const finish = () => {
    if (speakingId === id) {
      speakingId = null;
      emit();
    }
  };
  utterance.onend = finish;
  utterance.onerror = finish;

  speakingId = id;
  emit();
  window.speechSynthesis.speak(utterance);
}

/** The id currently being read, or null. */
export function useReadAloud(): {
  speakingId: string | null;
  toggle: (id: string, text: string, rate?: number) => void;
} {
  const current = useSyncExternalStore(
    subscribe,
    () => speakingId,
    () => null,
  );
  const toggle = useCallback((id: string, text: string, rate?: number) => {
    if (speakingId === id) stopReading();
    else readAloud(id, text, rate);
  }, []);
  return { speakingId: current, toggle };
}
