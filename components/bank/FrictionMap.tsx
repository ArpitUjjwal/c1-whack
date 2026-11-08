"use client";

import { useState } from "react";
import { Meter } from "@/components/ui/Meter";
import { Panel } from "@/components/ui/Panel";
import { StatusPill } from "@/components/ui/StatusPill";
import { FOCUS_LOAD_AFTER, FOCUS_LOAD_BEFORE } from "@/lib/engines/cognitive-load";

/**
 * Accessibility Friction Map.
 *
 * Analyses where *journeys* are hard, never which *people* are struggling.
 * Aggregated task-completion data from the optional accessible journeys,
 * with no mental-health classifications anywhere in it. It answers a
 * question no accessibility feature can answer about itself: is it actually
 * removing the barrier?
 *
 * All figures are illustrative mock data, labelled as such on screen.
 */

interface Journey {
  id: string;
  name: string;
  /** 0–100, share of started journeys that stall or are abandoned. */
  friction: number;
  band: "High" | "Moderate" | "Lower";
  steps?: { name: string; reached: number }[];
  insight?: string;
}

const JOURNEYS: Journey[] = [
  {
    id: "repay",
    name: "Credit repayment",
    friction: 68,
    band: "High",
    steps: [
      { name: "See the amount due", reached: 100 },
      { name: "Choose the account to pay from", reached: 83 },
      { name: "Terms, APR and options screen", reached: 49 },
      { name: "Confirm the payment", reached: 44 },
    ],
    insight: `Most drop-off happens on the terms and options screen. Fold APR and terms behind "Show the details" and lead with one button — the Safe Mode version of this screen measures ${FOCUS_LOAD_BEFORE} → ${FOCUS_LOAD_AFTER} on cognitive load.`,
  },
  {
    id: "dispute",
    name: "Disputing a transaction",
    friction: 41,
    band: "Moderate",
    insight: "Stalls when asked to choose a dispute category. Offer a plain-language guided route.",
  },
  {
    id: "dd",
    name: "Setting up a Direct Debit",
    friction: 19,
    band: "Lower",
    insight: "Mostly completes. One date picker step causes repeat attempts.",
  },
];

export function FrictionMap() {
  const [open, setOpen] = useState("repay");

  return (
    <Panel className="p-5" aria-labelledby="friction-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="friction-heading" className="font-semibold text-fg">
          Accessibility Friction Map
        </h2>
        <StatusPill tone="neutral">Illustrative data</StatusPill>
      </div>
      <p className="mt-1 text-sm text-fg-3">
        Where customers using the optional accessible journeys get stuck. Journeys,
        not people.
      </p>

      <ul className="mt-4 space-y-3">
        {JOURNEYS.map((j) => (
          <li key={j.id}>
            <button
              type="button"
              onClick={() => setOpen(j.id)}
              aria-expanded={open === j.id}
              className="w-full min-h-11 text-left"
            >
              <span className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium text-fg">{j.name}</span>
                <span className={j.band === "High" ? "text-attn" : j.band === "Moderate" ? "text-calm" : "text-pos"}>
                  {j.band} friction
                </span>
              </span>
              <Meter
                className="mt-1.5"
                value={j.friction}
                tone={j.band === "High" ? "attn" : j.band === "Moderate" ? "calm" : "pos"}
                height="sm"
                label={`${j.name}: friction ${j.friction} of 100`}
                valueText={`${j.friction} of 100 — ${j.band.toLowerCase()} friction`}
              />
            </button>

            {open === j.id ? (
              <div className="mt-2 rounded-xl border border-edge p-3">
                {j.steps ? (
                  <ol className="space-y-1.5 text-sm">
                    {j.steps.map((s, i) => {
                      const prev = i > 0 ? j.steps![i - 1].reached : 100;
                      const drop = prev - s.reached;
                      return (
                        <li key={s.name} className="flex items-baseline justify-between gap-3">
                          <span className="text-fg-2">
                            {i + 1}. {s.name}
                            {drop >= 20 ? (
                              <span className="ml-1.5 text-xs font-semibold text-attn">−{drop}%</span>
                            ) : null}
                          </span>
                          <span className="tnum text-fg">{s.reached}%</span>
                        </li>
                      );
                    })}
                  </ol>
                ) : null}
                {j.insight ? (
                  <p className={`text-sm text-fg-2 ${j.steps ? "mt-2 border-t border-edge pt-2" : ""}`}>
                    <span className="font-semibold text-fg">Suggested fix: </span>
                    {j.insight}
                  </p>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs text-fg-3">
        Example friction indicators only. A real dashboard would define and
        measure these from aggregated, privacy-preserving task-completion data —
        never from mental-health classifications or individual tracking.
      </p>
    </Panel>
  );
}
