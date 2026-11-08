"use client";

import { useId, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { Disclosure } from "@/components/ui/Disclosure";
import { Panel } from "@/components/ui/Panel";
import { StatusPill } from "@/components/ui/StatusPill";
import {
  BREAK_MAX_DAYS,
  BREAK_MIN_DAYS,
  dueLabel,
  projectBreak,
  type Obligation,
} from "@/lib/engines/time-machine";
import { money } from "@/lib/format";
import type { AppState } from "@/lib/types";

/**
 * The Financial Time Machine.
 *
 * "What happens if I don't touch my finances for a while?" — answered from
 * known bills, dates and the balance, with the assumptions printed. It never
 * acts. The only button on an item is "I can't manage this one right now",
 * which opens the Advocate: it prepares paperwork, the customer sends it.
 *
 * What Alex explores here is never shared. Moving the slider changes nothing
 * outside this screen.
 */
export function TimeMachine({
  state,
  days,
  onDaysChange,
  onCantManage,
}: {
  state: AppState;
  days: number;
  onDaysChange: (days: number) => void;
  onCantManage: (item: Obligation) => void;
}) {
  const sliderId = useId();
  const result = useMemo(() => projectBreak(state, days), [state, days]);
  const hasOpenCase = state.supportCases.some((c) => c.status !== "resolved");

  return (
    <Panel bloom="calm" className="p-5" aria-labelledby="tm-heading">
      <p className="text-xs font-semibold tracking-[0.12em] text-calm uppercase">
        Financial Time Machine
      </p>
      <h2 id="tm-heading" className="mt-1.5 text-lg font-semibold text-fg">
        What if you needed some time away from managing money?
      </h2>

      <div className="mt-3 flex items-baseline justify-between gap-3">
        <span className="text-sm text-fg-3">In your current account now</span>
        <span className="tnum font-semibold text-fg">{money(result.balance)}</span>
      </div>

      <label htmlFor={sliderId} className="mt-4 flex items-baseline justify-between gap-3">
        <span className="text-[0.9375rem] font-medium text-fg">I need a break for…</span>
        <span className="tnum text-xl font-semibold text-calm">
          {result.days} day{result.days === 1 ? "" : "s"}
        </span>
      </label>
      <input
        id={sliderId}
        type="range"
        min={BREAK_MIN_DAYS}
        max={BREAK_MAX_DAYS}
        step={1}
        value={result.days}
        onChange={(e) => onDaysChange(Number(e.target.value))}
        aria-valuetext={`${result.days} day${result.days === 1 ? "" : "s"}`}
        className="mt-2 h-11 w-full cursor-pointer accent-[var(--color-calm)]"
      />
      <div className="flex justify-between text-xs text-fg-3" aria-hidden="true">
        <span>{BREAK_MIN_DAYS} day</span>
        <span>{BREAK_MAX_DAYS} days</span>
      </div>

      <h3 className="mt-5 text-sm font-semibold text-fg">
        What needs attention during your break
      </h3>
      {result.during.length === 0 ? (
        <p className="mt-2 text-[0.9375rem] text-fg-2">Nothing is due. Take the time.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {result.during.map((item) => (
            <li key={item.id} className="glass rounded-xl p-3.5">
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block font-medium text-fg">{item.label}</span>
                  <span className="block text-sm text-fg-3">
                    {dueLabel(item.inDays, item.dueDate)}
                  </span>
                </span>
                <span className="text-right">
                  <span className="tnum block font-semibold text-fg">{money(item.amount)}</span>
                  <StatusPill tone={item.bucket === "needs_you" ? "calm" : "link"}>
                    {item.bucket === "needs_you" ? "Needs you" : "Pays itself"}
                  </StatusPill>
                </span>
              </div>
              <p className="mt-1.5 text-sm text-fg-2">{item.note}</p>
              {item.bucket === "needs_you" && !hasOpenCase ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-1 -ml-2"
                  onClick={() => onCantManage(item)}
                >
                  I can&apos;t manage this one right now
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 rounded-xl border border-edge p-3.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-xs font-semibold tracking-[0.12em] text-fg-3 uppercase">
            Projected balance after scheduled bills
          </span>
          <span
            className={`tnum text-xl font-semibold ${result.projected < 0 ? "text-attn" : "text-fg"}`}
          >
            {money(result.projected)}
          </span>
        </div>
        <p className="mt-1 text-xs text-fg-3">
          Assuming all listed payments go through, with no other income or spending.
        </p>
      </div>

      <div className="mt-4 rounded-xl border border-calm/25 bg-calm-dim p-3.5">
        <p className="text-xs font-semibold tracking-[0.12em] text-calm uppercase">
          Your gentle action plan
        </p>
        <p aria-live="polite" className="mt-1.5 text-[0.9375rem] text-fg">
          {result.plan}
        </p>
      </div>

      {result.later.length ? (
        <div className="mt-3">
          <Disclosure label={`Can wait until after your break (${result.later.length})`}>
            <ul className="space-y-1.5 text-sm">
              {result.later.map((item) => (
                <li key={item.id} className="flex justify-between gap-3">
                  <span className="text-fg-2">
                    {item.label}
                    <span className="block text-xs text-fg-3">
                      {dueLabel(item.inDays, item.dueDate)}
                    </span>
                  </span>
                  <span className="tnum text-fg-2">{money(item.amount)}</span>
                </li>
              ))}
            </ul>
          </Disclosure>
        </div>
      ) : null}

      <div className="mt-3">
        <Disclosure label="Where to get free help">
          <ul className="space-y-1.5 text-sm text-fg-2">
            <li>
              <a className="font-medium text-link underline" href="https://www.moneyhelper.org.uk" target="_blank" rel="noreferrer">
                MoneyHelper
              </a>{" "}
              — free, impartial money guidance.
            </li>
            <li>
              <a className="font-medium text-link underline" href="https://www.stepchange.org" target="_blank" rel="noreferrer">
                StepChange
              </a>{" "}
              — free debt advice.
            </li>
            <li>Capital One — use &ldquo;I can&apos;t manage this one&rdquo; above, and we&apos;ll reply in writing.</li>
          </ul>
        </Disclosure>
      </div>

      <p className="mt-4 text-xs text-fg-3">{result.assumptions[2]}</p>
      <p className="mt-1 text-xs text-fg-3">
        Nothing you try here is shared with Capital One.
      </p>
    </Panel>
  );
}
