"use client";

import { useEffect, useState, type RefObject } from "react";
import { SignalCollector, type StrainReading } from "./engines/signals";
import { useRealtimeSync } from "./realtime";

/** How often strain is re-read. Slow enough to be free, fast enough to feel live. */
const SAMPLE_MS = 1200;

const FOCUSABLE =
  'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"]), [role="button"]';

/**
 * On-device strain estimate, used only to offer a simpler screen.
 *
 * Nothing this hook measures leaves the device. It publishes nothing: no
 * strain, no screen load, no Safe Mode state, not even the timing of a
 * change. The result is returned to the caller — the customer surface — and
 * shown nowhere else except that surface's own `?` overlay.
 *
 * Everything runs from DOM listeners and a timer, never during render, which
 * is both correct React and a hard requirement of this project's build:
 * reading `Date.now()` while rendering fails the Next prerender.
 */
export function useCognitiveMonitor({
  rootRef,
  daysSinceLastOpen,
  enabled = true,
}: {
  rootRef: RefObject<HTMLElement | null>;
  daysSinceLastOpen: number;
  enabled?: boolean;
}) {
  const { onSignal } = useRealtimeSync();

  /*
    The collector is a mutable instance the caller needs back, so it is held
    in state rather than a ref: a ref cannot be read during render, and
    `useState` with an initialiser constructs it exactly once per mount.
  */
  const [collector] = useState(() => new SignalCollector());

  /* Local only. Set from the sampling timer, never during render. */
  const [strain, setStrain] = useState<StrainReading | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const root = rootRef.current;
    collector.start(Date.now());
    let lastStrain = -1;

    const onScroll = (event: Event) => {
      const target = event.target as HTMLElement | null;
      collector.recordScroll(target?.scrollTop ?? window.scrollY, Date.now());
    };

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      // Demo chrome is not part of the customer's screen.
      if (target.closest("[data-load-ignore]")) return;
      const now = Date.now();
      if (target.closest(FOCUSABLE)) collector.recordInteraction(now);
      // A tap that hit nothing: looking for a control that isn't there.
      else collector.recordDeadTap(now);
    };

    const onKeyDown = () => collector.recordInteraction(Date.now());

    root?.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);

    const unsubscribe = onSignal((signal) => {
      if (signal.type === "demo_action" && signal.action === "inject_strain") {
        collector.injectStrain(Date.now());
      }
    });

    const sample = () => {
      const reading = collector.read(Date.now(), {
        daysSinceLastOpen,
        hour: new Date().getHours(),
      });
      if (reading.score !== lastStrain) {
        lastStrain = reading.score;
        setStrain(reading);
      }
    };

    sample();
    const timer = window.setInterval(sample, SAMPLE_MS);

    return () => {
      window.clearInterval(timer);
      root?.removeEventListener("scroll", onScroll);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
      unsubscribe();
    };
  }, [enabled, rootRef, onSignal, collector, daysSinceLastOpen]);

  return { collector, strain: enabled ? strain : null };
}
