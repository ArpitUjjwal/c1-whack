"use client";

import { Panel } from "@/components/ui/Panel";
import { money, shortDate } from "@/lib/format";
import type { Reminder } from "@/lib/reminders";

/**
 * Reminders Alex asked for, on the day. One line each, no urgency, and a
 * note of when the next one will appear so nothing needs remembering.
 */
export function ComingUp({ reminders }: { reminders: Reminder[] }) {
  const active = reminders.filter((r) => r.active);
  const next = reminders.find((r) => !r.active);
  if (active.length === 0 && !next) return null;


  return (
    <Panel className="p-4" aria-labelledby="coming-up-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="coming-up-heading" className="text-sm font-semibold text-fg">
          {active.length ? "Your reminder" : "Reminders"}
        </h2>
      </div>
      {active.length ? (
        <ul className="mt-2 space-y-1.5">
          {active.map((r) => (
            <li key={r.id} className="flex items-baseline justify-between gap-3 text-[0.9375rem]">
              <span className="text-fg">
                {r.label} is due {shortDate(r.dueDate)}
              </span>
              <span className="tnum font-semibold text-fg">{money(r.amount)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {next ? (
        <p className="mt-1.5 text-sm text-fg-3">
          Next reminder: {next.label.toLowerCase()} on {shortDate(next.remindOn)}. You asked for
          these — change them in Settings &amp; help.
        </p>
      ) : null}
    </Panel>
  );
}
