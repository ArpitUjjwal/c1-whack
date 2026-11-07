"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { ActionPanel } from "./ActionPanel";
import { ActivityTimeline } from "./ActivityTimeline";
import { AgentScriptPanel } from "./AgentScriptPanel";
import { CognitiveProfileHeader } from "./CognitiveProfileHeader";
import { CustomerLens } from "./CustomerLens";
import { LiveAccountPanel } from "./LiveAccountPanel";
import { PressureComposer } from "./PressureComposer";
import { SilenceModelPanel } from "./SilenceModelPanel";
import { SimulationTrack } from "./SimulationTrack";
import { TopBar } from "./TopBar";
import { DemoDirector } from "@/components/system/DemoDirector";
import { JudgeOverlay } from "@/components/system/JudgeOverlay";
import { runSilenceModel } from "@/lib/engines/silence-model";
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
    customerView,
    peers,
    hydrated,
    now,
    transport,
    telemetry,
  } = useRealtimeSync();

  const safe = useMemo(() => selectSafeToSpend(state), [state]);
  const silence = useMemo(() => runSilenceModel(state), [state]);
  const script = useMemo(
    () => buildAgentScript(state, { customerOnline, customerView }),
    [state, customerOnline, customerView],
  );
  const customerPeers = peers.filter((peer) => peer.role === "customer").length;

  const composerRef = useRef<HTMLDivElement>(null);
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
            "radial-gradient(70rem 40rem at 15% -10%, rgba(79,156,249,0.10), transparent 65%), radial-gradient(60rem 40rem at 90% 0%, rgba(157,140,255,0.08), transparent 65%)",
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
      />

      <main
        id="bank-main"
        className="relative mx-auto max-w-[1800px] space-y-4 px-4 py-5 lg:px-6"
      >
        <CognitiveProfileHeader
          state={state}
          customerOnline={customerOnline}
          customerView={customerView}
        />

        {/* Desktop-first: three columns on a wide screen, stacking below. */}
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="space-y-4">
            <CustomerLens
              telemetry={telemetry}
              online={customerOnline}
              adaptiveEnabled={state.ui.adaptiveEnabled}
            />
            <LiveAccountPanel state={state} safe={safe} />
          </div>

          <div className="space-y-4">
            <SilenceModelPanel reading={silence} />
            <ActivityTimeline state={state} now={now} hydrated={hydrated} />
          </div>

          <div ref={composerRef} className="space-y-4">
            <PressureComposer key={seedLine ?? "composer"} state={state} onSend={sendNudge} now={now} />
            <AgentScriptPanel script={script} onUseLine={setSeedLine} />
            <ActionPanel
              state={state}
              dispatch={dispatch}
              customerOnline={customerOnline}
              now={now}
            />
          </div>
        </div>

        <SimulationTrack />

        <p className="px-1 pb-4 text-xs text-fg-3">
          Prototype for the “Make Credit Accessible” challenge. Both surfaces
          share one state object, synchronised across windows over{" "}
          <code className="glass rounded px-1 py-0.5 text-fg-2">BroadcastChannel</code>{" "}
          with a{" "}
          <code className="glass rounded px-1 py-0.5 text-fg-2">localStorage</code>{" "}
          fallback. No server, no polling.
        </p>
      </main>

      {/* Presentation chrome. Excluded from every measurement. */}
      <DemoDirector role="bank" />
      <JudgeOverlay role="bank" measureRoot="#bank-main" />
    </div>
  );
}
