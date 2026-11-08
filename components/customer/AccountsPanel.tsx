"use client";

import { Disclosure } from "@/components/ui/Disclosure";
import { Meter } from "@/components/ui/Meter";
import { Panel } from "@/components/ui/Panel";
import { StatusPill } from "@/components/ui/StatusPill";
import { maskTail, money, shortDate } from "@/lib/format";
import { selectCreditUtilisation } from "@/lib/selectors";
import type { AppState } from "@/lib/types";

/**
 * The accounts list.
 *
 * Each account shows one number and one sentence. Sort codes, full
 * account numbers, APR, limits and statement mechanics are all real and all
 * present — behind "Show account details", because someone looking for their
 * balance should not have to read past a sort code to find it.
 */
export function AccountsPanel({
  state,
  onDisclosureToggle,
}: {
  state: AppState;
  onDisclosureToggle?: (open: boolean) => void;
}) {
  const { current, credit } = state;
  const utilisation = selectCreditUtilisation(state);

  const creditStatus = (() => {
    switch (credit.status) {
      case "overdue":
        return { tone: "calm" as const, label: "Needs a payment" };
      case "extended":
        return { tone: "attn" as const, label: `More time — until ${shortDate(credit.dueDate)}` };
      case "split_plan":
        return { tone: "calm" as const, label: "Payment plan running" };
      default:
        return { tone: "pos" as const, label: "Up to date" };
    }
  })();

  return (
    <section aria-labelledby="accounts-heading" className="space-y-3">
      <h2 id="accounts-heading" className="px-1 text-lg font-semibold text-fg">
        Your accounts
      </h2>

      {/* --------------------------------------- linked current account */}
      <Panel as="article" className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-fg">{current.nickname}</h3>
            <p className="text-sm text-fg-3">
              {current.provider} {maskTail(current.accountNumber)}
            </p>
          </div>
          <StatusPill tone="link">Linked</StatusPill>
        </div>

        <p className="display tnum mt-3 text-[2rem] text-fg">
          {money(current.balance)}
        </p>
        <p className="text-sm text-fg-3">Money in the account right now</p>

        <div className="mt-4 border-t border-edge pt-3">
          <Disclosure label="Show account details" onToggle={onDisclosureToggle}>
            <dl className="space-y-2 text-sm">
              <DetailRow label="Sort code" value={current.sortCode} mono />
              <DetailRow label="Account number" value={current.accountNumber} mono />
              <DetailRow label="Bank" value={current.provider} />
              <DetailRow label="Linked via" value={current.linkedVia} />
            </dl>
            <p className="mt-3 text-xs text-fg-3">
              This account is at {current.provider}. We can see the balance so
              your safe-to-spend number is right, and card payments come from
              here. We can&apos;t move money out of it any other way.
            </p>
          </Disclosure>
        </div>
      </Panel>

      {/* ------------------------------------------------------ credit card */}
      <Panel as="article" className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-fg">{credit.nickname}</h3>
            <p className="text-sm text-fg-3">
              Credit card {maskTail(credit.accountNumber)}
            </p>
          </div>
          <StatusPill tone={creditStatus.tone}>{creditStatus.label}</StatusPill>
        </div>

        <p className="display tnum mt-3 text-[2rem] text-fg">{money(credit.balance)}</p>
        <p className="text-sm text-fg-3">What you owe on this card</p>

        <div className="mt-4">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-fg-2">You&apos;ve used {utilisation}% of this card</span>
            <span className="tnum text-fg-3">
              {money(credit.creditLimit - credit.balance)} left
            </span>
          </div>
          <Meter
            className="mt-2"
            value={utilisation}
            tone={utilisation > 70 ? "attn" : "link"}
            label={`Credit used: ${utilisation} percent of your ${money(credit.creditLimit)} limit`}
            valueText={`${utilisation}% of ${money(credit.creditLimit)} used`}
          />
        </div>

        <div className="mt-4 border-t border-edge pt-3">
          <Disclosure label="Show account details" onToggle={onDisclosureToggle}>
            <dl className="space-y-2 text-sm">
              <DetailRow label="Card number" value={credit.accountNumber} mono />
              <DetailRow label="Credit limit" value={money(credit.creditLimit)} />
              <DetailRow
                label="Minimum payment"
                value={credit.minimumDue > 0 ? money(credit.minimumDue) : "Nothing due"}
              />
              <DetailRow label="Payment date" value={shortDate(credit.dueDate)} />
              <DetailRow label="Interest rate (APR)" value={`${credit.apr}%`} />
              <DetailRow
                label="Late fee"
                value={
                  credit.lateFeeWaivedByGrace
                    ? `${money(credit.lateFee)} — waived, thanks to your on-time payments`
                    : credit.lateFeeRefunded
                      ? `${money(credit.lateFee)} — refunded`
                      : money(credit.lateFee)
                }
              />
            </dl>
            <p className="mt-3 text-xs text-fg-3">
              APR is the yearly cost of carrying a balance. If you pay the full
              balance each month, you&apos;re not charged any of it.
            </p>
          </Disclosure>
        </div>
      </Panel>

      {/* ----------------------------------------------------- bills ahead */}
      <Panel as="article" className="p-5">
        <h3 className="font-semibold text-fg">Bills coming up</h3>
        <p className="mt-1 text-sm text-fg-3">
          Already subtracted from your safe-to-spend number.
        </p>
        <ul className="mt-3 divide-y divide-edge">
          {state.bills.map((bill) => (
            <li key={bill.id} className="flex items-center justify-between gap-3 py-2.5">
              <span>
                <span className="block text-fg">{bill.name}</span>
                <span className="block text-xs text-fg-3">
                  {bill.autopay ? "Pays itself" : "You pay this one"} ·{" "}
                  {shortDate(bill.dueDate)}
                </span>
              </span>
              <span className="tnum font-semibold text-fg">{money(bill.amount)}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </section>
  );
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-fg-3">{label}</dt>
      <dd className={`font-medium text-fg ${mono ? "tnum tracking-wide" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
