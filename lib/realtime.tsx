"use client";

/**
 * React binding for the cross-window store in `lib/store.ts`.
 *
 * The provider is deliberately thin: it reads the external store through
 * `useSyncExternalStore`, tells the store which surface this tab is, and
 * holds back the tree until there is real state to render. Because the server
 * snapshot has no state, nothing date- or random-dependent is ever evaluated
 * during a prerender — which also rules out hydration mismatches on money
 * figures and timestamps.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { syncStore, type Transport } from "./store";
import type { Action, AppState, Presence, Role, Signal, Telemetry } from "./types";

interface RealtimeValue {
  state: AppState;
  dispatch: (action: Action) => void;
  /** True once the client store has seeded or loaded state. */
  hydrated: boolean;
  /** This tab's id. */
  selfId: string;
  /** Other tabs heard from in the last few seconds. */
  peers: Presence[];
  customerOnline: boolean;
  /** The screen the customer tab says it is on, for the agent's status line. */
  customerView: string | null;
  agentOnline: boolean;
  /** Tell the other window which screen this one is showing. */
  setView: (view: string) => void;
  /** Milliseconds, refreshed on a slow tick. Drives relative timestamps. */
  now: number;
  reset: () => void;
  transport: Transport;
  /** Live measurements from the customer surface, or null if it is quiet. */
  telemetry: Telemetry | null;
  /** Publish this tab's measurements. Call from a timer, never from render. */
  publishTelemetry: (telemetry: Telemetry) => void;
  /** Send an ephemeral instruction to the other surface. */
  sendSignal: (signal: Signal) => void;
  /** Subscribe to signals from the other surface. Returns an unsubscribe. */
  onSignal: (listener: (signal: Signal, from: Role) => void) => () => void;
}

const RealtimeContext = createContext<RealtimeValue | null>(null);

export function RealtimeProvider({
  role,
  initialView,
  fallback = null,
  children,
}: {
  role: Role;
  initialView: string;
  /** Shown for the frame before the client store comes up. */
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const snapshot = useSyncExternalStore(
    syncStore.subscribe,
    syncStore.getSnapshot,
    syncStore.getServerSnapshot,
  );

  // Announce what this tab is. Not React state, so no cascading render.
  useEffect(() => {
    syncStore.setIdentity(role, initialView);
  }, [role, initialView]);

  const { state, peers, selfId, selfView, transport, now, telemetry } = snapshot;

  const value = useMemo<RealtimeValue>(() => {
    const remoteCustomer = peers.find((peer) => peer.role === "customer") ?? null;
    return {
      state: state as AppState,
      dispatch: syncStore.dispatch,
      hydrated: state !== null,
      selfId,
      peers,
      customerOnline: role === "customer" || remoteCustomer !== null,
      customerView:
        remoteCustomer?.view ?? (role === "customer" ? selfView : null) ?? null,
      agentOnline: role === "bank" || peers.some((peer) => peer.role === "bank"),
      setView: syncStore.setView,
      now,
      reset: () => syncStore.dispatch({ type: "RESET_DEMO" }),
      transport,
      telemetry,
      publishTelemetry: syncStore.publishTelemetry,
      sendSignal: syncStore.sendSignal,
      onSignal: syncStore.onSignal,
    };
  }, [state, peers, selfId, selfView, transport, now, role, telemetry]);

  // Consumers only mount once there is state, so `state` is never null inside.
  if (!state) return <>{fallback}</>;

  return (
    <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
  );
}

export function useRealtimeSync(): RealtimeValue {
  const ctx = useContext(RealtimeContext);
  if (!ctx) {
    throw new Error("useRealtimeSync must be used inside a <RealtimeProvider>");
  }
  return ctx;
}
