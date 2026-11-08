"use client";

import { motion } from "framer-motion";
import { Disclosure } from "@/components/ui/Disclosure";
import { Panel } from "@/components/ui/Panel";
import { money } from "@/lib/format";
import type { SafeToSpend } from "@/lib/selectors";

/**
 * "Safe to Spend" replaces the ledger as the headline figure.
 *
 * A balance is a number you still have to do arithmetic on, and that
 * arithmetic is exactly what gets avoided. This card does the subtraction and
 * shows the answer. The working is still there, one tap down, for anyone who
 * wants it.
 */
export function SafeToSpendCard({
  safe,
  onDisclosureToggle,
}: {
  safe: SafeToSpend;
  onDisclosureToggle?: (open: boolean) => void;
}) {
  const healthy = safe.available > 0;

  return (
    <Panel bloom="link" className="p-5" aria-labelledby="safe-heading">
      <h2
        id="safe-heading"
        className="text-xs font-semibold tracking-[0.12em] text-fg-3 uppercase"
      >
        Safe to spend
      </h2>

      <motion.p
        key={safe.available}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="display tnum mt-2 text-[3.25rem] text-fg"
      >
        {money(safe.available)}
      </motion.p>

      <p className="mt-3 text-[0.9375rem] text-fg-2">
        {healthy ? (
          <>
            Yours to use. The next{" "}
            <strong className="font-semibold text-fg">{money(safe.committed)}</strong>{" "}
            of bills is already set aside.
          </>
        ) : (
          <>
            Your bills over the next {safe.horizonDays} days come to more than
            what&apos;s in the account. Nothing has gone wrong yet — there&apos;s
            time to sort it out.
          </>
        )}
      </p>

      <div className="mt-4 border-t border-edge pt-3">
        <Disclosure
          label="Show the maths"
          openLabel="Hide the maths"
          onToggle={onDisclosureToggle}
        >
          <dl className="space-y-2.5 text-[0.9375rem]">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-fg-2">
                In your current account
                <span className="block text-xs text-fg-3">
                  {safe.source}
                </span>
              </dt>
              <dd className="tnum font-semibold text-fg">{money(safe.balance)}</dd>
            </div>

            {safe.lines.map((line) => (
              <div key={line.id} className="flex items-baseline justify-between gap-4">
                <dt className="text-fg-2">
                  {line.label}
                  <span className="block text-xs text-fg-3">{line.note}</span>
                </dt>
                <dd className="tnum font-semibold text-fg-2">−{money(line.amount)}</dd>
              </div>
            ))}

            <div className="flex items-baseline justify-between gap-4 border-t border-edge pt-2.5">
              <dt className="font-semibold text-fg">Safe to spend</dt>
              <dd className="tnum text-lg font-semibold text-fg">
                {money(safe.available)}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-fg-3">
            We look {safe.horizonDays} days ahead. Anything due after that
            isn&apos;t counted yet.
          </p>
        </Disclosure>
      </div>
    </Panel>
  );
}
