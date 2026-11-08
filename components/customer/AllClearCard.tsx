"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { longDate, money } from "@/lib/format";
import type { AppState } from "@/lib/types";

/**
 * What sits where the catch-up widget was, once the thing is handled.
 *
 * The reward for dealing with it is a visibly calmer screen and an explicit
 * "nothing needs you today" — the opposite of a dashboard that always has
 * something flashing.
 */
export function AllClearCard({
  state,
  onEnableAutopay,
}: {
  state: AppState;
  onEnableAutopay: () => void;
}) {
  const { credit, flags } = state;

  const copy = (() => {
    switch (credit.status) {
      case "extended":
        return {
          title: `You've got until ${longDate(credit.dueDate)}.`,
          body: "Nothing to do today. We'll give you a gentle heads-up two days before, and nothing is reported late.",
        };
      case "split_plan":
        return {
          title: "Your payment plan is running.",
          body: `First piece is done. Two more of ${money(
            Math.round((credit.minimumDue / 3) * 100) / 100,
          )} are scheduled, and they'll pay themselves.`,
        };
      default:
        return {
          title: "You're all caught up.",
          body: "Nothing needs you today. That's genuinely it.",
        };
    }
  })();

  return (
    <Panel bloom="pos" className="p-5" aria-labelledby="allclear-heading">
      <p className="text-xs font-semibold tracking-[0.12em] text-pos uppercase">
        All clear
      </p>

      <h2 id="allclear-heading" className="mt-2 text-xl font-semibold text-fg">
        {copy.title}
      </h2>
      <p className="mt-2 text-[0.9375rem] text-fg-2">{copy.body}</p>

      {flags.winsCount > 0 ? (
        <motion.p
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold text-pos"
        >
          {flags.winsCount} thing{flags.winsCount === 1 ? "" : "s"} sorted this week
        </motion.p>
      ) : null}

      {!flags.autopayEnabled ? (
        <div className="glass mt-5 rounded-xl p-3.5">
          <p className="text-sm font-semibold text-fg">
            Want to never think about this again?
          </p>
          <p className="mt-1 text-[0.9375rem] text-fg-2">
            A Direct Debit can pay the minimum from your current account each
            month, on the day it&apos;s due. Cancel it whenever.
          </p>
          <Button variant="pos" size="md" className="mt-3" onClick={onEnableAutopay}>
            Yes, handle it for me
          </Button>
        </div>
      ) : (
        <p className="glass mt-5 rounded-xl p-3.5 text-[0.9375rem] text-fg-2">
          <strong className="font-semibold text-fg">
            Your Direct Debit is set up.
          </strong>{" "}
          The minimum goes out on the due date. You don&apos;t have to remember it.
        </p>
      )}
    </Panel>
  );
}
