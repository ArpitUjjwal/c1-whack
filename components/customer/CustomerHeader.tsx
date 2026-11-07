"use client";

import { motion } from "framer-motion";
import { CapitalOneMark } from "@/components/ui/CapitalOneMark";
import { LiveDot } from "@/components/ui/LiveDot";
import type { AppState } from "@/lib/types";

/**
 * The welcome.
 *
 * After a 14-day gap this is where the customer decides whether to stay or
 * close the app again. So it opens with a greeting rather than a figure,
 * names the gap without scolding, and — when an agent is live on the other
 * surface — says so. "Someone is already with you" does more for financial
 * anxiety than any number on this screen.
 */
export function CustomerHeader({
  state,
  agentOnline,
  unseenNudges,
  compact,
}: {
  state: AppState;
  agentOnline: boolean;
  unseenNudges: number;
  /** Focus Mode shrinks the header to a single line. */
  compact?: boolean;
}) {
  const { customer, agentName } = state;

  return (
    <header className="shrink-0 px-5 pt-2 pb-5">
      <div className="flex items-center justify-between">
        <CapitalOneMark className="w-24" />
        <span className="glass inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium text-fg-2">
          {unseenNudges > 0 ? (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-calm breathe" aria-hidden="true" />
              {unseenNudges} new
            </>
          ) : (
            "Nothing waiting"
          )}
        </span>
      </div>

      {!compact ? (
        <>
          <h1 className="display mt-6 text-[2.125rem] text-fg">
            Hi {customer.firstName}.
          </h1>
          <p className="mt-2 text-[0.9375rem] text-fg-2">
            {customer.daysSinceLastOpen >= 7
              ? "It's been a couple of weeks. Everything's still here, and there's one thing that needs you."
              : "Here's where things stand today."}
          </p>
        </>
      ) : (
        <h1 className="mt-4 text-lg font-semibold text-fg">Hi {customer.firstName}.</h1>
      )}

      {agentOnline ? (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="glass mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-fg-2"
        >
          <LiveDot online />
          {agentName} is here if you want them
        </motion.p>
      ) : null}
    </header>
  );
}
