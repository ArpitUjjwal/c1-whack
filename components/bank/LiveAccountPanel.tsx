"use client";

import { motion } from "framer-motion";
import { Meter } from "@/components/ui/Meter";
import { Panel } from "@/components/ui/Panel";
import { StatusPill } from "@/components/ui/StatusPill";
import { money, shortDate } from "@/lib/format";
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
  const { checking, credit, flags } = state;
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

  return (
    <Panel className="p-5" aria-labelledby="live-accounts-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="live-accounts-heading" className="font-semibold text-fg">
          Live account view
        </h2>
        <StatusPill tone="pos">
          <span className="breathe" aria-hidden="true">
            ●
          </span>
          Real time
        </StatusPill>
      </div>
      <p className="mt-1 text-sm text-fg-3">
        The same numbers on Alex&apos;s phone right now.
      </p>

      <div className="glass-2 mt-4 rounded-xl p-4">
        <p className="text-xs font-semibold tracking-[0.12em] text-fg-3 uppercase">
          Safe to spend — what Alex sees
        </p>
        <motion.p
          key={safe.available}
          initial={{ opacity: 0.4 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35 }}
          className="display tnum mt-1 text-[2.25rem] text-fg"
        >
          {money(safe.available)}
        </motion.p>
        <p className="mt-1 text-xs text-fg-3">
          {money(safe.balance)} in checking, less {money(safe.committed)} committed
          over {safe.horizonDays} days
        </p>
      </div>

      <dl className="mt-4 space-y-3">
        <Metric label={checking.nickname} sub="Checking ••••4417" value={money(checking.balance)} />
        <div>
          <Metric
            label={credit.nickname}
            sub="Credit ••••8842"
            value={money(credit.balance)}
            pill={<StatusPill tone={status.tone}>{status.label}</StatusPill>}
          />
          <Meter
            className="mt-2"
            value={utilisation}
            tone={utilisation > 70 ? "attn" : "link"}
            height="sm"
            label={`Credit utilisation ${utilisation} percent`}
          />
          <p className="mt-1 text-xs text-fg-3">
            {utilisation}% of {money(credit.creditLimit)} limit
          </p>
        </div>
        <Metric
          label="Minimum due"
          sub={credit.minimumDue > 0 ? `Was due ${shortDate(credit.dueDate)}` : "Nothing outstanding"}
          value={credit.minimumDue > 0 ? money(credit.minimumDue) : "—"}
        />
        <Metric
          label="Late fee"
          sub={credit.lateFeeWaived ? "Waived as a courtesy" : "Assessed, not yet waived"}
          value={credit.lateFeeWaived ? "Waived" : money(credit.lateFee)}
        />
      </dl>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-edge pt-3">
        <StatusPill tone={flags.autopayEnabled ? "pos" : "neutral"}>
          Autopay {flags.autopayEnabled ? "on" : "off"}
        </StatusPill>
        <StatusPill tone={flags.extensionAccepted ? "pos" : "neutral"}>
          Extension{" "}
          {flags.extensionAccepted
            ? "accepted"
            : flags.extensionOffered
              ? "offered"
              : "not offered"}
        </StatusPill>
        <StatusPill tone={flags.splitPlanAccepted ? "pos" : "neutral"}>
          Split plan{" "}
          {flags.splitPlanAccepted
            ? "active"
            : flags.splitPlanOffered
              ? "offered"
              : "not offered"}
        </StatusPill>
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
    <div className="flex items-start justify-between gap-4">
      <div>
        <dt className="font-medium text-fg">{label}</dt>
        <dd className="text-xs text-fg-3">{sub}</dd>
      </div>
      <div className="text-right">
        <motion.p
          key={value}
          initial={{ opacity: 0.4 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="tnum font-semibold text-fg"
        >
          {value}
        </motion.p>
        {pill ? <div className="mt-1">{pill}</div> : null}
      </div>
    </div>
  );
}
