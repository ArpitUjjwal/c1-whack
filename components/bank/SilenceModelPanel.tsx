"use client";

import { useState } from "react";
import { Meter } from "@/components/ui/Meter";
import { Panel } from "@/components/ui/Panel";
import { StatusPill } from "@/components/ui/StatusPill";
import { Disclosure } from "@/components/ui/Disclosure";
import { RISK_BAND_COPY, type SilenceReading } from "@/lib/engines/silence-model";

/**
 * The Silence Model, with its working shown.
 *
 * Every feature, its weight, and its individual contribution are on screen,
 * and the panel states plainly that the weights are hand-tuned rather than
 * learned. A console that says "risk: 57" and nothing else asks an agent to
 * trust it; this one asks them to check it, and lets them disagree with a
 * specific number rather than with the whole idea.
 */
export function SilenceModelPanel({ reading }: { reading: SilenceReading }) {
  const [showWeights, setShowWeights] = useState(false);
  const band = RISK_BAND_COPY[reading.band];

  return (
    <Panel
      bloom={reading.band === "low" ? "pos" : "attn"}
      className="p-5"
      aria-labelledby="silence-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="silence-heading" className="font-semibold text-fg">
          Silence Model
        </h2>
        <StatusPill tone={band.tone === "pos" ? "pos" : band.tone === "attn" ? "attn" : "red"}>
          {band.label}
        </StatusPill>
      </div>
      <p className="mt-1 text-sm text-fg-3">
        Reads not-opening-the-app as information, rather than as the absence of it.
      </p>

      <div className="mt-4 flex items-end justify-between gap-4">
        <div>
          <p
            className={`display tnum text-[2.75rem] ${
              band.tone === "pos" ? "text-pos" : band.tone === "attn" ? "text-attn" : "text-red-fg"
            }`}
          >
            {reading.score}
          </p>
          <p className="text-xs text-fg-3">disengagement risk, 0–100</p>
        </div>
      </div>

      <Meter
        className="mt-3"
        value={reading.score}
        tone={band.tone === "pos" ? "pos" : band.tone === "attn" ? "attn" : "red"}
        label="Disengagement risk"
        valueText={`${reading.score} of 100 — ${band.label}`}
        height="lg"
      />

      {/* --------------------------------------------- feature contributions */}
      <ul className="mt-5 space-y-3">
        {reading.features.map((f) => (
          <li key={f.id}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-fg">{f.label}</span>
              <span className="tnum shrink-0 text-fg-2">
                {f.raw}
                <span className="ml-2 font-semibold text-fg">+{f.contribution}</span>
              </span>
            </div>
            <Meter
              className="mt-1.5"
              value={f.contribution}
              max={f.weight}
              tone="link"
              height="sm"
              label={`${f.label}: contributes ${f.contribution} of a possible ${f.weight} points`}
              valueText={`${f.contribution} of ${f.weight} points`}
            />
            {showWeights ? (
              <p className="mt-1 text-xs text-fg-3">
                Weight {f.weight}. {f.why}
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => setShowWeights((v) => !v)}
        className="mt-3 min-h-11 text-sm font-semibold text-link hover:text-fg"
      >
        {showWeights ? "Hide the weights" : "Show the weights and why"}
      </button>

      {/* --------------------------------------------------- channel odds -- */}
      <div className="mt-5 border-t border-edge pt-4">
        <h3 className="text-xs font-semibold tracking-[0.12em] text-fg-3 uppercase">
          Modelled chance of a response
        </h3>
        <ul className="mt-3 space-y-2.5">
          {reading.channels.map((c, i) => (
            <li key={c.id}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className={i === 0 ? "font-semibold text-fg" : "text-fg-2"}>
                  {c.label}
                  {i === 0 ? (
                    <span className="ml-2 text-xs font-normal text-pos">best odds</span>
                  ) : null}
                </span>
                <span className="tnum font-semibold text-fg">
                  {Math.round(c.probability * 100)}%
                </span>
              </div>
              <Meter
                className="mt-1"
                value={c.probability * 100}
                tone={i === 0 ? "pos" : "link"}
                height="sm"
                label={`${c.label}: ${Math.round(c.probability * 100)} percent modelled response rate`}
              />
              <ul className="mt-1 space-y-0.5">
                {c.factors.map((f) => (
                  <li key={f.label} className="text-xs text-fg-3">
                    {f.delta >= 0 ? "+" : "−"}
                    {Math.abs(Math.round(f.delta * 100))} · {f.label}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>

      {/* ------------------------------------------------- recommendation -- */}
      <div className="mt-5 rounded-xl border border-link/25 bg-link-dim p-3.5">
        <p className="text-xs font-semibold tracking-[0.12em] text-link uppercase">
          Recommended next step
        </p>
        <p className="mt-1.5 text-[0.9375rem] font-medium text-fg">
          {reading.recommendation}
        </p>
      </div>

      <div className="mt-4 border-t border-edge pt-3">
        <Disclosure label="What this model is, and isn't">
          <p className="text-sm text-fg-2">
            Six features, hand-tuned weights, arithmetic you can check above.
            It is <strong className="font-semibold text-fg">not trained</strong>{" "}
            on real customer data and it makes no claim to accuracy — it is a
            way of making an assumption explicit so an agent can argue with a
            specific number instead of with a black box.
          </p>
          <p className="mt-2 text-sm text-fg-2">
            A real deployment would need validation against outcomes, fairness
            testing across protected groups, and a route for a customer to see
            and contest their own score.
          </p>
        </Disclosure>
      </div>
    </Panel>
  );
}
