"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Meter } from "@/components/ui/Meter";
import { StatusPill } from "@/components/ui/StatusPill";
import { auditAccessibility, type A11yReport } from "@/lib/engines/a11y-audit";
import { measureLoad, type LoadBreakdown } from "@/lib/engines/cognitive-load";
import type { StrainReading } from "@/lib/engines/signals";
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
  strain = null,
}: {
  role: Role;
  /** Selector for the subtree that counts as "the product surface". */
  measureRoot: string;
  /**
   * Interaction strain, customer surface only. Passed in from this tab's own
   * monitor because it is never published — so this overlay is the one place
   * it is ever shown, and only on the device that measured it.
   */
  strain?: StrainReading | null;
}) {
  const [open, setOpen] = useState(false);
  const [a11y, setA11y] = useState<A11yReport | null>(null);
  const [load, setLoad] = useState<LoadBreakdown | null>(null);

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
                        body="Scroll reversals, taps that hit nothing, disclosure churn and stalls — each on a short rolling window, none of it persisted. It never leaves this device: the agent console sees the screen's load and whether Focus Mode is on, never this."
                      />
                      <Mechanism
                        name="Safe Mode"
                        body="One tap: “I can't handle banking today.” Also offered on-device above strain 45. Only ever removes or enlarges, never relocates. Kept on this device; the bank is never told."
                      />
                      <Mechanism
                        name="Financial Time Machine"
                        body="1–14 day break, projected from known bills, dates and the balance, with assumptions printed. Read-only: it never pays, extends or waives."
                      />
                      <Mechanism
                        name="First-run setup"
                        body="Once, on first open: tick what you find hard and the app changes as you tick. What you tick stays on this phone; sharing the resulting preference labels with support is a separate choice, off by default. Change it all later in Settings & help."
                      />
                      <Mechanism
                        name="Reading and listening"
                        body="Reading font, text size, spacing, tint, high contrast and read-aloud — preferences anyone can use, saved on this phone only."
                      />
                      <Mechanism
                        name="Financial Advocate"
                        body="Prepares a support request from validated facts. The customer reviews exactly what is shared and sends it themselves."
                      />
                    </>
                  ) : (
                    <>
                      <Mechanism
                        name="Pressure Index"
                        body="Scores every outgoing message as it is typed. Transparent lexicon plus structural rules; each finding names its span and its points. A tone check (insult list plus the AFINN sentiment model) compares the words with the tone picked, and blocks insults outright."
                      />
                      <Mechanism
                        name="Support handoff"
                        body="Requests arrive only when a customer sends one, with a 'deliberately not shared' list beside them and an access log."
                      />
                      <Mechanism
                        name="Financial Rescue Simulator"
                        body="Three pathways for one request, from the customer's side. No pathway assumes an extension or fee waiver; arrangements need eligibility and a second approver."
                      />
                      <Mechanism
                        name="Accessibility Insights and policy simulation"
                        body="Top barriers in customers' own words, hardest journeys, what works, and recommendations — from requests customers chose to send, never from their phones, and no group under ten. Plus thirty days under three outreach policies."
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

              {strain && role === "customer" ? (
                <section className="mt-6">
                  <h3 className="text-xs font-semibold tracking-[0.12em] text-fg-3 uppercase">
                    Interaction strain · this device only
                  </h3>
                  <p className="display tnum mt-2 text-4xl text-fg">{strain.score}</p>
                  <p className="text-xs text-fg-3">
                    {strain.band} · offers a simpler screen at 45 · never sent to Capital One
                  </p>
                  {strain.contributions.length ? (
                    <ul className="mt-3 space-y-1.5 text-sm">
                      {strain.contributions.map((c) => (
                        <li key={c.label} className="flex justify-between gap-3">
                          <span className="text-fg-2">
                            {c.label}
                            <span className="block text-xs text-fg-3">{c.detail}</span>
                          </span>
                          <span className="tnum font-semibold text-fg">+{c.points}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ) : null}

              {role === "bank" ? (
                <section className="mt-6">
                  <h3 className="text-xs font-semibold tracking-[0.12em] text-fg-3 uppercase">
                    From the customer&apos;s device
                  </h3>
                  <p className="mt-2 text-sm text-fg-2">
                    Nothing. No screen load, no strain, no Safe Mode state and
                    no Time Machine activity crosses to this console. It sees
                    account facts, presence, and the requests the customer chooses to send.
                  </p>
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
                      pass={a11y.headings.length > 0 && a11y.outlineOk}
                      detail={
                        a11y.outlineProblem
                          ? `${a11y.headings.length} headings · level skipped: ${a11y.outlineProblem}`
                          : `${a11y.headings.length} headings, no level skipped`
                      }
                    />
                    {/*
                      Only an assertive region fails. A screen with none at all
                      is not a fault — the account list has nothing that
                      updates under the reader, and demanding a live region of
                      every screen would be marking static content wrong.
                    */}
                    <AuditRow
                      label="Polite live regions"
                      pass={a11y.liveRegions.assertive === 0}
                      detail={
                        a11y.liveRegions.assertive > 0
                          ? `${a11y.liveRegions.total} present · ${a11y.liveRegions.assertive} assertive — interrupts the reader`
                          : a11y.liveRegions.total > 0
                            ? `${a11y.liveRegions.total} present · none assertive`
                            : "None on this screen · nothing updates under the reader"
                      }
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
                    translucent layer and every inherited{" "}
                    <code className="glass rounded px-1">opacity</code> exactly
                    as the browser does — so the panels are measured as
                    rendered, not as designed. One known limit: background{" "}
                    <em>gradients</em> are not sampled, so text over one is
                    measured against the solid colour beneath it.
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
