"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect } from "react";
import { BEATS } from "@/lib/demo-script";
import { useRealtimeSync } from "@/lib/realtime";
import type { Role } from "@/lib/types";

/**
 * Demo Director.
 *
 * The beat number lives in shared state, so one keypress in either window
 * advances both. That removes the worst failure mode of a two-window live
 * demo — the windows drifting out of step while the presenter is talking —
 * and means a window refreshed mid-run rejoins at the current beat.
 *
 * Marked `data-load-ignore` and `data-a11y-ignore`: this is presentation
 * chrome, not part of either product surface, and must not contaminate the
 * measurements the product is making about itself.
 */
export function DemoDirector({ role }: { role: Role }) {
  const { state, dispatch, sendSignal } = useRealtimeSync();
  const { beat, active } = state.demo;

  const go = useCallback(
    (nextBeat: number) => {
      const clamped = Math.max(-1, Math.min(BEATS.length - 1, nextBeat));
      dispatch({ type: "DEMO_SET_BEAT", beat: clamped, active: clamped >= 0 });

      const step = BEATS[clamped];
      if (!step) return;
      if (step.action) dispatch(step.action);
      if (step.signal) sendSignal({ type: "demo_action", action: step.signal.action });
    },
    [dispatch, sendSignal],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = Boolean(
        target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable),
      );
      const withModifier = event.metaKey || event.ctrlKey;

      /*
        Never hijack plain typing — the composer is the point of the demo. But
        a presenter who has clicked into the text field still needs to drive
        the run, so the modifier form works everywhere.
      */
      if (typing && !withModifier) return;

      if (event.key === "d" || event.key === "D") {
        event.preventDefault();
        if (active) {
          go(-1);
        } else {
          // The guided script is Alex's story from first open. Starting it
          // always resets both windows to a fresh Alex — first-run setup
          // included — so every beat lands as written.
          dispatch({ type: "RESET_DEMO", profile: "alex" });
          go(0);
        }
        return;
      }
      if (!active) return;

      if (event.key === "ArrowRight" || event.key === " ") {
        event.preventDefault();
        go(beat + 1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(beat - 1);
      } else if (event.key === "Escape") {
        event.preventDefault();
        go(-1);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, beat, go, dispatch]);

  const current = active && beat >= 0 ? BEATS[beat] : null;
  const looksHere = current && (current.look === role || current.look === "both");

  return (
    <div data-load-ignore data-a11y-ignore>
      <AnimatePresence>
        {current ? (
          <motion.div
            key="director"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 400, damping: 34 }}
            className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center p-4"
          >
            <div
              className={`glass-2 pointer-events-auto w-full max-w-3xl rounded-xl2 px-5 py-4 backdrop-blur-2xl ${
                looksHere ? "border-link/40" : "opacity-60"
              }`}
            >
              <div className="flex items-start gap-4">
                <span className="tnum shrink-0 rounded-lg bg-link px-2 py-1 text-xs font-bold text-void">
                  {beat + 1}/{BEATS.length}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.9375rem] leading-snug font-medium text-fg">
                    {current.caption}
                  </p>
                  {current.note ? (
                    <p className="mt-1 text-xs text-fg-3">{current.note}</p>
                  ) : null}
                </div>
                <span className="shrink-0 text-xs text-fg-3">
                  {current.look === "both"
                    ? "both windows"
                    : current.look === "customer"
                      ? "phone"
                      : "console"}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 border-t border-edge pt-2.5 text-xs text-fg-3">
                <span>
                  <Key>←</Key> back <Key>→</Key> next <Key>Esc</Key> exit
                  <span className="ml-2 opacity-70">
                    (add <Key>⌘</Key> while typing)
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => go(beat + 1)}
                  className="rounded-lg px-2 py-1 font-semibold text-link hover:text-fg"
                >
                  Next →
                </button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/*
        Hidden on the customer surface below `sm`. There the device is
        full-bleed, so this bar — which draws above everything at z-50 — landed
        on top of the bottom nav and clipped the last line of any open sheet.
        Above `sm` the phone is inset from the viewport and the bar sits below
        it; on the console there is nothing anchored to the bottom to hit. It
        advertises keyboard shortcuts, so a phone-width viewport is also where
        it has least to say.
      */}
      {!active ? (
        <p
          className={`pointer-events-none fixed bottom-3 left-1/2 z-50 -translate-x-1/2 text-[0.6875rem] text-fg-3/70 ${
            role === "customer" ? "hidden sm:block" : ""
          }`}
        >
          <Key>D</Key> demo · <Key>?</Key> how it works
        </p>
      ) : null}
    </div>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="glass mx-0.5 rounded px-1.5 py-0.5 font-sans text-[0.6875rem] text-fg-2">
      {children}
    </kbd>
  );
}
