"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { simulatePathways, type Pathway } from "@/lib/engines/rescue-sim";
import type { AppState, PathwayId, SupportCase } from "@/lib/types";

/**
 * Explore a support pathway before offering anything.
 *
 * Three tabs, each showing what that response would look like from the
 * customer's side. The bank isn't just receiving an alert; it is choosing
 * how the next interaction should feel, and it can see the cost of doing
 * nothing in the first tab.
 */
export function RescueSimulator({
  state,
  supportCase,
  onGuided,
  onSpecialist,
}: {
  state: AppState;
  supportCase: SupportCase;
  onGuided: () => void;
  onSpecialist: () => void;
}) {
  const pathways = simulatePathways(supportCase, state);
  const [active, setActive] = useState<PathwayId>(supportCase.pathway ?? "guided");
  const baseId = useId();
  const decided = supportCase.status !== "review_needed";
  const current = pathways.find((p) => p.id === active) ?? pathways[0];

  return (
    <section aria-labelledby={`${baseId}-h`} className="rounded-xl border border-edge p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={`${baseId}-h`} className="font-semibold text-fg">
          Explore a support pathway
        </h3>
        <span className="text-xs text-fg-3">Financial Rescue Simulator</span>
      </div>

      <div role="tablist" aria-label="Support pathways" className="mt-3 grid gap-2 sm:grid-cols-3">
        {pathways.map((p) => (
          <button
            key={p.id}
            id={`${baseId}-tab-${p.id}`}
            type="button"
            role="tab"
            aria-selected={active === p.id}
            aria-controls={`${baseId}-panel`}
            onClick={() => setActive(p.id)}
            className={`min-h-[44px] rounded-xl border px-3 py-2 text-left text-sm font-semibold transition-colors ${
              active === p.id
                ? "border-link bg-link-dim text-fg"
                : "border-edge bg-glass text-fg-3 hover:text-fg-2"
            }`}
          >
            {p.label}
            {supportCase.pathway === p.id ? (
              <span className="ml-1.5 text-xs font-normal text-pos">chosen</span>
            ) : null}
          </button>
        ))}
      </div>

      <div
        id={`${baseId}-panel`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${current.id}`}
        className="mt-3"
      >
        <PathwayDetail pathway={current} />

        <div className="mt-3 flex flex-wrap items-center gap-3">
          {current.action === "none" ? (
            <p className="text-sm text-fg-3">{current.actionLabel}.</p>
          ) : (
            <Button
              size="md"
              variant={current.action === "guided" ? "calm" : "primary"}
              disabled={decided}
              onClick={current.action === "guided" ? onGuided : onSpecialist}
            >
              {current.actionLabel}
            </Button>
          )}
          {decided && current.action !== "none" ? (
            <span className="text-sm text-fg-3">A pathway has been chosen for this request.</span>
          ) : null}
        </div>
      </div>

      <p className="mt-3 text-xs text-fg-3">
        Illustrative operational simulation, not a real Capital One policy
        engine or a prediction of customer outcomes.
      </p>
    </section>
  );
}

function PathwayDetail({ pathway: p }: { pathway: Pathway }) {
  const tone =
    p.outcomeTone === "red"
      ? "border-red/30 text-red-fg"
      : p.outcomeTone === "attn"
        ? "border-attn/30 text-attn"
        : p.outcomeTone === "pos"
          ? "border-pos/30 text-pos"
          : "border-calm/30 text-calm";

  return (
    <div>
      <p className="text-[0.9375rem] text-fg-2">{p.summary}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <StatusPill tone="neutral">
          {p.touchpoints} contact{p.touchpoints === 1 ? "" : "s"}
        </StatusPill>
        <StatusPill tone={p.customerEffort === "Low" ? "pos" : p.customerEffort === "Medium" ? "calm" : "attn"}>
          Customer effort: {p.customerEffort}
        </StatusPill>
      </div>
      <ol className="mt-3 space-y-1.5 text-sm">
        {p.steps.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span className="w-20 shrink-0 text-xs font-semibold tracking-wide text-fg-3 uppercase">
              {s.who === "bank" ? "Capital One" : "Customer"}
            </span>
            <span className="text-fg-2">{s.text}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-sm text-fg-3">
        <span className="font-semibold text-fg-2">Assumes:</span> {p.assumes}
      </p>
      <div className={`mt-3 rounded-xl border bg-glass p-3 ${tone}`}>
        <p className="text-xs font-semibold tracking-[0.12em] uppercase">Simulated outcome</p>
        <p className="mt-1 text-[0.9375rem] font-medium text-fg">{p.outcome}</p>
      </div>
    </div>
  );
}
