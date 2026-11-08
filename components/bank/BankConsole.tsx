"use client";

import { useCallback, useMemo, useState } from "react";
import { ActivityTimeline } from "./ActivityTimeline";
import { AgentScriptPanel } from "./AgentScriptPanel";
import { CognitiveProfileHeader } from "./CognitiveProfileHeader";
import { InsightsReport } from "./InsightsReport";
import { LiveAccountPanel } from "./LiveAccountPanel";
import { NextActionBar } from "./NextActionBar";
import { PressureComposer } from "./PressureComposer";
import { SupportInbox } from "./SupportInbox";
import { TopBar } from "./TopBar";
import { DemoDirector } from "@/components/system/DemoDirector";
import { JudgeOverlay } from "@/components/system/JudgeOverlay";
import { buildAgentScript } from "@/lib/scripts";
import { useAgentScript } from "@/lib/ai/useAgentScript";
import { useRealtimeSync } from "@/lib/realtime";
import { selectSafeToSpend } from "@/lib/selectors";
import type { Tone } from "@/lib/types";

export function BankConsole() {
  const {
    state,
    dispatch,
    reset,
    customerOnline,
    peers,
    hydrated,
    now,
    transport,
  } = useRealtimeSync();

  const safe = useMemo(() => selectSafeToSpend(state), [state]);
  const localScript = useMemo(
    () => buildAgentScript(state, { customerOnline, customerView: null }),
    [state, customerOnline],
  );
  /*
    The template script renders immediately; a written one replaces it only if
    it arrives and clears the pressure check on the server. The agent never
    waits and never sees a spinner here.
  */
  const { script, source: scriptSource } = useAgentScript(state, localScript);

  const customerPeers = peers.filter((peer) => peer.role === "customer").length;

  /*
    A line chosen elsewhere — "Use" in the script, or the next-action bar —
    re-keys the composer with that line as its draft and focuses it. The
    counter makes choosing the same line twice still work.
  */
  const [seed, setSeed] = useState<{ line: string; n: number } | null>(null);
  const compose = useCallback(
    (line: string) => setSeed((prev) => ({ line, n: (prev?.n ?? 0) + 1 })),
    [],
  );

  const sendNudge = useCallback(
    (title: string, body: string, tone: Tone) => {
      dispatch({
        type: "SEND_NUDGE",
        nudge: { title, body, tone, fromAgent: state.agentName },
      });
    },
    [dispatch, state.agentName],
  );

  return (
    <div className="noise min-h-dvh bg-void">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(70rem 40rem at 15% -10%, rgba(15,86,184,0.07), transparent 65%), radial-gradient(60rem 40rem at 90% 0%, rgba(81,52,196,0.06), transparent 65%)",
        }}
      />

      <a
        href="#bank-main"
        className="sr-only-focusable absolute top-2 left-2 z-50 rounded-lg bg-fg px-3 py-2 text-sm font-semibold text-void"
      >
        Skip to main content
      </a>

      <TopBar
        agentName={state.agentName}
        transport={transport}
        peerCount={customerPeers}
        onReset={reset}
        profileId={state.profileId}
        onSwitchProfile={(profile) => dispatch({ type: "RESET_DEMO", profile })}
      />

      {/* The bottom padding clears the fixed demo hint bar, which sits at the
          foot of the viewport and otherwise covers the last line of the
          footer. */}
      {/* The bottom padding clears the fixed demo hint bar. */}
      <main
        id="bank-main"
        className="relative mx-auto max-w-[1800px] space-y-3 px-4 pt-4 pb-16 lg:px-6"
      >
        <CognitiveProfileHeader state={state} customerOnline={customerOnline} />

        <NextActionBar
          state={state}
          now={now}
          customerOnline={customerOnline}
          dispatch={dispatch}
          onCompose={compose}
        />

        {/*
          Desktop: the request and the account on the left, the reply on the
          right. Stacks below xl.
        */}
        <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            <SupportInbox state={state} dispatch={dispatch} />
            <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
              <LiveAccountPanel state={state} safe={safe} />
              <ActivityTimeline state={state} now={now} hydrated={hydrated} />
            </div>
          </div>

          <div className="space-y-3">
            <PressureComposer
              key={`composer-${seed?.n ?? 0}`}
              state={state}
              onSend={sendNudge}
              now={now}
              initialDraft={seed?.line}
              focusOnMount={seed !== null}
            />
            <AgentScriptPanel script={script} source={scriptSource} onUseLine={compose} />
          </div>
        </div>

        <InsightsReport liveCases={state.supportCases} />

        <p className="px-1 pb-4 text-xs text-fg-3">
          Prototype of Capital One Adaptive Support. Account facts and the requests
          a customer chooses to send sync across windows; nothing measured on the
          customer&apos;s device crosses over.
        </p>
      </main>

      {/* Presentation chrome. Excluded from every measurement. */}
      <DemoDirector role="bank" />
      <JudgeOverlay role="bank" measureRoot="#bank-main" />
    </div>
  );
}
