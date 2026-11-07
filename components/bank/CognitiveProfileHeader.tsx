"use client";

import { LiveDot } from "@/components/ui/LiveDot";
import { Panel } from "@/components/ui/Panel";
import { StatusPill } from "@/components/ui/StatusPill";
import type { AppState } from "@/lib/types";

/**
 * The first thing the agent reads — before the balance, before the arrears.
 *
 * Alex's declared needs sit above the money because they determine how the
 * next five minutes should go. Putting them in the header rather than behind
 * a notes tab is the whole point: an accommodation nobody reads is not an
 * accommodation.
 */
export function CognitiveProfileHeader({
  state,
  customerOnline,
  customerView,
}: {
  state: AppState;
  customerOnline: boolean;
  customerView: string | null;
}) {
  const { customer } = state;

  const appStatus = customerOnline
    ? customerView
      ? `In the app now · ${customerView}`
      : "In the app now"
    : customer.openedAppToday
      ? "Opened today · now offline"
      : "Offline";

  return (
    <Panel bloom="calm" className="p-5" aria-labelledby="profile-heading">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className="glass-2 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-semibold text-fg"
          >
            AR
          </span>
          <div>
            <h1 id="profile-heading" className="text-2xl font-semibold text-fg">
              {customer.name}
            </h1>
            <p className="text-sm text-fg-3">
              Customer since {customer.memberSince} · Checking ••••4417 · Card ••••8842
            </p>
            <p className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-fg-2">
              <LiveDot online={customerOnline} />
              {appStatus}
            </p>
          </div>
        </div>

        <div className="max-w-xl">
          <h2 className="text-xs font-semibold tracking-[0.12em] text-fg-3 uppercase">
            Self-declared accessibility needs
          </h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {customer.cognitiveProfile.map((need) => (
              <li key={need}>
                <StatusPill tone="calm">{need}</StatusPill>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <blockquote className="mt-5 rounded-xl border-l-2 border-calm bg-calm-dim p-4 text-[0.9375rem] text-fg-2">
        <p className="italic">&ldquo;{customer.supportNote}&rdquo;</p>
        <footer className="mt-1.5 text-xs font-medium text-calm not-italic">
          — In Alex&apos;s own words, from the accessibility preferences screen
        </footer>
      </blockquote>
    </Panel>
  );
}
