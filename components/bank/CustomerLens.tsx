"use client";

import { Meter } from "@/components/ui/Meter";
import { Panel } from "@/components/ui/Panel";
import { StatusPill } from "@/components/ui/StatusPill";
import { LiveDot } from "@/components/ui/LiveDot";
import { FOCUS_TARGET } from "@/lib/engines/cognitive-load";
import type { Telemetry } from "@/lib/types";

/**
 * What the customer's *screen* is asking of them, live.
 *
 * Deliberately limited to facts about the screen and choices the customer
 * made. Screen load is a property of the interface, so it is ours to watch.
 * Focus Mode on or off is Alex's own decision, so the agent should know it.
 *
 * What is not here, on purpose: any reading of how Alex is coping. The strain
 * estimate that drives the Focus offer stays on Alex's device. A bank
 * watching a customer's state of mind in real time is the inferred-health-
 * data problem, whatever the intention.
 */
export function CustomerLens({
  telemetry,
  online,
  adaptiveEnabled,
}: {
  telemetry: Telemetry | null;
  online: boolean;
  adaptiveEnabled: boolean;
}) {
  if (!adaptiveEnabled) {
    return (
      <Panel className="p-5" aria-labelledby="lens-heading">
        <h2 id="lens-heading" className="font-semibold text-fg">
          Screen lens
        </h2>
        <p className="mt-2 text-sm text-fg-2">
          Alex has turned the adaptive screen off. Nothing is measured on their
          phone, and the app won&apos;t offer Focus Mode.
        </p>
        <p className="mt-2 text-xs text-fg-3">
          Their choice, from the &ldquo;What Clarity notices&rdquo; panel in the app.
        </p>
      </Panel>
    );
  }

  if (!telemetry || !online) {
    return (
      <Panel className="p-5" aria-labelledby="lens-heading">
        <h2 id="lens-heading" className="font-semibold text-fg">
          Screen lens
        </h2>
        <p className="mt-2 flex items-center gap-2 text-sm text-fg-3">
          <LiveDot online={false} />
          No customer window open. The screen&apos;s load appears here when Alex
          is in the app.
        </p>
      </Panel>
    );
  }

  const loadTone =
    telemetry.load <= 40 ? "pos" : telemetry.load <= 65 ? "attn" : "red";

  return (
    <Panel bloom="link" className="p-5" aria-labelledby="lens-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="lens-heading" className="font-semibold text-fg">
          Screen lens
        </h2>
        <StatusPill tone="pos">
          <span className="breathe" aria-hidden="true">
            ●
          </span>
          Live
        </StatusPill>
      </div>
      <p className="mt-1 text-sm text-fg-3">
        What Alex&apos;s screen is asking of them. A property of the screen, not
        of the person.
      </p>

      <dl className="mt-4 space-y-4">
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-sm text-fg-2">Cognitive load of the screen</dt>
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
      </dl>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-edge pt-3">
        <StatusPill tone="link">Viewing · {telemetry.view}</StatusPill>
        <StatusPill tone={telemetry.focusMode ? "calm" : "neutral"}>
          Focus Mode {telemetry.focusMode ? "on" : "off"} · Alex&apos;s choice
        </StatusPill>
      </div>

      {telemetry.focusMode ? (
        <p className="mt-3 rounded-xl border border-calm/25 bg-calm-dim p-3 text-sm text-fg-2">
          Alex has simplified the screen. They are seeing one decision and
          nothing else — keep your message to that one thing.
        </p>
      ) : null}

      <p className="mt-3 text-xs text-fg-3">
        Not shown, by design: how Alex appears to be finding it. That reading
        stays on their phone and is never sent here.
      </p>
    </Panel>
  );
}
