"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Disclosure } from "@/components/ui/Disclosure";
import { Panel } from "@/components/ui/Panel";
import { StatusPill } from "@/components/ui/StatusPill";
import { money } from "@/lib/format";
import {
  SIMULATION_ASSUMPTIONS,
  runSimulation,
  type SimOutcome,
} from "@/lib/engines/simulation";

/**
 * Thirty days, three policies, side by side.
 *
 * The product argument is an outcome argument, so this plays it out rather
 * than asserting it. The middle lane carries the claim: Clarity's design on
 * its own, with nothing given away. Concessions sit in a third lane so a
 * judge can see they are optional extras, not the mechanism. Deterministic — identical on every run — and every
 * assumption behind it is printed underneath, because a simulation whose
 * numbers cannot be inspected is just an animation.
 */
export function SimulationTrack() {
  const result = useMemo(() => runSimulation(), []);
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);
  const reduceMotion = useReducedMotion();

  const totalSteps = Math.max(
    result.standard.events.length,
    result.design.events.length,
    result.extras.events.length,
  );

  /*
    Derived rather than stored: the run stops when the last step is revealed,
    so nothing has to flip a flag from inside the effect.
  */
  const playing = running && step < totalSteps;

  useEffect(() => {
    if (!playing) return;
    const t = window.setTimeout(() => setStep((s) => s + 1), reduceMotion ? 120 : 620);
    return () => window.clearTimeout(t);
  }, [playing, step, reduceMotion]);

  const start = () => {
    setStep(0);
    setRunning(true);
  };

  const revealed = playing || step > 0 ? step : totalSteps;

  return (
    <Panel className="p-5" aria-labelledby="sim-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="sim-heading" className="font-semibold text-fg">
            Thirty days, three policies
          </h2>
          <p className="mt-1 text-sm text-fg-3">
            The same customer, the same arrears, different outreach. The middle
            lane gives nothing away. Deterministic — it runs the same way every time.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={start} disabled={playing}>
          {playing ? "Running…" : step > 0 ? "Run it again" : "Run the simulation"}
        </Button>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Track outcome={result.standard} revealed={revealed} />
        <Track outcome={result.design} revealed={revealed} />
        <Track outcome={result.extras} revealed={revealed} />
      </div>

      <div className="mt-5 border-t border-edge pt-3">
        <Disclosure label="Show the assumptions">
          <ul className="space-y-1.5 text-sm text-fg-2">
            {SIMULATION_ASSUMPTIONS.map((a) => (
              <li key={a} className="flex gap-2">
                <span aria-hidden="true" className="text-fg-3">
                  ·
                </span>
                {a}
              </li>
            ))}
          </ul>
        </Disclosure>
      </div>
    </Panel>
  );
}

const LANE: Record<
  SimOutcome["policy"],
  { pill: string; tone: "red" | "pos" | "calm"; cost: string }
> = {
  standard: { pill: "Today", tone: "red", cost: "Cost of this policy: the customer, and the £41." },
  design: { pill: "The claim", tone: "pos", cost: "Nothing given away. The fee stands, the date doesn't move." },
  extras: { pill: "Optional", tone: "calm", cost: "Faster by a day, for an extension and a £12 refund after paying." },
};

function Track({
  outcome,
  revealed,
}: {
  outcome: SimOutcome;
  revealed: number;
}) {
  const lane = LANE[outcome.policy];
  const tone = lane.tone;
  const accent = tone === "pos" ? "text-pos" : tone === "calm" ? "text-calm" : "text-red-fg";
  const events = outcome.events.slice(0, revealed);
  const done = revealed >= outcome.events.length;

  return (
    <section
      aria-label={outcome.label}
      className="glass rounded-xl2 p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-fg">{outcome.label}</h3>
        <StatusPill tone={tone}>{lane.pill}</StatusPill>
      </div>

      <ol className="mt-4 space-y-0">
        <AnimatePresence initial={false}>
          {events.map((e, i) => (
            <motion.li
              key={`${e.day}-${e.label}-${i}`}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25 }}
              className="relative flex gap-3 pb-3.5"
            >
              <span className="relative flex w-10 shrink-0 justify-end pt-0.5">
                <span className="tnum text-xs font-semibold text-fg-3">
                  Day {e.day}
                </span>
              </span>
              <span
                aria-hidden="true"
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                  e.kind === "resolve"
                    ? "bg-pos"
                    : e.kind === "support"
                      ? "bg-link"
                      : e.kind === "extra"
                        ? "bg-calm"
                      : e.kind === "harm"
                        ? "bg-red"
                        : e.kind === "pressure"
                          ? "bg-attn"
                          : "bg-fg-3"
                }`}
              />
              <span className="min-w-0 flex-1">
                <span
                  className={`block text-sm font-medium ${
                    e.kind === "resolve" ? "text-pos" : "text-fg"
                  }`}
                >
                  {e.label}
                </span>
                <span className="block text-xs text-fg-3">{e.detail}</span>
                <span className="tnum mt-0.5 block text-xs text-fg-3">
                  engagement {e.engagement.toFixed(2)}
                </span>
              </span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>

      {done ? (
        <motion.dl
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-2 space-y-1.5 border-t border-edge pt-3 text-sm"
        >
          <Outcome
            label="Resolved"
            value={outcome.resolvedOn !== null ? `Day ${outcome.resolvedOn}` : "Not resolved"}
            good={outcome.resolvedOn !== null}
          />
          <Outcome
            label="Fees charged"
            value={money(outcome.feesCharged)}
            good={outcome.feesCharged === 0}
            neutral={outcome.policy === "design"}
          />
          <Outcome
            label="Credit file"
            value={outcome.reportedToBureau ? "Reported — six years" : "Nothing reported"}
            good={!outcome.reportedToBureau}
          />
          <Outcome
            label="Concessions"
            value={outcome.concessions.length ? `${outcome.concessions.length} optional` : "None"}
            good={outcome.concessions.length === 0}
            neutral={outcome.policy === "standard"}
          />
          <Outcome
            label="Willingness to engage again"
            value={outcome.finalEngagement.toFixed(2)}
            good={outcome.finalEngagement >= 0.5}
          />
        </motion.dl>
      ) : null}

      {done ? (
        <p className={`mt-3 text-sm font-semibold ${accent}`}>{lane.cost}</p>
      ) : null}
    </section>
  );
}

function Outcome({
  label,
  value,
  good,
  neutral = false,
}: {
  label: string;
  value: string;
  good: boolean;
  neutral?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-fg-3">{label}</dt>
      <dd
        className={`font-semibold ${neutral ? "text-fg-2" : good ? "text-pos" : "text-red-fg"}`}
      >
        {value}
      </dd>
    </div>
  );
}
