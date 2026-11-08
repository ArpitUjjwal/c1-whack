"use client";

import { useEffect } from "react";
import { RescueSimulator } from "./RescueSimulator";
import { Button } from "@/components/ui/Button";
import { Disclosure } from "@/components/ui/Disclosure";
import { Panel } from "@/components/ui/Panel";
import { StatusPill } from "@/components/ui/StatusPill";
import { DIFFICULTY_LABEL, HELP_LABEL, NOT_SHARED } from "@/lib/advocate";
import { CHANNEL_LABEL } from "@/lib/contact";
import { arrangementEligibility } from "@/lib/engines/rescue-sim";
import { clockTime, isoDaysFromToday, longDate, money, shortDate } from "@/lib/format";
import type { Action, AppState, CaseStatus, PathwayId, SupportCase } from "@/lib/types";

const PATHWAY_LABEL: Record<PathwayId, string> = {
  standard: "Standard process",
  guided: "Guided payment",
  specialist: "Specialist review",
};

/** The illustrative second approver. A real deployment uses the bank's own workflow. */
const SECOND_APPROVER = "Sam K. (team lead)";

const STATUS_COPY: Record<CaseStatus, { label: string; tone: "attn" | "calm" | "link" | "pos" }> = {
  review_needed: { label: "Review needed", tone: "attn" },
  guided_offered: { label: "Guided payment offered", tone: "link" },
  specialist_review: { label: "With a specialist", tone: "calm" },
  arrangement_offered: { label: "Arrangement offered", tone: "calm" },
  resolved: { label: "Resolved", tone: "pos" },
};

/**
 * Capital One Care Centre — the support handoff inbox.
 *
 * Requests arrive here only when a customer chooses to send one. Nothing is
 * inferred and nobody is being watched: the case holds exactly what the
 * customer reviewed, and the panel says, beside it, what was deliberately
 * not shared. Opening a case writes to its access log.
 *
 * Concessions are never automatic. An arrangement needs an eligibility check
 * and a second approver; a fee refund only follows a payment.
 */
export function SupportInbox({
  state,
  dispatch,
}: {
  state: AppState;
  dispatch: (action: Action) => void;
}) {
  const cases = state.supportCases;
  const current: SupportCase | null =
    [...cases].reverse().find((c) => c.status !== "resolved") ?? cases[cases.length - 1] ?? null;

  // Viewing a case is an access, and access is logged. Once per person.
  const currentId = current?.id;
  useEffect(() => {
    if (currentId) dispatch({ type: "OPEN_CASE", id: currentId, who: state.agentName });
  }, [currentId, dispatch, state.agentName]);

  return (
    <Panel bloom={current?.status === "review_needed" ? "attn" : "link"} className="p-4" aria-labelledby="inbox-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="inbox-heading" className="font-semibold text-fg">
            Support requests
          </h2>
          <p className="text-xs text-fg-3">
            Only what a customer chose to send. Nothing here is inferred.
          </p>
        </div>
        <StatusPill tone={cases.some((c) => c.status === "review_needed") ? "attn" : "neutral"}>
          {cases.filter((c) => c.status === "review_needed").length} awaiting review
        </StatusPill>
      </div>

      {!current ? (
        <div className="mt-3 rounded-xl border border-dashed border-edge px-4 py-3 text-center">
          <p className="text-sm font-medium text-fg-2">No requests yet.</p>
          <p className="mt-0.5 text-xs text-fg-3">
            When {state.customer.firstName} taps &ldquo;Help me resolve this&rdquo; and sends a request,
            it appears here instantly.
          </p>
        </div>
      ) : (
        <CaseDetail state={state} c={current} dispatch={dispatch} />
      )}
    </Panel>
  );
}

function CaseDetail({
  state,
  c,
  dispatch,
}: {
  state: AppState;
  c: SupportCase;
  dispatch: (action: Action) => void;
}) {
  const status = STATUS_COPY[c.status];
  const eligibility = arrangementEligibility(c, state);
  const eligible = eligibility.every((e) => e.pass);
  const paid = state.credit.status === "current";

  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-fg">Request #{c.ref}</h3>
        <StatusPill tone={status.tone}>{status.label}</StatusPill>
        <span className="text-xs text-fg-3">Received {clockTime(c.createdAt)}</span>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* ------------------------------------------- what was shared -- */}
        <div className="rounded-xl border border-link/25 bg-link-dim p-3">
          <p className="text-xs font-semibold tracking-[0.12em] text-link uppercase">
            What {state.customer.firstName} shared
          </p>
          <p className="mt-1.5 text-sm font-medium text-fg">{c.summary}</p>
          <blockquote className="mt-1.5 border-l-2 border-link/40 pl-3 text-sm text-fg-2 italic">
            &ldquo;{c.message}&rdquo;
          </blockquote>
          <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
            <Row label="Task" value={c.task} />
            <Row label="Amount" value={`${money(c.amount)} · was due ${shortDate(c.dueDate)}`} />
            <Row label="Difficulty" value={DIFFICULTY_LABEL[c.difficulty]} />
            <Row label="Asking for" value={HELP_LABEL[c.helpWanted]} />
            {c.canPay ? (
              <Row label="Could manage" value={`${money(c.canPay.amount)} on ${shortDate(c.canPay.date)}`} />
            ) : null}
            <Row
              label="Reply by"
              value={`${CHANNEL_LABEL[c.contact]}${c.keepRepliesShort ? " · keep it short" : ""}`}
            />
          </dl>
          <p className="mt-1.5 text-xs text-fg-3">
            Reviewed and sent by {state.customer.firstName} · drafted by {c.draftedBy === "claude" ? "Claude" : "the app"} from {state.customer.firstName}&apos;s answers
          </p>
        </div>

        {/* ---------------------------------------- deliberately withheld -- */}
        <div className="rounded-xl border border-edge p-3">
          <p className="text-xs font-semibold tracking-[0.12em] text-fg-3 uppercase">
            Deliberately not shared
          </p>
          <ul className="mt-1.5 space-y-1 text-xs text-fg-2">
            {NOT_SHARED.map((x) => (
              <li key={x} className="flex gap-2">
                <span aria-hidden="true" className="text-fg-3">
                  ✕
                </span>
                {x}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-fg-3">
            No field for any of these exists here. Proposed boundaries — production
            needs enforcement, audit trails, retention controls and legal review.
          </p>
        </div>
      </div>

      {/*
        The pathway comparison is shown while a decision is pending. Once a
        pathway is chosen it folds away to one line — the choice is made.
      */}
      {c.status === "review_needed" ? (
        <RescueSimulator
          state={state}
          supportCase={c}
          onGuided={() => dispatch({ type: "OFFER_GUIDED_PAYMENT", id: c.id })}
          onSpecialist={() =>
            dispatch({ type: "REFER_SPECIALIST", id: c.id, replyBy: isoDaysFromToday(2) })
          }
        />
      ) : c.status !== "resolved" ? (
        <Disclosure label={`Pathway chosen: ${PATHWAY_LABEL[c.pathway ?? "guided"]} · compare pathways`}>
          <RescueSimulator
            state={state}
            supportCase={c}
            onGuided={() => dispatch({ type: "OFFER_GUIDED_PAYMENT", id: c.id })}
            onSpecialist={() =>
              dispatch({ type: "REFER_SPECIALIST", id: c.id, replyBy: isoDaysFromToday(2) })
            }
          />
        </Disclosure>
      ) : null}

      {/* ---------------------------------- arrangement: checked + approved -- */}
      {c.status === "specialist_review" ? (
        <section className="rounded-xl border border-calm/25 bg-calm-dim p-3" aria-label="Arrangement request">
          <p className="text-xs font-semibold tracking-[0.12em] text-calm uppercase">
            Arrangement request · adviser
          </p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {eligibility.map((e) => (
              <li key={e.label} className="flex gap-2">
                <span aria-hidden="true" className={e.pass ? "text-pos" : "text-attn"}>
                  {e.pass ? "✓" : "—"}
                </span>
                <span>
                  <span className="text-fg">{e.label}</span>
                  <span className="block text-xs text-fg-3">{e.detail}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button
              size="md"
              variant="calm"
              disabled={!eligible}
              onClick={() =>
                dispatch({
                  type: "APPROVE_ARRANGEMENT",
                  id: c.id,
                  newDueDate: isoDaysFromToday(14),
                  approver: SECOND_APPROVER,
                })
              }
            >
              Approve as second approver
            </Button>
            <span className="text-sm text-fg-3">
              {eligible
                ? `Offers: pay on ${longDate(isoDaysFromToday(14))}. ${SECOND_APPROVER}, simulated.`
                : "Not eligible on these checks. Reply in writing instead."}
            </span>
          </div>
          <p className="mt-2 text-xs text-fg-3">
            Illustrative checks, not Capital One policy. Nothing is granted
            because someone asked, and nothing is granted by the software.
          </p>
        </section>
      ) : null}

      {/* -------------------------------------- goodwill, only after paying -- */}
      {paid && !state.credit.lateFeeRefunded && !state.credit.lateFeeWaivedByGrace ? (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-edge p-3" aria-label="Goodwill refund">
          <div>
            <p className="font-medium text-fg">Refund the {money(state.credit.lateFee)} late fee</p>
            <p className="text-sm text-fg-3">
              Optional, once a year, and only after payment. Paid ✓ · No refund in the last 12 months ✓
            </p>
          </div>
          <Button size="sm" variant="pos" onClick={() => dispatch({ type: "REFUND_LATE_FEE" })}>
            Refund
          </Button>
        </section>
      ) : null}

      {/* ------------------------------------------------------ access log -- */}
      <div className="border-t border-edge pt-2 text-xs">
        {c.accessLog.length === 0 ? (
          <p className="text-fg-3">Access log: not opened yet.</p>
        ) : (
          <>
            <p className="text-fg-2">
              <span className="font-semibold text-fg-3">Access log · </span>
              <span className="tnum text-fg-3">{clockTime(c.accessLog[c.accessLog.length - 1].at)}</span> ·{" "}
              {c.accessLog[c.accessLog.length - 1].who} — {c.accessLog[c.accessLog.length - 1].what}
            </p>
            {c.accessLog.length > 1 ? (
              <Disclosure label={`Show full log (${c.accessLog.length})`}>
                <ul className="space-y-0.5 text-fg-2">
                  {c.accessLog.map((e, i) => (
                    <li key={i}>
                      <span className="tnum text-fg-3">{clockTime(e.at)}</span> · {e.who} — {e.what}
                    </li>
                  ))}
                </ul>
              </Disclosure>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-fg-3">{label}</dt>
      <dd className="text-right text-fg">{value}</dd>
    </div>
  );
}
