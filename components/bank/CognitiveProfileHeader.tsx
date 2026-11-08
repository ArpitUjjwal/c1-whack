"use client";

import { LiveDot } from "@/components/ui/LiveDot";
import { Panel } from "@/components/ui/Panel";
import { StatusPill } from "@/components/ui/StatusPill";
import { CHANNEL_LABEL, quietHoursLabel } from "@/lib/contact";
import { shortDate } from "@/lib/format";
import type { AppState } from "@/lib/types";

/**
 * The first thing the agent reads — before the balance, before the arrears.
 *
 * Alex's declared needs sit above the money because they determine how the
 * next five minutes should go. Putting them in the header rather than behind
 * a notes tab is the whole point: an accommodation nobody reads is not an
 * accommodation.
 *
 * Alex's contact preferences sit here too, as a banner: rules Alex set on a
 * calm day, honoured on a hard one. They are consent, not inference.
 */
export function CognitiveProfileHeader({
  state,
  customerOnline,
}: {
  state: AppState;
  customerOnline: boolean;
}) {
  const { customer } = state;
  const prefs = customer.contactPreferences;

  // Online or not, and nothing more: which screen the customer is on is not shared.
  const appStatus = customerOnline
    ? "In the app now"
    : customer.openedAppToday
      ? "Opened today · offline"
      : "Offline";

  return (
    <Panel bloom="calm" className="px-4 py-3" aria-labelledby="profile-heading">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="glass-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold text-fg"
          >
            {customer.name
              .split(" ")
              .map((part) => part[0])
              .join("")}
          </span>
          <div>
            <h1 id="profile-heading" className="text-lg leading-tight font-semibold text-fg">
              {customer.name}
            </h1>
            <p className="flex items-center gap-1.5 text-xs text-fg-3">
              <LiveDot online={customerOnline} />
              {appStatus} · since {customer.memberSince} · card ••••
              {state.credit.accountNumber.slice(-4)}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <h2 className="mr-1 text-xs font-semibold tracking-[0.12em] text-fg-3 uppercase">
            Prefers
          </h2>
          {customer.cognitiveProfile.length ? (
            <ul className="contents">
              {customer.cognitiveProfile.map((need) => (
                <li key={need}>
                  <StatusPill tone="calm">{need}</StatusPill>
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-sm text-fg-2">
              Nothing shared — plain language, one thing at a time, no pressure.
            </span>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-edge pt-2 text-xs text-fg-2">
        <span
          role="note"
          aria-label={`${customer.firstName}'s contact preferences`}
          className="flex flex-wrap gap-x-3 gap-y-1"
        >
          <span className="font-semibold text-fg">
            {customer.firstName}&apos;s rules ({shortDate(prefs.setOn)}):
          </span>
          <span>{CHANNEL_LABEL[prefs.channel]} only</span>
          <span>≤ {prefs.maxPerWeek} a week</span>
          <span>Never {quietHoursLabel(prefs)}</span>
          <span>
            {prefs.remindDaysBefore
              ? `Reminders ${prefs.remindDaysBefore} day${prefs.remindDaysBefore === 1 ? "" : "s"} before`
              : "No reminders"}
          </span>
        </span>
        {customer.supportNote ? (
          <span className="min-w-0 italic">
            · Note, shared by choice: &ldquo;{customer.supportNote}&rdquo;
          </span>
        ) : null}
      </div>
    </Panel>
  );
}
