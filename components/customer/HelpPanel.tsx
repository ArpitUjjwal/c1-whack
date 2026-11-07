"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { LiveDot } from "@/components/ui/LiveDot";
import { Panel } from "@/components/ui/Panel";
import { StatusPill } from "@/components/ui/StatusPill";
import { CREDIT_FILE_GENERAL } from "@/lib/compliance";
import type { Action, AppState } from "@/lib/types";
import { TrustPanel } from "./TrustPanel";

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
}: {
  state: AppState;
  agentOnline: boolean;
  onMessageAgent: (text: string) => void;
  dispatch: (action: Action) => void;
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
        Help, your way
      </h2>

      <Panel as="article" className="p-5">
        <h3 className="font-semibold text-fg">How you like to be helped</h3>
        <p className="mt-1 text-sm text-fg-3">
          You told us this, and everyone who helps you can see it.
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {state.customer.cognitiveProfile.map((need) => (
            <li key={need}>
              <StatusPill tone="calm">{need}</StatusPill>
            </li>
          ))}
        </ul>
        <blockquote className="mt-4 rounded-xl border-l-2 border-calm bg-calm-dim p-3.5 text-[0.9375rem] text-fg-2 italic">
          &ldquo;{state.customer.supportNote}&rdquo;
        </blockquote>
      </Panel>

      <TrustPanel state={state} dispatch={dispatch} />

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
