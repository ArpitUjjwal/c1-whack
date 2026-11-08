"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Disclosure } from "@/components/ui/Disclosure";
import { ListenButton } from "@/components/ui/ListenButton";
import { Panel } from "@/components/ui/Panel";
import { creditFileLine, payByDate } from "@/lib/compliance";
import { CHANNEL_LABEL } from "@/lib/contact";
import { longDate, money } from "@/lib/format";
import type { AppState, SupportCase } from "@/lib/types";

/**
 * Where a support request stands, on Alex's side. Updates the moment the bank
 * acts — the two-way half of the handoff.
 *
 * Each state has one next step at most. "Guided payment" is the accessible
 * pathway: the same payment, in three small steps, with nothing to work out.
 */
export function SupportStatusCard({
  state,
  supportCase,
  safeAfterPayment,
  onPay,
  onAcceptArrangement,
}: {
  state: AppState;
  supportCase: SupportCase;
  safeAfterPayment: number;
  onPay: (amount: number) => void;
  onAcceptArrangement: () => void;
}) {
  const c = supportCase;
  const agent = state.agentName;
  const channel = CHANNEL_LABEL[c.contact].toLowerCase();

  const spoken =
    c.status === "review_needed"
      ? `Your request has been sent. ${agent} will reply by ${channel}. You don't need to do anything else.`
      : c.status === "guided_offered"
        ? `${agent} made paying simpler. The amount is ${money(c.amount)}. It comes from your ${state.current.provider} account, and you'll still have ${money(safeAfterPayment)} safe to spend. There's one button to pay.`
        : c.status === "specialist_review"
          ? `An adviser is looking at your request. They'll reply by ${channel}${c.replyBy ? ` by ${longDate(c.replyBy)}` : ""}. You don't need to call or explain again.`
          : c.status === "arrangement_offered" && state.credit.extendedDueDate
            ? `An adviser offered you more time. You can pay ${money(c.amount)} on ${longDate(state.credit.extendedDueDate)} instead, with no extra fee.`
            : "Your request is complete.";

  return (
    <Panel bloom="calm" className="p-5" aria-labelledby="case-heading">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold tracking-[0.12em] text-calm uppercase">
          Your request #{c.ref}
        </p>
        <ListenButton id={`case-${c.status}`} text={spoken} />
      </div>

      {/*
        No exit animation on purpose: waiting for the old state to fade out
        can stall in a background window, leaving the card showing a stale
        status. The new status renders at once and fades in.
      */}
      <motion.div
          key={c.status}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          {c.status === "review_needed" ? (
            <>
              <h2 id="case-heading" className="mt-2 text-xl font-semibold text-fg">
                Sent. You don&apos;t need to do anything else.
              </h2>
              <p className="mt-2 text-[0.9375rem] text-fg-2">
                {agent} will reply by {channel}. Nothing about your payment
                changes until you agree to it.
              </p>
            </>
          ) : null}

          {c.status === "guided_offered" ? (
            <>
              <h2 id="case-heading" className="mt-2 text-xl font-semibold text-fg">
                {agent} made paying simpler.
              </h2>
              <ol className="mt-3 space-y-2.5 text-[0.9375rem]">
                <Step n={1}>
                  The amount is <strong className="font-semibold text-fg">{money(c.amount)}</strong>. That&apos;s all of it.
                </Step>
                <Step n={2}>
                  It comes from your {state.current.provider} account. You&apos;ll
                  still have <strong className="tnum font-semibold text-pos">{money(safeAfterPayment)}</strong> safe to spend.
                </Step>
                <Step n={3}>One button. You can stop at any point.</Step>
              </ol>
              <Button size="lg" variant="calm" fullWidth className="mt-4" onClick={() => onPay(c.amount)}>
                Pay {money(c.amount)}
              </Button>
              <p className="mt-2 text-sm text-fg-3">
                Not today? That&apos;s fine — reply to {agent} and they&apos;ll
                look at other options with you.
              </p>
            </>
          ) : null}

          {c.status === "specialist_review" ? (
            <>
              <h2 id="case-heading" className="mt-2 text-xl font-semibold text-fg">
                An adviser is looking at your request.
              </h2>
              <p className="mt-2 text-[0.9375rem] text-fg-2">
                They&apos;ll reply by {channel}
                {c.replyBy ? ` by ${longDate(c.replyBy)}` : ""}. You don&apos;t
                need to call or explain again.
              </p>
            </>
          ) : null}

          {c.status === "arrangement_offered" && state.credit.extendedDueDate ? (
            <>
              <h2 id="case-heading" className="mt-2 text-xl font-semibold text-fg">
                An adviser offered you more time.
              </h2>
              <p className="mt-2 text-[0.9375rem] text-fg-2">
                Pay {money(c.amount)} on{" "}
                <strong className="font-semibold text-fg">
                  {longDate(state.credit.extendedDueDate)}
                </strong>{" "}
                instead. No extra fee for the extra time.
              </p>
              <p className="mt-1.5 text-sm text-fg-3">
                An arrangement doesn&apos;t stop a late payment being reported.{" "}
                {creditFileLine(payByDate(state.credit))}
              </p>
              <Button size="lg" variant="calm" fullWidth className="mt-4" onClick={onAcceptArrangement}>
                Yes, use the new date
              </Button>
            </>
          ) : null}
        </motion.div>

      <div className="mt-4 border-t border-edge pt-3">
        <Disclosure label="What you shared">
          <p className="text-sm text-fg-2 italic">&ldquo;{c.message}&rdquo;</p>
          <p className="mt-2 text-xs text-fg-3">
            That&apos;s everything Capital One received. Nothing about how
            you&apos;ve used the app was included.
          </p>
        </Disclosure>
      </div>
    </Panel>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className="tnum flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-calm-dim text-sm font-semibold text-calm"
      >
        {n}
      </span>
      <span className="text-fg-2">{children}</span>
    </li>
  );
}
