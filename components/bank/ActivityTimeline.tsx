"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Panel } from "@/components/ui/Panel";
import { clockTime, relativeTime } from "@/lib/format";
import type { AppState, TimelineEvent } from "@/lib/types";

const actorStyles = {
  customer: { dot: "bg-pos", label: "Alex" },
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
  const events = [...state.timeline].reverse();

  return (
    <Panel className="flex min-h-0 flex-col p-5" aria-labelledby="timeline-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="timeline-heading" className="font-semibold text-fg">
          Behavioural activity
        </h2>
        <span className="text-xs text-fg-3">{state.timeline.length} events</span>
      </div>

      {/* The signal the rest of the console is built around. */}
      <div className="mt-3 rounded-xl border border-attn/25 bg-attn-dim p-3.5">
        <p className="text-xs font-semibold tracking-[0.12em] text-attn uppercase">
          Avoidance pattern detected
        </p>
        <p className="mt-1.5 text-[0.9375rem] font-medium text-fg">
          No app activity for {state.customer.daysSinceLastOpen} days
          {state.customer.openedAppToday ? " — logged in today." : "."}
        </p>
        <p className="mt-1 text-sm text-fg-2">
          Three reminder emails sent, none opened. The channel failed, not the
          customer. Route to proactive support rather than the standard arrears
          cadence.
        </p>
      </div>

      <ol
        aria-live="polite"
        aria-relevant="additions"
        className="mt-4 max-h-[26rem] min-h-0 flex-1 space-y-0 overflow-y-auto pr-1"
      >
        <AnimatePresence initial={false}>
          {events.map((event) => (
            <motion.li
              key={event.id}
              layout
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25 }}
              className="relative flex gap-3 pb-4"
            >
              <Spine event={event} />
              <div className="min-w-0 pt-0.5">
                <p className="text-[0.9375rem] leading-snug font-medium text-fg">
                  {event.title}
                </p>
                {event.detail ? (
                  <p className="mt-0.5 text-sm text-fg-2">{event.detail}</p>
                ) : null}
                <p className="mt-1 text-xs text-fg-3">
                  {actorStyles[event.actor].label}
                  {hydrated
                    ? ` · ${clockTime(event.at)} · ${relativeTime(event.at, now)}`
                    : ""}
                </p>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
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
