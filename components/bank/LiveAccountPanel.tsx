"use client";

import { motion } from "framer-motion";
import { GRACE_STREAK, checkGrace, onTimeStreak } from "@/lib/engines/grace";
import { Panel } from "@/components/ui/Panel";
import { StatusPill } from "@/components/ui/StatusPill";
import { addDays, money, shortDate } from "@/lib/format";
import { selectCreditUtilisation, type SafeToSpend } from "@/lib/selectors";
import type { AppState } from "@/lib/types";

/**
 * A live mirror of exactly what Alex is looking at.
 *
 * The agent sees the same Safe-to-Spend figure the customer sees, not a raw
 * ledger — so when Alex says "it says I've got three hundred and eighty", the
 * agent is reading the same number off the same calculation.
 */
export function LiveAccountPanel({
  state,
  safe,
}: {
  state: AppState;
  safe: SafeToSpend;
}) {
  const { current, credit, flags } = state;
  const utilisation = selectCreditUtilisation(state);

  const status = (() => {
    switch (credit.status) {
      case "overdue":
        return { tone: "attn" as const, label: `${credit.daysOverdue} days past due` };
      case "extended":
        return { tone: "calm" as const, label: `Extended to ${shortDate(credit.dueDate)}` };
      case "split_plan":
        return { tone: "calm" as const, label: "3-part plan active" };
      default:
        return { tone: "pos" as const, label: "Current" };
    }
  })();

  const feeValue = credit.lateFeeWaivedByGrace
    ? "Waived"
    : credit.lateFeeRefunded
      ? "Refunded"
      : money(credit.lateFee);
  const feeSub = credit.lateFeeWaivedByGrace
    ? `Grace rule: ${onTimeStreak(credit)}/${GRACE_STREAK} on time`
    : credit.lateFeeRefunded
      ? "After payment, once a year"
      : "Refundable after payment";

  return (
    <Panel className="p-4" aria-labelledby="live-accounts-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="live-accounts-heading" className="font-semibold text-fg">
          Account
        </h2>
        <StatusPill tone={status.tone}>{status.label}</StatusPill>
      </div>

      {/* The figure the customer sees, so agent and customer read the same number. */}
      <div className="glass-2 mt-3 flex items-baseline justify-between gap-3 rounded-xl px-3 py-2">
        <span className="text-xs font-semibold tracking-[0.12em] text-fg-3 uppercase">
          Safe to spend
        </span>
        <motion.span
          key={safe.available}
          initial={{ opacity: 0.4 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35 }}
          className="display tnum text-2xl text-fg"
        >
          {money(safe.available)}
        </motion.span>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
        <Metric label="Current account" sub={`${current.provider} ••••${current.accountNumber.slice(-4)}`} value={money(current.balance)} />
        <Metric label={credit.nickname} sub={`${utilisation}% of ${money(credit.creditLimit)}`} value={money(credit.balance)} />
        <Metric
          label="Minimum due"
          sub={credit.minimumDue > 0 ? `Was due ${shortDate(credit.dueDate)}` : "Nothing outstanding"}
          value={credit.minimumDue > 0 ? money(credit.minimumDue) : "—"}
        />
        <Metric label="Late fee" sub={feeSub} value={feeValue} />
        <Metric label="Direct Debit" sub="For the minimum" value={flags.autopayEnabled ? "On" : "Off"} />
        <Metric
          label="Arrangement"
          sub={flags.extensionOffered && !flags.extensionAccepted ? "Offered, waiting" : "None pending"}
          value={flags.extensionAccepted ? "New date" : flags.splitPlanAccepted ? "Plan" : "—"}
        />
      </dl>

      <div className="mt-3 border-t border-edge pt-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold tracking-[0.12em] text-fg-3 uppercase">
            On-time record
          </span>
          <ol className="flex gap-1" aria-label="Last six statements">
            {credit.paymentHistory.map((h) => (
              <li
                key={h.month}
                title={`${h.month}: ${h.onTime ? "on time" : "late"}`}
                className={`h-3 w-3 rounded-full ${h.onTime ? "bg-pos" : "bg-attn"}`}
              >
                <span className="sr-only">
                  {h.month} {h.onTime ? "on time" : "late"}
                </span>
              </li>
            ))}
          </ol>
        </div>
        <p className="mt-1 text-xs text-fg-3">
          {credit.lateFeeWaivedByGrace && credit.graceUsedOn
            ? `Grace used on this payment. Available again from ${shortDate(addDays(credit.graceUsedOn, 365))}.`
            : checkGrace(credit, credit.dueDate).reason}
        </p>
      </div>
    </Panel>
  );
}

function Metric({
  label,
  sub,
  value,
  pill,
}: {
  label: string;
  sub: string;
  value: string;
  pill?: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-fg-3">{label}</dt>
      <dd>
        <motion.span
          key={value}
          initial={{ opacity: 0.4 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="tnum block font-semibold text-fg"
        >
          {value}
        </motion.span>
        <span className="block truncate text-xs text-fg-3">{sub}</span>
        {pill ? <span className="mt-1 block">{pill}</span> : null}
      </dd>
    </div>
  );
}
