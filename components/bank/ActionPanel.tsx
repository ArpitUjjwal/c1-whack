"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { checkContact, ordinal } from "@/lib/contact";
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
 *
 * Goodwill follows action, never silence. The fee refund only unlocks once
 * Alex has paid — "a one-off refund per year, after paying" — so the panel
 * rewards re-engaging rather than going quiet.
 */
export function ActionPanel({
  state,
  dispatch,
  customerOnline,
  now,
}: {
  state: AppState;
  dispatch: (action: Action) => void;
  customerOnline: boolean;
  /** Slow-ticking clock from the store, so nothing here reads the time in render. */
  now: number;
}) {
  const [flash, setFlash] = useState<string | null>(null);
  const [confirmCheckIn, setConfirmCheckIn] = useState(false);
  const contact = checkContact(state, now, new Date(now).getHours());
  const { credit, flags, agentName } = state;
  const amount = money(credit.minimumDue);
  const split = money(Math.round((credit.minimumDue / 3) * 100) / 100);
  const extensionDate = isoDaysFromToday(14);

  const announce = useCallback((message: string) => {
    setFlash(message);
    window.setTimeout(() => setFlash(null), 3600);
  }, []);

  const sendCheckIn = () => {
    if (contact.breaches.length > 0 && !confirmCheckIn) {
      setConfirmCheckIn(true);
      return;
    }
    setConfirmCheckIn(false);
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
        body: `I've put the option in your app — you'd have until ${longDate(
          extensionDate,
        )}. No extra fee for the extra time.`,
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

  const paid = credit.status === "current";

  /*
    No separate message for the refund: it would be one more contact this
    week, against Alex's own limit. It shows on the card in the app, and the
    script gives the agent the line to say if they are already talking.
  */
  const refundFee = () => {
    dispatch({ type: "REFUND_LATE_FEE" });
    announce(`${money(credit.lateFee)} late fee refunded. It shows on Alex's card in the app.`);
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
        Concessions are optional extras, never the first move.
      </p>

      <div className="mt-4 space-y-2.5">
        <ActionRow
          title="Send gentle check-in nudge"
          detail={
            confirmCheckIn
              ? `${contact.breaches.join(" ")} Press again to send anyway.`
              : `One low-pressure message with a single tap-to-fix action. Would be the ${ordinal(contact.nextOrdinal)} message this week.`
          }
          disabled={false}
          onClick={sendCheckIn}
          variant="calm"
          cta={confirmCheckIn ? "Send anyway" : "Send"}
          warn={contact.breaches.length > 0}
        />

        <ActionRow
          title="Offer payment extension"
          detail={
            flags.extensionAccepted
              ? `Alex accepted. New date is ${longDate(credit.dueDate)}.`
              : flags.extensionOffered
                ? "Already offered — the option is in Alex's app. Don't chase it."
                : `Moves the date to ${longDate(extensionDate)}. No extra fee for the extra time.`
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
          title={`Refund the ${money(credit.lateFee)} late fee after payment`}
          detail={
            credit.lateFeeRefunded
              ? "Refunded. It shows on Alex's card in the app."
              : "Optional goodwill: once a year, after the customer has paid."
          }
          disabled={credit.lateFeeRefunded || !paid}
          disabledReason={
            !credit.lateFeeRefunded && !paid
              ? "Unlocks once Alex has paid. Goodwill follows action, not silence."
              : undefined
          }
          onClick={refundFee}
          variant="pos"
          cta="Refund"
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
  warn = false,
}: {
  title: string;
  detail: string;
  disabled: boolean;
  disabledReason?: string;
  onClick: () => void;
  variant: "primary" | "calm" | "pos";
  cta: string;
  /** Sending now would break one of Alex's contact rules. */
  warn?: boolean;
}) {
  return (
    <div
      className={`flex items-start justify-between gap-4 rounded-xl border p-3.5 ${
        disabled ? "border-edge bg-transparent" : warn ? "border-attn/40 bg-attn-dim" : "border-edge bg-glass"
      }`}
    >
      <div className="min-w-0">
        <p className="font-medium text-fg">{title}</p>
        <p className={`mt-0.5 text-sm ${warn ? "text-attn" : "text-fg-3"}`}>
          {disabledReason ?? detail}
        </p>
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
