"use client";

import { useEffect, useMemo, useState } from "react";
import { Meter } from "@/components/ui/Meter";
import { Panel } from "@/components/ui/Panel";
import { StatusPill } from "@/components/ui/StatusPill";
import { MIN_GROUP, buildInsights } from "@/lib/insights-data";
import { useRealtimeSync } from "@/lib/realtime";
import type { SupportCase } from "@/lib/types";

/**
 * Accessibility Insights.
 *
 * The aggregate view: what customers using the accessible journeys struggle
 * with most, which journeys are hardest, which responses actually work, and
 * what to change. It absorbs the old Friction Map as its "journeys" section.
 *
 * Built only from requests customers chose to send, journey completion and
 * pathway outcomes. Nothing from anyone's phone, no individual tracking, and
 * no group smaller than ten shown.
 *
 * Collapsed by default to one summary line and the recommendations, so the
 * console stays about the customer in front of the agent. "Show full report"
 * opens the three sections; the Demo Director's Insights beat opens it too.
 */
export function InsightsReport({ liveCases }: { liveCases: SupportCase[] }) {
  const report = useMemo(() => buildInsights(liveCases), [liveCases]);
  const [openJourney, setOpenJourney] = useState("repay");
  const [open, setOpen] = useState(false);
  const maxBarrier = report.barriers[0]?.count ?? 1;
  const { onSignal } = useRealtimeSync();

  // The guided demo's Insights beat opens the full report.
  useEffect(
    () =>
      onSignal((signal) => {
        if (signal.type === "demo_action" && signal.action === "show_insights") setOpen(true);
      }),
    [onSignal],
  );

  const topBarrier = report.barriers[0];
  const hardest = [...report.journeys].sort((a, b) => b.friction - a.friction)[0];
  const best = [...report.pathways].sort((a, b) => b.resolved - a.resolved)[0];

  return (
    <Panel className="p-4" aria-labelledby="insights-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="insights-heading" className="font-semibold text-fg">
            Accessibility Insights
          </h2>
          <StatusPill tone="neutral">Illustrative · {report.periodLabel.replace(" · illustrative", "")}</StatusPill>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="insights-full"
          className="min-h-[44px] text-sm font-semibold text-link hover:text-fg"
        >
          {open ? "Hide full report" : "Show full report"}
        </button>
      </div>

      {/* ------------------------------------------------- one-line summary -- */}
      <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
        {topBarrier ? (
          <div>
            <dt className="text-xs text-fg-3">Top barrier · {topBarrier.share}%</dt>
            <dd className="font-medium text-fg">{topBarrier.label}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-xs text-fg-3">Hardest journey · {hardest.friction}% stall</dt>
          <dd className="font-medium text-fg">{hardest.name}</dd>
        </div>
        <div>
          <dt className="text-xs text-fg-3">Best response · {best.resolved}% resolved</dt>
          <dd className="font-medium text-fg">{best.label}</dd>
        </div>
      </dl>

      {open ? (
      <div id="insights-full" className="mt-4 grid gap-5 border-t border-edge pt-4 xl:grid-cols-3">
        {/* ------------------------------------------------- top barriers -- */}
        <section aria-labelledby="barriers-heading">
          <h3 id="barriers-heading" className="text-xs font-semibold tracking-[0.12em] text-fg-3 uppercase">
            Top barriers · in customers&apos; own words
          </h3>
          <ol className="mt-3 space-y-3">
            {report.barriers.map((b, i) => (
              <li key={b.id}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-fg">
                    <span className="tnum mr-1.5 text-fg-3">{i + 1}.</span>
                    {b.label}
                    {b.live ? (
                      <span className="ml-1.5 text-xs font-semibold text-calm">+{b.live} this session</span>
                    ) : null}
                  </span>
                  <span className="tnum shrink-0 font-semibold text-fg">{b.share}%</span>
                </div>
                <Meter
                  className="mt-1.5"
                  value={b.count}
                  max={maxBarrier}
                  tone="calm"
                  height="sm"
                  label={`${b.label}: ${b.share} percent of requests`}
                  valueText={`${b.count} requests, ${b.share}%`}
                />
              </li>
            ))}
          </ol>
          {report.suppressedGroups ? (
            <p className="mt-3 text-xs text-fg-3">
              {report.suppressedGroups} group{report.suppressedGroups === 1 ? "" : "s"} hidden:
              fewer than {MIN_GROUP} people.
            </p>
          ) : null}
        </section>

        {/* ----------------------------------------------------- journeys -- */}
        <section aria-labelledby="journeys-heading">
          <h3 id="journeys-heading" className="text-xs font-semibold tracking-[0.12em] text-fg-3 uppercase">
            Hardest journeys · not people
          </h3>
          <ul className="mt-3 space-y-3">
            {report.journeys.map((j) => (
              <li key={j.id}>
                <button
                  type="button"
                  onClick={() => setOpenJourney(j.id)}
                  aria-expanded={j.steps ? openJourney === j.id : undefined}
                  className="w-full min-h-[44px] text-left"
                >
                  <span className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium text-fg">{j.name}</span>
                    <span className={j.band === "High" ? "text-attn" : j.band === "Moderate" ? "text-calm" : "text-pos"}>
                      {j.band}
                    </span>
                  </span>
                  <Meter
                    className="mt-1.5"
                    value={j.friction}
                    tone={j.band === "High" ? "attn" : j.band === "Moderate" ? "calm" : "pos"}
                    height="sm"
                    label={`${j.name}: ${j.friction} percent stall or abandon`}
                    valueText={`${j.friction}% stall or abandon`}
                  />
                </button>
                {j.steps && openJourney === j.id ? (
                  <ol className="mt-2 space-y-1 rounded-xl border border-edge p-3 text-sm">
                    {j.steps.map((s, i) => {
                      const drop = (i > 0 ? j.steps![i - 1].reached : 100) - s.reached;
                      return (
                        <li key={s.name} className="flex items-baseline justify-between gap-3">
                          <span className="text-fg-2">
                            {i + 1}. {s.name}
                            {drop >= 20 ? (
                              <span className="ml-1.5 text-xs font-semibold text-attn">−{drop}%</span>
                            ) : null}
                          </span>
                          <span className="tnum text-fg">{s.reached}%</span>
                        </li>
                      );
                    })}
                  </ol>
                ) : null}
              </li>
            ))}
          </ul>
        </section>

        {/* ------------------------------------------------- what works -- */}
        <section aria-labelledby="works-heading">
          <h3 id="works-heading" className="text-xs font-semibold tracking-[0.12em] text-fg-3 uppercase">
            What works · resolved in 30 days
          </h3>
          <ul className="mt-3 space-y-3">
            {report.pathways.map((p) => (
              <li key={p.id}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-fg">{p.label}</span>
                  <span className="tnum shrink-0 font-semibold text-fg">{p.resolved}%</span>
                </div>
                <Meter
                  className="mt-1.5"
                  value={p.resolved}
                  tone={p.resolved >= 60 ? "pos" : "attn"}
                  height="sm"
                  label={`${p.label}: ${p.resolved} percent resolved`}
                  valueText={`${p.resolved}% resolved, ${p.contacts} contacts on average`}
                />
                <p className="mt-1 text-xs text-fg-3">{p.contacts} contacts on average</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
      ) : null}

      {/* ---------------------------------------------- recommendations -- */}
      <section aria-labelledby="recs-heading" className="mt-3 border-t border-edge pt-3">
        <h3 id="recs-heading" className="text-xs font-semibold tracking-[0.12em] text-fg-3 uppercase">
          Recommendations
        </h3>
        <ul className={`mt-2 grid gap-2 ${open ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
          {report.recommendations.map((r) => (
            <li key={r.id} className="rounded-xl border border-edge bg-glass px-3 py-2">
              <StatusPill tone={r.kind === "product" ? "link" : "calm"}>
                {r.kind === "product" ? "Product change" : "In-app tip · live"}
              </StatusPill>
              <p className="mt-1 text-sm font-medium text-fg">{r.title}</p>
              {open ? <p className="mt-1 text-sm text-fg-2">{r.why}</p> : null}
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-3 text-xs text-fg-3">
        Built only from requests customers chose to send, journey completion and
        pathway outcomes. Never from anything on a customer&apos;s phone — Safe
        Mode, reading settings and the Time Machine stay there — and
        never from mental-health classifications. No group under {MIN_GROUP} is
        shown.
      </p>
    </Panel>
  );
}
