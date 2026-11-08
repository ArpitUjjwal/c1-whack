"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { LiveDot } from "@/components/ui/LiveDot";
import { Panel } from "@/components/ui/Panel";
import { CREDIT_FILE_GENERAL } from "@/lib/compliance";
import type { Action, AppState } from "@/lib/types";
import { StrugglesSettings } from "./StrugglesSettings";
import { TrustPanel } from "./TrustPanel";
import type { DevicePrefs } from "@/lib/device";

/**
 * Where the customer's accessibility needs are declared — and the reason the
 * agent console can be so specific. Alex sets these once; every surface and
 * every agent honours them from then on.
 */
export function HelpPanel({
  state,
  agentOnline,
  onMessageAgent,
  dispatch,
  adaptiveEnabled,
  onToggleAdaptive,
  prefs,
  onChangePrefs,
}: {
  state: AppState;
  agentOnline: boolean;
  onMessageAgent: (text: string) => void;
  dispatch: (action: Action) => void;
  adaptiveEnabled: boolean;
  onToggleAdaptive: (on: boolean) => void;
  prefs: DevicePrefs;
  onChangePrefs: (patch: Partial<Omit<DevicePrefs, "epoch">>) => void;
}) {
  const [draft, setDraft] = useState("");
  const [sent, setSent] = useState(false);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    onMessageAgent(text);
    setDraft("");
    setSent(true);
    window.setTimeout(() => setSent(false), 4000);
  };

  return (
    <section aria-labelledby="help-heading" className="space-y-3">
      <h2 id="help-heading" className="px-1 text-lg font-semibold text-fg">
        Settings &amp; help
      </h2>

      <h3 className="px-1 pt-1 text-xs font-semibold tracking-[0.12em] text-fg-3 uppercase">
        Accessibility settings
      </h3>

      <StrugglesSettings state={state} prefs={prefs} onPrefs={onChangePrefs} dispatch={dispatch} />


      <TrustPanel
        state={state}
        dispatch={dispatch}
        adaptiveEnabled={adaptiveEnabled}
        onToggleAdaptive={onToggleAdaptive}
      />

      <Panel as="article" className="p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold text-fg">Your support team</h3>
          <span className="inline-flex items-center gap-1.5 text-xs text-fg-3">
            <LiveDot online={agentOnline} />
            {agentOnline ? `${state.agentName} is online` : "Nobody online right now"}
          </span>
        </div>
        <p className="mt-1 text-sm text-fg-3">
          Type as little as you like. No phone call unless you ask for one.
        </p>

        <label htmlFor="agent-message" className="mt-4 block text-sm font-medium text-fg">
          Send a message
        </label>
        <textarea
          id="agent-message"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={3}
          placeholder="e.g. I can't manage the full amount this month"
          className="mt-1.5 w-full resize-none rounded-xl border border-edge bg-glass p-3 text-[0.9375rem] text-fg placeholder:text-fg-3 focus:border-link focus:bg-glass-2"
        />
        <div className="mt-3 flex items-center gap-3">
          <Button size="md" variant="primary" onClick={send} disabled={!draft.trim()}>
            Send it
          </Button>
          <span aria-live="polite" className="text-sm font-medium text-pos">
            {sent ? "Sent. Someone will pick this up." : ""}
          </span>
        </div>
      </Panel>

      <Panel as="article" className="p-5">
        <h3 className="font-semibold text-fg">Plain-language glossary</h3>
        <dl className="mt-3 space-y-3 text-[0.9375rem]">
          <div>
            <dt className="font-medium text-fg">Minimum payment</dt>
            <dd className="text-fg-2">
              The smallest amount you can pay this month to keep the account in
              good standing.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-fg">Past due</dt>
            <dd className="text-fg-2">
              A payment that hasn&apos;t arrived by its date.{" "}
              {CREDIT_FILE_GENERAL}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-fg">APR</dt>
            <dd className="text-fg-2">
              The yearly cost of carrying a balance. Pay the whole balance and
              you pay none of it.
            </dd>
          </div>
        </dl>
      </Panel>
    </section>
  );
}
