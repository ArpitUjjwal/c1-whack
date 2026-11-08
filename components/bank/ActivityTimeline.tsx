"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Panel } from "@/components/ui/Panel";
import { clockTime, relativeTime } from "@/lib/format";
import type { AppState, TimelineEvent } from "@/lib/types";

const actorStyles = {
  // The customer's label is their first name, filled in at render.
  customer: { dot: "bg-pos", label: "" },
  agent: { dot: "bg-calm", label: "Agent" },
  system: { dot: "bg-fg-3", label: "System" },
} as const;

/**
 * Behavioural activity timeline.
 *
 * The highlighted entries are behavioural signals — a 14-day silence, a first
 * login after it — which a conventional arrears queue does not record at all.
 * Treating silence as information is what turns a collections call into a
 * support call. Customer actions stream in live as they happen on the phone.
 */
export function ActivityTimeline({
  state,
  now,
  hydrated,
}: {
  state: AppState;
  now: number;
  hydrated: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  const all = [...state.timeline].reverse();
  /** The latest few are what an agent acts on; the rest is one tap away. */
  const LATEST = 5;
  const events = showAll ? all : all.slice(0, LATEST);

  return (
    <Panel className="flex min-h-0 flex-col p-4" aria-labelledby="timeline-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="timeline-heading" className="font-semibold text-fg">
          Account activity
        </h2>
        <span className="text-xs text-fg-3">{state.timeline.length} events</span>
      </div>

      {/* Only when there has actually been a long gap. */}
      {state.customer.daysSinceLastOpen >= 7 ? (
        <p className="mt-2 rounded-lg border border-attn/25 bg-attn-dim px-2.5 py-1.5 text-xs text-fg-2">
          <span className="font-semibold text-attn">Long quiet spell · </span>
          {state.customer.daysSinceLastOpen} days without the app
          {state.customer.openedAppToday ? ", back today" : ""}. Emails unopened — the
          channel failed, not the customer.
        </p>
      ) : null}

      <ol
        aria-live="polite"
        aria-relevant="additions"
        className="mt-3 min-h-0 flex-1 space-y-0 pr-1"
      >
        <AnimatePresence initial={false}>
          {events.map((event) => (
            <motion.li
              key={event.id}
              layout
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25 }}
              className="relative flex gap-3 pb-2.5"
            >
              <Spine event={event} />
              <div className="min-w-0 pt-0.5">
                <p className="text-sm leading-snug font-medium text-fg">{event.title}</p>
                {event.detail ? (
                  <p className="mt-0.5 line-clamp-2 text-xs text-fg-2">{event.detail}</p>
                ) : null}
                <p className="mt-0.5 text-xs text-fg-3">
                  {event.actor === "customer"
                    ? state.customer.firstName
                    : actorStyles[event.actor].label}
                  {hydrated
                    ? ` · ${clockTime(event.at)} · ${relativeTime(event.at, now)}`
                    : ""}
                </p>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
      {all.length > LATEST ? (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          aria-expanded={showAll}
          className="mt-1 min-h-[44px] self-start text-sm font-semibold text-link hover:text-fg"
        >
          {showAll ? "Show latest only" : `Show all ${all.length}`}
        </button>
      ) : null}
    </Panel>
  );
}

function Spine({ event }: { event: TimelineEvent }) {
  const style = actorStyles[event.actor];
  return (
    <span className="relative flex w-3 shrink-0 justify-center">
      <span aria-hidden="true" className="absolute top-4 bottom-0 w-px bg-edge" />
      <span
        aria-hidden="true"
        className={`relative mt-1.5 h-2 w-2 rounded-full ${style.dot} ${
          event.highlight ? "ring-4 ring-attn/25" : ""
        }`}
      />
    </span>
  );
}
