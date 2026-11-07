"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { isoDaysFromToday, longDate, money } from "@/lib/format";
import type { Action, AppState } from "@/lib/types";

/**
 * Empathy actions.
 *
 * Every button here does something *for* the customer, and every one lands on
 * Alex's phone in real time. There is deliberately no "send final notice":
 * the thing being tested is whether support can resolve an arrears case
 * without applying pressure at all.
 *
 * Each action disables once taken, with the reason in text. An agent should
 * not be able to send the same nudge twice and turn care into spam.
 */
export function ActionPanel({
  state,
  dispatch,
  customerOnline,
}: {
  state: AppState;
  dispatch: (action: Action) => void;
  customerOnline: boolean;
}) {
  const [flash, setFlash] = useState<string | null>(null);
  const { credit, flags, agentName } = state;
  const amount = money(credit.minimumDue);
  const split = money(Math.round((credit.minimumDue / 3) * 100) / 100);
  const extensionDate = isoDaysFromToday(14);

  const announce = useCallback((message: string) => {
    setFlash(message);
    window.setTimeout(() => setFlash(null), 3600);
  }, []);

  const sendCheckIn = () => {
    dispatch({
      type: "SEND_NUDGE",
      nudge: {
        title: "Just checking in",
        body: `Nothing's wrong, and you don't need to reply. There's ${amount} on your card whenever you're ready — one tap on the home screen does it.`,
        tone: "calm",
        actionLabel: "Show me",
        action: "focus_catchup",
        fromAgent: agentName,
      },
    });
    announce("Gentle check-in delivered to Alex's phone.");
  };

  const offerExtension = () => {
    dispatch({ type: "OFFER_EXTENSION", newDueDate: extensionDate });
    dispatch({
      type: "SEND_NUDGE",
      nudge: {
        title: "Take more time if you need it",
        body: `I've moved the option into your app — you'd have until ${longDate(
          extensionDate,
        )}. No fee, and nothing reported late.`,
        tone: "warm",
        actionLabel: "Yes, give me more time",
        action: "accept_extension",
        fromAgent: agentName,
      },
    });
    announce(`Extension to ${longDate(extensionDate)} offered.`);
  };

  const offerSplit = () => {
    dispatch({ type: "OFFER_SPLIT_PLAN" });
    dispatch({
      type: "SEND_NUDGE",
      nudge: {
        title: "Smaller pieces?",
        body: `I can split the ${amount} into three payments of ${split}. Start whenever — the other two look after themselves.`,
        tone: "calm",
        actionLabel: `Start with ${split}`,
        action: "accept_split",
        fromAgent: agentName,
      },
    });
    announce("3-part payment plan offered.");
  };

  const waiveFee = () => {
    dispatch({ type: "WAIVE_LATE_FEE" });
    dispatch({
      type: "SEND_NUDGE",
      nudge: {
        title: `I've taken the ${money(credit.lateFee)} fee off`,
        body: "You don't owe anything extra, and you didn't have to ask. Nothing else changes.",
        tone: "celebrate",
        fromAgent: agentName,
      },
    });
    announce(`${money(credit.lateFee)} late fee waived and Alex told.`);
  };

  return (
    <Panel className="p-5" aria-labelledby="actions-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="actions-heading" className="font-semibold text-fg">
          Empathy actions
        </h2>
        <span className="text-xs text-fg-3">
          {customerOnline ? "Arrives instantly" : "Waits on Alex's phone"}
        </span>
      </div>
      <p className="mt-1 text-sm text-fg-3">
        No action on this panel applies pressure, a deadline or a fee.
      </p>

      <div className="mt-4 space-y-2.5">
        <ActionRow
          title="Send gentle check-in nudge"
          detail="One low-pressure message with a single tap-to-fix action."
          disabled={false}
          onClick={sendCheckIn}
          variant="calm"
          cta="Send"
        />

        <ActionRow
          title="Offer payment extension"
          detail={
            flags.extensionAccepted
              ? `Alex accepted. New date is ${longDate(credit.dueDate)}.`
              : flags.extensionOffered
                ? "Already offered — the option is in Alex's app. Don't chase it."
                : `Moves the date to ${longDate(extensionDate)}. No fee, nothing reported late.`
          }
          disabled={flags.extensionOffered || credit.status !== "overdue"}
          disabledReason={
            credit.status !== "overdue" && !flags.extensionOffered
              ? "Nothing is past due."
              : undefined
          }
          onClick={offerExtension}
          variant="primary"
          cta="Offer"
        />

        <ActionRow
          title="Offer a 3-part payment plan"
          detail={
            flags.splitPlanAccepted
              ? "Plan is running. First piece paid."
              : flags.splitPlanOffered
                ? "Already offered. Waiting on Alex."
                : `Breaks ${amount} into three payments of ${split}.`
          }
          disabled={flags.splitPlanOffered || credit.status !== "overdue"}
          disabledReason={
            credit.status !== "overdue" && !flags.splitPlanOffered
              ? "Nothing is past due."
              : undefined
          }
          onClick={offerSplit}
          variant="primary"
          cta="Offer"
        />

        <ActionRow
          title={`Waive the ${money(credit.lateFee)} late fee`}
          detail={
            credit.lateFeeWaived
              ? "Already waived. Alex has been told."
              : "One-time courtesy. Apply it before asking for anything."
          }
          disabled={credit.lateFeeWaived}
          onClick={waiveFee}
          variant="pos"
          cta="Waive"
        />
      </div>

      <div aria-live="polite" className="min-h-6">
        <AnimatePresence>
          {flash ? (
            <motion.p
              key={flash}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-3 rounded-xl border border-pos/25 bg-pos-dim px-3 py-2 text-sm font-medium text-pos"
            >
              {flash}
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>
    </Panel>
  );
}

function ActionRow({
  title,
  detail,
  disabled,
  disabledReason,
  onClick,
  variant,
  cta,
}: {
  title: string;
  detail: string;
  disabled: boolean;
  disabledReason?: string;
  onClick: () => void;
  variant: "primary" | "calm" | "pos";
  cta: string;
}) {
  return (
    <div
      className={`flex items-start justify-between gap-4 rounded-xl border p-3.5 ${
        disabled ? "border-edge bg-transparent" : "border-edge bg-glass"
      }`}
    >
      <div className="min-w-0">
        <p className="font-medium text-fg">{title}</p>
        <p className="mt-0.5 text-sm text-fg-3">{disabledReason ?? detail}</p>
      </div>
      <Button
        size="sm"
        variant={disabled ? "outline" : variant}
        onClick={onClick}
        disabled={disabled}
      >
        {/* "Done" means taken; an action that never applied says so. */}
        {disabled ? (disabledReason ? "N/A" : "Done") : cta}
      </Button>
    </div>
  );
}
