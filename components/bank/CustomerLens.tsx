"use client";

import { Meter } from "@/components/ui/Meter";
import { Panel } from "@/components/ui/Panel";
import { StatusPill } from "@/components/ui/StatusPill";
import { LiveDot } from "@/components/ui/LiveDot";
import { FOCUS_OFFER_THRESHOLD } from "@/lib/engines/signals";
import { FOCUS_TARGET } from "@/lib/engines/cognitive-load";
import type { Telemetry } from "@/lib/types";

/**
 * What the customer's screen is costing them, live.
 *
 * This is the half of the Cognitive Load mechanism the customer never sees —
 * deliberately. Telling someone "you appear to be struggling" is its own
 * small humiliation, so the meter lives here and on the judge overlay, and
 * Alex only ever sees a plain-language offer to simplify the screen.
 *
 * For the agent it answers the question no console answers today: not what
 * the customer did, but how hard they are finding it right now.
 */
export function CustomerLens({
  telemetry,
  online,
}: {
  telemetry: Telemetry | null;
  online: boolean;
}) {
  if (!telemetry || !online) {
    return (
      <Panel className="p-5" aria-labelledby="lens-heading">
        <h2 id="lens-heading" className="font-semibold text-fg">
          Customer lens
        </h2>
        <p className="mt-2 flex items-center gap-2 text-sm text-fg-3">
          <LiveDot online={false} />
          No customer window open. Live measurements appear here when Alex is in
          the app.
        </p>
      </Panel>
    );
  }

  const loadTone =
    telemetry.load <= 40 ? "pos" : telemetry.load <= 65 ? "attn" : "red";
  const strainTone =
    telemetry.strain < 25 ? "pos" : telemetry.strain < FOCUS_OFFER_THRESHOLD ? "attn" : "red";

  return (
    <Panel bloom={strainTone === "red" ? "attn" : "link"} className="p-5" aria-labelledby="lens-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="lens-heading" className="font-semibold text-fg">
          Customer lens
        </h2>
        <StatusPill tone="pos">
          <span className="breathe" aria-hidden="true">
            ●
          </span>
          Live
        </StatusPill>
      </div>
      <p className="mt-1 text-sm text-fg-3">
        Measured on Alex&apos;s device, updated every 1.2 seconds.
      </p>

      <dl className="mt-4 space-y-4">
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-sm text-fg-2">Cognitive load of their screen</dt>
            <dd className="tnum text-lg font-semibold text-fg">{telemetry.load}</dd>
          </div>
          <Meter
            className="mt-1.5"
            value={telemetry.load}
            tone={loadTone}
            label="Cognitive load of the customer's current screen"
            valueText={`${telemetry.load} of 100 — ${telemetry.loadBand}`}
          />
          <p className="mt-1 text-xs text-fg-3">
            {telemetry.loadBand} · Focus Mode targets {FOCUS_TARGET} or below
          </p>
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-sm text-fg-2">Interaction strain</dt>
            <dd className="tnum text-lg font-semibold text-fg">{telemetry.strain}</dd>
          </div>
          <Meter
            className="mt-1.5"
            value={telemetry.strain}
            tone={strainTone}
            label="How hard the customer appears to be finding the screen"
            valueText={`${telemetry.strain} of 100 — ${telemetry.strainBand}`}
          />
          <p className="mt-1 text-xs text-fg-3">
            {telemetry.strainBand} · the app offers to simplify at{" "}
            {FOCUS_OFFER_THRESHOLD}
          </p>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-edge pt-3">
        <StatusPill tone="link">Viewing · {telemetry.view}</StatusPill>
        <StatusPill tone={telemetry.focusMode ? "calm" : "neutral"}>
          Focus Mode {telemetry.focusMode ? "on" : "off"}
        </StatusPill>
      </div>

      {telemetry.focusMode ? (
        <p className="mt-3 rounded-xl border border-calm/25 bg-calm-dim p-3 text-sm text-fg-2">
          Alex has simplified the screen. They are seeing one decision and
          nothing else — keep your message to that one thing.
        </p>
      ) : null}
    </Panel>
  );
}
