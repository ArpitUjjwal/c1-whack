"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Disclosure } from "@/components/ui/Disclosure";
import { Panel } from "@/components/ui/Panel";
import { Sheet } from "@/components/ui/Sheet";
import { longDate, money, shortDate } from "@/lib/format";
import type { AppState } from "@/lib/types";

/**
 * The Catch-Up widget — what a conventional banking app renders as a red
 * banner with an exclamation mark.
 *
 * Every decision here is deliberate:
 *  · Violet, never red. Red reads as danger, and danger triggers the
 *    avoidance the whole product exists to interrupt. Red in this product
 *    belongs to the Pressure Index, where it marks the bank's language.
 *  · Plain language. "A payment slipped past", not "DELINQUENT".
 *  · One primary action, with its consequence stated before it is taken, so
 *    nothing has to be held in working memory.
 *  · Days late, the fee and the APR are all present and all folded away —
 *    information on request, not on arrival.
 */
export function CatchUpWidget({
  state,
  safeNow,
  safeAfterPayment,
  focusMode,
  onPay,
  onAcceptExtension,
  onAcceptSplit,
  onAskForTime,
  onDisclosureToggle,
}: {
  state: AppState;
  safeNow: number;
  safeAfterPayment: number;
  focusMode?: boolean;
  onPay: (amount: number) => void;
  onAcceptExtension: () => void;
  onAcceptSplit: () => void;
  onAskForTime: () => void;
  onDisclosureToggle?: (open: boolean) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const { credit, flags, agentName } = state;
  const amount = credit.minimumDue;
  const splitAmount = Math.round((amount / 3) * 100) / 100;

  return (
    <Panel bloom="calm" className="p-5" aria-labelledby="catchup-heading">
      <p className="text-xs font-semibold tracking-[0.12em] text-calm uppercase">
        One thing to look at
      </p>

      <h2
        id="catchup-heading"
        className={`mt-2 font-semibold text-fg ${focusMode ? "text-2xl" : "text-xl"}`}
      >
        A payment slipped past.
      </h2>
      <p className={`mt-2 text-fg-2 ${focusMode ? "text-base" : "text-[0.9375rem]"}`}>
        No worries — this happens, and it&apos;s quick to fix. Your{" "}
        {credit.nickname} needs{" "}
        <strong className="font-semibold text-fg">{money(amount)}</strong>.
      </p>

      <div className="glass mt-4 rounded-xl p-3.5">
        <p className="text-[0.9375rem] text-fg-2">
          Pay it now and you&apos;ll still have{" "}
          <strong className="tnum font-semibold text-pos">
            {money(safeAfterPayment)}
          </strong>{" "}
          safe to spend.
        </p>
        {Math.abs(safeAfterPayment - safeNow) < 0.01 ? (
          <p className="mt-1.5 text-sm text-fg-3">
            That&apos;s exactly what you have now — this money was already set
            aside, so paying it changes nothing you were counting on.
          </p>
        ) : null}
      </div>

      {/* Agent-offered alternatives, arriving in real time. */}
      <AnimatePresence initial={false}>
        {flags.extensionOffered && !flags.extensionAccepted ? (
          <motion.div
            key="extension"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 rounded-xl border border-attn/25 bg-attn-dim p-3.5">
              <p className="text-sm font-semibold text-attn">
                {agentName} offered you more time
              </p>
              <p className="mt-1 text-[0.9375rem] text-fg-2">
                Pay on{" "}
                {credit.extendedDueDate
                  ? longDate(credit.extendedDueDate)
                  : "a later date"}{" "}
                instead. No fee, and nothing reported late.
              </p>
              <Button variant="outline" size="sm" className="mt-3" onClick={onAcceptExtension}>
                Yes, I&apos;ll take the extra time
              </Button>
            </div>
          </motion.div>
        ) : null}

        {flags.splitPlanOffered && !flags.splitPlanAccepted ? (
          <motion.div
            key="split"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 rounded-xl border border-calm/25 bg-calm-dim p-3.5">
              <p className="text-sm font-semibold text-calm">
                {agentName} can split this up
              </p>
              <p className="mt-1 text-[0.9375rem] text-fg-2">
                Three pieces of {money(splitAmount)} instead of one{" "}
                {money(amount)} payment.
              </p>
              <Button variant="calm" size="sm" className="mt-3" onClick={onAcceptSplit}>
                Start with {money(splitAmount)}
              </Button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="mt-5 space-y-2.5">
        <Button size="lg" variant="calm" fullWidth onClick={() => setConfirming(true)}>
          Pay {money(amount)} now
        </Button>
        <Button size="md" variant="outline" fullWidth onClick={() => setOptionsOpen(true)}>
          I need a different option
        </Button>
      </div>

      {!focusMode ? (
        <div className="mt-4 border-t border-edge pt-3">
          <Disclosure label="Show the details" onToggle={onDisclosureToggle}>
            <dl className="space-y-2 text-sm">
              <Row label="Was due" value={shortDate(credit.dueDate)} />
              <Row label="Days past due" value={`${credit.daysOverdue}`} />
              <Row
                label="Late fee"
                value={
                  credit.lateFeeWaived
                    ? `${money(credit.lateFee)} — waived by ${agentName}`
                    : money(credit.lateFee)
                }
              />
              <Row label="Card balance" value={money(credit.balance)} />
              <Row label="Interest rate (APR)" value={`${credit.apr}%`} />
            </dl>
            <p className="mt-3 text-xs text-fg-3">
              Nothing here affects your credit report yet. Payments are reported
              after 30 days past due.
            </p>
          </Disclosure>
        </div>
      ) : null}

      {/* ----------------------------------------------- confirm payment -- */}
      <Sheet
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Pay ${money(amount)}?`}
        description={`From ${state.checking.nickname} to your ${credit.nickname}. That's everything this card needs right now.`}
      >
        <dl className="glass space-y-2.5 rounded-xl p-4 text-[0.9375rem]">
          <Row label="Paying" value={money(amount)} strong />
          <Row label="From" value={state.checking.nickname} />
          <Row label="Safe to spend after" value={money(safeAfterPayment)} strong />
        </dl>
        <div className="mt-5 space-y-2.5">
          <Button
            size="lg"
            variant="calm"
            fullWidth
            onClick={() => {
              setConfirming(false);
              onPay(amount);
            }}
          >
            Yes, pay {money(amount)}
          </Button>
          <Button size="md" variant="ghost" fullWidth onClick={() => setConfirming(false)}>
            Not right now
          </Button>
        </div>
      </Sheet>

      {/* ------------------------------------------------- other options -- */}
      <Sheet
        open={optionsOpen}
        onClose={() => setOptionsOpen(false)}
        title="That's completely fine"
        description="Pick whatever feels doable. Any of these stops the account going further past due."
      >
        <div className="space-y-2.5">
          <Button
            size="lg"
            variant="outline"
            fullWidth
            onClick={() => {
              setOptionsOpen(false);
              onPay(splitAmount);
            }}
          >
            Pay a smaller {money(splitAmount)} today
          </Button>
          <Button
            size="lg"
            variant="outline"
            fullWidth
            onClick={() => {
              setOptionsOpen(false);
              onAskForTime();
            }}
          >
            Ask for more time
          </Button>
          <Button size="md" variant="ghost" fullWidth onClick={() => setOptionsOpen(false)}>
            Close this
          </Button>
        </div>
        <p className="mt-4 text-xs text-fg-3">
          Asking for more time sends a note to your support team. Nobody will
          call you unless you ask them to.
        </p>
      </Sheet>
    </Panel>
  );
}

function Row({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-fg-2">{label}</dt>
      <dd className={`tnum ${strong ? "font-semibold text-fg" : "font-medium text-fg-2"}`}>
        {value}
      </dd>
    </div>
  );
}
