"use client";

import { useCallback, useMemo, useState } from "react";
import { ActivityTimeline } from "./ActivityTimeline";
import { AgentScriptPanel } from "./AgentScriptPanel";
import { CognitiveProfileHeader } from "./CognitiveProfileHeader";
import { InsightsReport } from "./InsightsReport";
import { LiveAccountPanel } from "./LiveAccountPanel";
import { PressureComposer } from "./PressureComposer";
import { SimulationTrack } from "./SimulationTrack";
import { SupportInbox } from "./SupportInbox";
import { TopBar } from "./TopBar";
import { DemoDirector } from "@/components/system/DemoDirector";
import { JudgeOverlay } from "@/components/system/JudgeOverlay";
import { buildAgentScript } from "@/lib/scripts";
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
  const script = useMemo(
    () => buildAgentScript(state, { customerOnline, customerView: null }),
    [state, customerOnline],
  );
  const customerPeers = peers.filter((peer) => peer.role === "customer").length;

  const [seedLine, setSeedLine] = useState<string | null>(null);

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
      <main
        id="bank-main"
        className="relative mx-auto max-w-[1800px] space-y-4 px-4 pt-5 pb-16 lg:px-6"
      >
        <CognitiveProfileHeader state={state} customerOnline={customerOnline} />

        {/* Desktop-first: the request and the reply side by side, stacking below. */}
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.9fr)_minmax(0,1.1fr)]">
          <SupportInbox state={state} dispatch={dispatch} />

          <div className="space-y-4">
            <PressureComposer key={seedLine ?? "composer"} state={state} onSend={sendNudge} now={now} />
            <AgentScriptPanel script={script} onUseLine={setSeedLine} />
          </div>
        </div>

        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
          <LiveAccountPanel state={state} safe={safe} />
          <ActivityTimeline state={state} now={now} hydrated={hydrated} />
        </div>

        <InsightsReport liveCases={state.supportCases} />

        <SimulationTrack />

        <p className="px-1 pb-4 text-xs text-fg-3">
          Prototype of Capital One Adaptive Support. Account facts and the
          requests a customer chooses to send are synchronised across windows over{" "}
          <code className="glass rounded px-1 py-0.5 text-fg-2">BroadcastChannel</code>{" "}
          with a{" "}
          <code className="glass rounded px-1 py-0.5 text-fg-2">localStorage</code>{" "}
          fallback. Nothing measured on the customer&apos;s device crosses over.
        </p>
      </main>

      {/* Presentation chrome. Excluded from every measurement. */}
      <DemoDirector role="bank" />
      <JudgeOverlay role="bank" measureRoot="#bank-main" />
    </div>
  );
}
