"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { ListenButton } from "@/components/ui/ListenButton";
import { Panel } from "@/components/ui/Panel";
import { creditFileLine, payByDate } from "@/lib/compliance";
import { daysUntil, money, shortDate } from "@/lib/format";
import type { AppState } from "@/lib/types";

/**
 * The welcome-back experience.
 *
 * After days away, the hardest screen is the one with everything on it. So
 * instead of a pile of notifications, the app says what changed — three
 * lines at most — and offers one manageable next step. No "you missed", no
 * counts of days, no red. Messages wait, collapsed, to be read when wanted.
 */
export function WelcomeBack({
  state,
  onContinue,
  onSafeMode,
}: {
  state: AppState;
  onContinue: () => void;
  onSafeMode: () => void;
}) {
  const { credit } = state;
  const changes: string[] = [];

  if (credit.status === "overdue" && credit.ddReturnedOn) {
    changes.push(
      `Your Direct Debit for the card didn't go through on ${shortDate(credit.ddReturnedOn)} — the account was short that day. ${creditFileLine(payByDate(credit))}${
        credit.lateFeeWaivedByGrace ? " There's no late fee: your last payments were on time." : ""
      }`,
    );
  } else if (credit.status === "overdue") {
    changes.push(
      `Your ${money(credit.minimumDue)} card payment went past its date on ${shortDate(credit.dueDate)}. ${creditFileLine(payByDate(credit))}`,
    );
  }

  const nextByHand = state.bills
    .filter((b) => !b.autopay && daysUntil(b.dueDate) >= 0)
    .sort((a, b) => daysUntil(a.dueDate) - daysUntil(b.dueDate))[0];
  if (nextByHand) {
    changes.push(`${nextByHand.name} (${money(nextByHand.amount)}) is due ${shortDate(nextByHand.dueDate)}. It's in your plan.`);
  }

  const waiting = state.nudges.filter((n) => !n.dismissed).length;
  const emails = state.contactLog.filter((c) => c.channel === "email").length;
  changes.push(
    `${waiting + emails} message${waiting + emails === 1 ? "" : "s"} came in. None of them need reading now.`,
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Panel bloom="calm" className="p-5" aria-labelledby="welcome-heading">
        <div className="flex items-start justify-between gap-3">
          <h2 id="welcome-heading" className="text-xl font-semibold text-fg">
            Welcome back, {state.customer.firstName}.
          </h2>
          <ListenButton
            id="welcome"
            text={`Welcome back, ${state.customer.firstName}. Here's what changed while you were away. ${changes
              .slice(0, 3)
              .join(" ")}`}
          />
        </div>
        <p className="mt-1 text-[0.9375rem] text-fg-2">
          Here&apos;s what changed while you were away. That&apos;s all of it.
        </p>
        <ul className="mt-3 space-y-2.5">
          {changes.slice(0, 3).map((line) => (
            <li key={line} className="flex gap-2.5 text-[0.9375rem] text-fg-2">
              <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-calm" />
              {line}
            </li>
          ))}
        </ul>
        <div className="mt-5 space-y-2">
          <Button size="lg" variant="calm" fullWidth onClick={onContinue}>
            Show me the one thing
          </Button>
          <Button size="md" variant="ghost" fullWidth onClick={onSafeMode}>
            I can&apos;t handle banking today
          </Button>
        </div>
      </Panel>
    </motion.div>
  );
}
