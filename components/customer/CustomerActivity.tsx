"use client";

import { Panel } from "@/components/ui/Panel";
import { relativeTime } from "@/lib/format";
import type { TimelineEvent } from "@/lib/types";

/**
 * A short, plain-language history, capped at three entries. A scrolling
 * transaction log is one of the things that makes this app hard to open in
 * the first place.
 */
export function CustomerActivity({
  events,
  now,
  hydrated,
}: {
  events: TimelineEvent[];
  now: number;
  hydrated: boolean;
}) {
  const visible = events
    .filter(
      (e) =>
        !e.title.startsWith("Sent a gentle message") &&
        !e.title.startsWith("Agent note") &&
        !e.title.startsWith("Opened ") &&
        !e.title.startsWith("Offered Focus Mode"),
    )
    .slice(-3)
    .reverse();

  if (visible.length === 0) return null;

  return (
    <Panel className="p-5" aria-labelledby="activity-heading">
      <h2 id="activity-heading" className="font-semibold text-fg">
        What&apos;s happened lately
      </h2>
      <ul className="mt-3 space-y-3">
        {visible.map((event) => (
          <li key={event.id} className="flex gap-3">
            <span
              aria-hidden="true"
              className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                event.actor === "agent"
                  ? "bg-calm"
                  : event.actor === "customer"
                    ? "bg-pos"
                    : "bg-fg-3"
              }`}
            />
            <span className="min-w-0">
              <span className="block text-[0.9375rem] text-fg">{event.title}</span>
              <span className="block text-xs text-fg-3">
                {event.actor === "agent"
                  ? "Your support team"
                  : event.actor === "customer"
                    ? "You"
                    : "Capital One"}
                {hydrated ? ` · ${relativeTime(event.at, now)}` : ""}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
