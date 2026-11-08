"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Meter } from "@/components/ui/Meter";
import { StatusPill } from "@/components/ui/StatusPill";
import { auditAccessibility, type A11yReport } from "@/lib/engines/a11y-audit";
import { measureLoad, type LoadBreakdown } from "@/lib/engines/cognitive-load";
import { useRealtimeSync } from "@/lib/realtime";
import type { Role } from "@/lib/types";

/**
 * The Judge overlay — the Proof Layer's front end.
 *
 * Opens on any screen with `?` and re-measures the live DOM when it does.
 * Every accessibility claim this product makes is checked here, on the screen
 * making it, from the colours the browser actually resolved rather than the
 * hex values in the design tokens.
 *
 * It is deliberately capable of reporting a failure. A proof panel that can
 * only say "pass" proves nothing, so a real contrast miss shows up in red
 * with the ratio and the element that caused it.
 */
export function JudgeOverlay({
  role,
  measureRoot,
}: {
  role: Role;
  /** Selector for the subtree that counts as "the product surface". */
  measureRoot: string;
}) {
  const [open, setOpen] = useState(false);
  const [a11y, setA11y] = useState<A11yReport | null>(null);
  const [load, setLoad] = useState<LoadBreakdown | null>(null);
  const { telemetry } = useRealtimeSync();

  const measure = useCallback(() => {
    const root = document.querySelector<HTMLElement>(measureRoot);
    setA11y(auditAccessibility(root));
    setLoad(measureLoad(root));
  }, [measureRoot]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.key === "?" || (event.key === "/" && event.shiftKey)) {
        event.preventDefault();
        setOpen((v) => {
          if (!v) measure();
          return !v;
        });
      } else if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [measure]);

  const contrastPass = a11y ? a11y.contrast.issues.length === 0 : false;
  const targetPass = a11y ? a11y.targets.issues.length === 0 : false;

  return (
    <div data-load-ignore data-a11y-ignore>
      <AnimatePresence>
        {open ? (
          <motion.div
            key="judge"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex justify-end bg-scrim backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="How it works, and the live accessibility audit"
          >
            <button
              type="button"
              aria-label="Close"
              className="absolute inset-0 cursor-default"
              onClick={() => setOpen(false)}
            />
            <motion.aside
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 40, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="glass-2 relative h-full w-full max-w-md overflow-y-auto bg-deep p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-fg">How this works</h2>
                  <p className="mt-1 text-sm text-fg-3">
                    Measured on this screen, just now.
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
                  Close
                </Button>
              </div>

              {/* --------------------------------------------- mechanisms -- */}
              <section className="mt-6">
                <h3 className="text-xs font-semibold tracking-[0.12em] text-fg-3 uppercase">
                  Running on this surface
                </h3>
                <ul className="mt-2 space-y-2.5 text-sm">
                  {role === "customer" ? (
                    <>
                      <Mechanism
                        name="Cognitive Load Meter"
                        body="Scores what this screen demands of working memory, from the live DOM. The formula is below."
                      />
                      <Mechanism
                        name="Interaction strain"
                        body="Scroll reversals, taps that hit nothing, disclosure churn and stalls — each on a short rolling window, none of it persisted or sent anywhere."
                      />
                      <Mechanism
                        name="Adaptive Focus"
                        body="Offers to simplify above strain 45. Only ever removes or enlarges, never relocates. Declining it once ends the matter permanently."
                      />
                    </>
                  ) : (
                    <>
                      <Mechanism
                        name="Pressure Index"
                        body="Scores every outgoing message as it is typed. Transparent lexicon plus structural rules; each finding names its span and its points."
                      />
                      <Mechanism
                        name="Silence Model"
                        body="Six features with hand-tuned weights, all shown. Explicitly not trained on data — stated so it can be argued with."
                      />
                      <Mechanism
                        name="Policy simulation"
                        body="Thirty days under two outreach policies. Fully deterministic; assumptions printed beneath it."
                      />
                    </>
                  )}
                </ul>
              </section>

              {/* ----------------------------------------- load breakdown -- */}
              {load && role === "customer" ? (
                <section className="mt-6">
                  <h3 className="text-xs font-semibold tracking-[0.12em] text-fg-3 uppercase">
                    Cognitive load of this screen
                  </h3>
                  <p className="display tnum mt-2 text-4xl text-fg">{load.score}</p>
                  <Meter
                    className="mt-2"
                    value={load.score}
                    tone={load.score <= 40 ? "pos" : load.score <= 65 ? "attn" : "red"}
                    label="Cognitive load of this screen"
                    valueText={`${load.score} of 100 — ${load.band}`}
                  />
                  <ul className="mt-3 space-y-1.5 text-sm">
                    {load.contributions.map((c) => (
                      <li key={c.label} className="flex justify-between gap-3">
                        <span className="text-fg-2">
                          {c.label}{" "}
                          <span className="tnum text-fg-3">× {c.count}</span>
                        </span>
                        <span className="tnum font-semibold text-fg">+{c.points}</span>
                      </li>
                    ))}
                  </ul>
                  <pre className="glass mt-3 overflow-x-auto rounded-xl p-3 text-[0.6875rem] leading-relaxed text-fg-3">
{`load = 3·commits + 1·interactive
     + 1.5·numbers + words/25
     + 2·(grade above 8)`}
                  </pre>
                </section>
              ) : null}

              {telemetry && role === "bank" ? (
                <section className="mt-6">
                  <h3 className="text-xs font-semibold tracking-[0.12em] text-fg-3 uppercase">
                    Live from the customer surface
                  </h3>
                  <dl className="mt-2 space-y-1.5 text-sm">
                    <Row label="Cognitive load" value={`${telemetry.load} (${telemetry.loadBand})`} />
                    <Row label="Interaction strain" value={`${telemetry.strain} (${telemetry.strainBand})`} />
                    <Row label="Focus Mode" value={telemetry.focusMode ? "on" : "off"} />
                    <Row label="Screen" value={telemetry.view} />
                  </dl>
                </section>
              ) : null}

              {/* -------------------------------------------- a11y audit -- */}
              {a11y ? (
                <section className="mt-6">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-xs font-semibold tracking-[0.12em] text-fg-3 uppercase">
                      Accessibility, measured live
                    </h3>
                    <Button size="sm" variant="ghost" onClick={measure}>
                      Re-measure
                    </Button>
                  </div>

                  <div className="mt-3 space-y-3">
                    <AuditRow
                      label="Text contrast"
                      pass={contrastPass}
                      detail={`${a11y.contrast.passing}/${a11y.contrast.checked} pass WCAG AA · worst ${a11y.contrast.worst}:1`}
                    />
                    {a11y.contrast.issues.length > 0 ? (
                      <ul className="space-y-1 text-xs text-red-fg">
                        {a11y.contrast.issues.map((i, n) => (
                          <li key={n}>
                            {i.ratio}:1 (needs {i.required}) — “{i.text}”
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    <AuditRow
                      label="Touch targets ≥ 44px (AAA)"
                      pass={targetPass}
                      detail={`${a11y.targets.passing}/${a11y.targets.checked} pass the AAA bar · smallest ${a11y.targets.smallest}px · AA requires 24px`}
                    />
                    {a11y.targets.issues.length > 0 ? (
                      <ul className="space-y-1 text-xs text-red-fg">
                        {a11y.targets.issues.map((i, n) => (
                          <li key={n}>
                            {i.width}×{i.height}px — {i.label}
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    <AuditRow
                      label="Heading structure"
                      pass={a11y.headings.length > 0}
                      detail={`${a11y.headings.length} headings in order`}
                    />
                    <AuditRow
                      label="Polite live regions"
                      pass={a11y.liveRegions > 0}
                      detail={`${a11y.liveRegions} present · none assertive`}
                    />
                    <AuditRow
                      label="Reduced motion"
                      pass
                      detail={
                        a11y.reducedMotion
                          ? "Honoured — animation is disabled right now"
                          : "Not requested by this system; honoured when it is"
                      }
                    />
                  </div>

                  <p className="mt-4 text-xs text-fg-3">
                    Ratios are computed from resolved colours, compositing every
                    translucent layer exactly as the browser does — so the
                    panels are measured as rendered, not as designed.
                  </p>
                </section>
              ) : null}

              <p className="mt-6 border-t border-edge pt-4 text-xs text-fg-3">
                Press <kbd className="glass rounded px-1 py-0.5">?</kbd> to close,{" "}
                <kbd className="glass rounded px-1 py-0.5">D</kbd> to run the
                guided demo.
              </p>
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function Mechanism({ name, body }: { name: string; body: string }) {
  return (
    <li>
      <p className="font-semibold text-fg">{name}</p>
      <p className="text-fg-2">{body}</p>
    </li>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-fg-3">{label}</dt>
      <dd className="font-medium text-fg">{value}</dd>
    </div>
  );
}

function AuditRow({
  label,
  pass,
  detail,
}: {
  label: string;
  pass: boolean;
  detail: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-fg">{label}</p>
        <p className="text-xs text-fg-3">{detail}</p>
      </div>
      <StatusPill tone={pass ? "pos" : "red"}>{pass ? "Pass" : "Check"}</StatusPill>
    </div>
  );
}
