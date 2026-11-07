"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { measureLoad } from "./engines/cognitive-load";
import { SignalCollector, type StrainReading } from "./engines/signals";
import { useRealtimeSync } from "./realtime";

/** How often the screen is re-measured. Slow enough to be free, fast enough to feel live. */
const SAMPLE_MS = 1200;

const FOCUSABLE =
  'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"]), [role="button"]';

/**
 * Drives the Cognitive Load Meter and the strain estimate.
 *
 * What crosses to the other window, and what does not:
 *  · Published: the screen's cognitive load (a property of the screen), the
 *    current view, and whether Focus Mode is on (Alex's own choice).
 *  · Never published: interaction strain. It is a reading about the person,
 *    so it stays in this tab — returned to the caller and nowhere else. It is
 *    also left out of the publish fingerprint, so not even the *timing* of a
 *    publish can reveal that strain moved.
 *
 * Everything here runs from DOM listeners and a timer — never during render —
 * which is both correct React and a hard requirement of this project's build:
 * reading `Date.now()` while rendering fails the Next prerender.
 *
 * The hook only measures and reports. The decision to offer Focus Mode, and
 * the decision to accept it, are made elsewhere and by the customer.
 */
export function useCognitiveMonitor({
  rootRef,
  daysSinceLastOpen,
  focusMode,
  view,
  enabled = true,
}: {
  rootRef: RefObject<HTMLElement | null>;
  daysSinceLastOpen: number;
  focusMode: boolean;
  view: string;
  enabled?: boolean;
}) {
  const { publishTelemetry, onSignal } = useRealtimeSync();

  /*
    The collector is a mutable instance the caller needs back, so it is held
    in state rather than a ref: a ref cannot be read during render, and
    `useState` with an initialiser constructs it exactly once per mount.
  */
  const [collector] = useState(() => new SignalCollector());

  /* Local only. Set from the sampling timer, never during render. */
  const [strain, setStrain] = useState<StrainReading | null>(null);

  // Latest values, so the sampling timer never closes over a stale render.
  // Written from an effect — assigning to a ref during render is not allowed.
  const metaRef = useRef({ daysSinceLastOpen, focusMode, view });
  useEffect(() => {
    metaRef.current = { daysSinceLastOpen, focusMode, view };
  }, [daysSinceLastOpen, focusMode, view]);

  useEffect(() => {
    if (!enabled) return;

    const root = rootRef.current;
    let lastStrain = -1;
    collector.start(Date.now());

    /* ------------------------------------------------------- listeners -- */

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
      if (target.closest(FOCUSABLE)) {
        collector.recordInteraction(now);
      } else {
        // A tap that hit nothing: looking for a control that isn't there.
        collector.recordDeadTap(now);
      }
    };

    const onKeyDown = () => collector.recordInteraction(Date.now());

    root?.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);

    /* --------------------------------------------- director instructions */

    const unsubscribe = onSignal((signal) => {
      if (signal.type === "demo_action" && signal.action === "inject_strain") {
        collector.injectStrain(Date.now());
      }
    });

    /* ----------------------------------------------------- sample timer -- */

    let lastPublished = "";

    const sample = () => {
      const now = Date.now();
      const meta = metaRef.current;
      const load = measureLoad(rootRef.current);
      const strain = collector.read(now, {
        daysSinceLastOpen: meta.daysSinceLastOpen,
        hour: new Date().getHours(),
      });

      if (strain.score !== lastStrain) {
        lastStrain = strain.score;
        setStrain(strain);
      }

      // Only publish on a real change, so a quiet screen costs nothing.
      // Strain is deliberately absent from both the fingerprint and the payload.
      const fingerprint = `${load.score}|${meta.focusMode}|${meta.view}`;
      if (fingerprint === lastPublished) return;
      lastPublished = fingerprint;

      publishTelemetry({
        load: load.score,
        loadBand: load.band,
        focusMode: meta.focusMode,
        view: meta.view,
        at: now,
      });
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
  }, [enabled, rootRef, publishTelemetry, onSignal, collector]);

  return { collector, strain: enabled ? strain : null };
}

/** Read the current strain without waiting for the next publish. */
export function readStrain(
  collector: SignalCollector,
  daysSinceLastOpen: number,
): ReturnType<SignalCollector["read"]> {
  return collector.read(Date.now(), {
    daysSinceLastOpen,
    hour: new Date().getHours(),
  });
}
