"use client";

import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { StatusPill } from "@/components/ui/StatusPill";
import { nextAction, statusChips, type NextActionButton } from "@/lib/next-action";
import type { Action, AppState } from "@/lib/types";

const TONE_COPY = {
  act: { label: "Next action", pill: "link" as const },
  wait: { label: "Wait", pill: "calm" as const },
  hold: { label: "Hold", pill: "attn" as const },
  done: { label: "All clear", pill: "pos" as const },
};

/**
 * The top of the Care Centre: the facts that matter at a glance, and the one
 * thing to do next, with a button that does it. Derived from live state, so
 * it changes the moment the customer acts in the other window.
 */
export function NextActionBar({
  state,
  now,
  customerOnline,
  dispatch,
  onCompose,
}: {
  state: AppState;
  now: number;
  customerOnline: boolean;
  dispatch: (action: Action) => void;
  /** Put a prepared line in the composer and focus it. */
  onCompose: (line: string) => void;
}) {
  const action = nextAction(state, now);
  const chips = statusChips(state, now, customerOnline);
  const tone = TONE_COPY[action.tone];

  const run = (b: NextActionButton) =>
    b.kind === "dispatch" ? dispatch(b.action) : onCompose(b.line);

  return (
    <Panel
      bloom={action.tone === "act" ? "link" : action.tone === "hold" ? "attn" : undefined}
      className="p-4"
      aria-labelledby="next-action-heading"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <ul className="flex flex-wrap gap-1.5" aria-label="Status">
          {chips.map((c) => (
            <li key={c.label}>
              <StatusPill tone={c.tone}>{c.label}</StatusPill>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:max-w-[60%]">
          <div className="min-w-0" aria-live="polite">
            <p className="flex items-center gap-2">
              <StatusPill tone={tone.pill}>{tone.label}</StatusPill>
              <span id="next-action-heading" className="font-semibold text-fg">
                {action.title}
              </span>
            </p>
            <p className="mt-0.5 text-sm text-fg-2">{action.why}</p>
          </div>
          {action.primary || action.secondary ? (
            <div className="flex shrink-0 gap-2">
              {action.primary ? (
                <Button size="sm" variant="primary" onClick={() => run(action.primary!)}>
                  {action.primary.label}
                </Button>
              ) : null}
              {action.secondary ? (
                <Button size="sm" variant="outline" onClick={() => run(action.secondary!)}>
                  {action.secondary.label}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}
