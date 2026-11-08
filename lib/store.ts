/**
 * The cross-window store.
 *
 * The shared `AppState` genuinely lives outside React — in `localStorage`, and
 * on a `BroadcastChannel` shared by every open tab. So it is modelled as an
 * external store and read through `useSyncExternalStore`, rather than as React
 * state kept in sync by effects.
 *
 * Transports, in order:
 *   1. `BroadcastChannel` — same-origin, instant, structured-clone, no server.
 *   2. A `localStorage` "bus" key — fallback for browsers without it. Writing
 *      a key fires `storage` in *other* tabs only, which is exactly the
 *      semantics we want. Envelopes carry an id so a tab receiving a message
 *      on both transports handles it once.
 *   3. A persisted snapshot — so a tab opened or refreshed mid-demo rejoins at
 *      the current state instead of resetting Alex's situation.
 *
 * What never travels: nothing the customer surface measures about the screen
 * or the person (load, strain, Safe Mode, Time Machine use) is sent. Those
 * stay on the device; the bank sees account facts and what the customer
 * explicitly chooses to share in a support request.
 *
 * Conflict resolution is a monotonic `rev`: a tab accepts an incoming state
 * only if its `rev` is higher than what it holds. For two windows that is
 * sufficient and, more importantly, completely predictable on stage.
 */

import { createInitialState } from "./demo-data";
import { reduce } from "./reducer";
import type {
  Action,
  AppState,
  Presence,
  Role,
  Signal,
  SyncMessage,
} from "./types";

const CHANNEL = "capital-one-accessible-credit";
const STATE_KEY = "c1a:state:v7";
const BUS_KEY = "c1a:bus:v7";

/** A peer counts as present if we have heard from it this recently. */
const PRESENCE_TTL_MS = 6000;
const HEARTBEAT_MS = 2000;
/** How often relative timestamps refresh. Coarse on purpose — low churn. */
const TICK_MS = 5000;

export type Transport = "broadcast-channel" | "storage" | "none";

export interface Snapshot {
  /** `null` until a client has seeded or loaded state. */
  state: AppState | null;
  /** Other tabs we have heard from recently. */
  peers: Presence[];
  selfId: string;
  selfRole: Role | null;
  selfView: string;
  transport: Transport;
  /** Milliseconds, refreshed on a slow tick so relative times stay honest. */
  now: number;
}

interface Envelope {
  eid: string;
  msg: SyncMessage;
}

const SERVER_SNAPSHOT: Snapshot = {
  state: null,
  peers: [],
  selfId: "",
  selfRole: null,
  selfView: "",
  transport: "none",
  now: 0,
};

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

class SyncStore {
  private listeners = new Set<() => void>();
  private snapshot: Snapshot = SERVER_SNAPSHOT;

  private state: AppState | null = null;
  private presence = new Map<string, Presence>();
  private seen = new Set<string>();
  private signalListeners = new Set<(signal: Signal, from: Role) => void>();

  private selfId = "";
  private selfRole: Role | null = null;
  private selfView = "";
  private transport: Transport = "none";

  private channel: BroadcastChannel | null = null;
  private heartbeat: number | null = null;
  private ticker: number | null = null;
  private started = false;

  /* -------------------------------------------- useSyncExternalStore surface */

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    if (!this.started) this.start();
    return () => {
      this.listeners.delete(listener);
      // The store is a demo singleton; a React remount in development should
      // not tear the transports down, so nothing is stopped here.
    };
  };

  getSnapshot = (): Snapshot => this.snapshot;

  getServerSnapshot = (): Snapshot => SERVER_SNAPSHOT;

  /* ------------------------------------------------------------- public API */

  /**
   * Declares which surface this tab is, and what it is showing. Called from an
   * effect, so it is always client-side. Presence is only announced once a
   * role is known.
   */
  setIdentity = (role: Role, view: string): void => {
    const changed = this.selfRole !== role || this.selfView !== view;
    this.selfRole = role;
    if (!this.selfView) this.selfView = view;
    if (changed) {
      this.announce();
      this.emit();
    }
  };

  /** Tell the other window which screen this one is on. */
  setView = (view: string): void => {
    if (this.selfView === view) return;
    this.selfView = view;
    this.announce();
    this.emit();
  };

  /**
   * Fire-and-forget message to every surface, including this one.
   *
   * `receive` deliberately drops own-origin messages (otherwise every tab
   * would process its own broadcasts), so local listeners are notified
   * directly here. Without this, the Demo Director could drive the other
   * window but not its own.
   */
  sendSignal = (signal: Signal): void => {
    if (!this.selfRole) return;
    this.post({ kind: "signal", from: this.selfId, role: this.selfRole, signal });
    for (const listener of this.signalListeners) listener(signal, this.selfRole);
  };

  /**
   * Subscribe to signals arriving from the other tab. Returns an unsubscribe.
   * Used by the customer surface to act on director instructions.
   */
  onSignal = (listener: (signal: Signal, from: Role) => void): (() => void) => {
    this.signalListeners.add(listener);
    return () => {
      this.signalListeners.delete(listener);
    };
  };

  dispatch = (action: Action): void => {
    const prev = this.state;
    if (!prev) return;
    const next = reduce(prev, action);
    if (next === prev) return;
    this.commit(next);
    this.post({ kind: "state", state: next, from: this.selfId });
  };

  /* ----------------------------------------------------------------- guts */

  private start(): void {
    this.started = true;
    if (typeof window === "undefined") return;

    this.selfId = randomId();

    if (typeof BroadcastChannel !== "undefined") {
      this.channel = new BroadcastChannel(CHANNEL);
      this.channel.onmessage = (event: MessageEvent<Envelope>) =>
        this.receive(event.data);
      this.transport = "broadcast-channel";
    } else {
      this.transport = "storage";
    }

    window.addEventListener("storage", this.onStorage);
    window.addEventListener("pagehide", this.onLeave);
    // Browsers throttle timers in hidden tabs, so a window coming back to the
    // front re-announces immediately rather than waiting for the next beat.
    document.addEventListener("visibilitychange", this.onVisible);
    window.addEventListener("focus", this.onVisible);

    // Join whatever the demo was already doing, or seed a fresh Alex.
    const stored = readStoredState();
    this.state = stored ?? createInitialState();
    writeStoredState(this.state);

    // Ask peers, in case a live tab is ahead of the persisted snapshot.
    this.post({ kind: "request_state", from: this.selfId });

    this.heartbeat = window.setInterval(this.announce, HEARTBEAT_MS);
    this.ticker = window.setInterval(this.tick, TICK_MS);

    this.emit();
  }

  /** Kept for completeness; the singleton lives for the page's lifetime. */
  stop(): void {
    if (this.heartbeat !== null) window.clearInterval(this.heartbeat);
    if (this.ticker !== null) window.clearInterval(this.ticker);
    window.removeEventListener("storage", this.onStorage);
    window.removeEventListener("pagehide", this.onLeave);
    document.removeEventListener("visibilitychange", this.onVisible);
    window.removeEventListener("focus", this.onVisible);
    this.channel?.close();
    this.channel = null;
    this.started = false;
  }

  private announce = (): void => {
    if (!this.selfRole || !this.selfId) return;
    this.post({
      kind: "presence",
      from: this.selfId,
      presence: {
        id: this.selfId,
        role: this.selfRole,
        view: this.selfView,
        at: Date.now(),
      },
    });
  };

  private onVisible = (): void => {
    if (document.visibilityState !== "visible") return;
    this.announce();
    // Catch up on anything missed while the timers were throttled.
    this.post({ kind: "request_state", from: this.selfId });
  };

  private onLeave = (): void => {
    if (this.selfId) this.post({ kind: "bye", from: this.selfId });
  };

  /** Drops peers that have gone quiet and advances relative timestamps. */
  private tick = (): void => {
    const t = Date.now();
    for (const [id, presence] of this.presence) {
      if (t - presence.at >= PRESENCE_TTL_MS) this.presence.delete(id);
    }
    // Always emits: the tick is also what advances relative timestamps.
    this.emit();
  };

  private commit(next: AppState): void {
    this.state = next;
    writeStoredState(next);
    this.emit();
  }

  private post(msg: SyncMessage): void {
    const envelope: Envelope = { eid: randomId() + randomId(), msg };
    this.seen.add(envelope.eid);
    try {
      this.channel?.postMessage(envelope);
    } catch {
      /* channel closed */
    }
    try {
      window.localStorage.setItem(BUS_KEY, JSON.stringify(envelope));
    } catch {
      /* private mode or quota — BroadcastChannel still carries it */
    }
  }

  private receive(envelope: Envelope | undefined): void {
    if (!envelope?.eid || this.seen.has(envelope.eid)) return;
    this.seen.add(envelope.eid);
    // Keep the dedupe set bounded over a long demo.
    if (this.seen.size > 500) this.seen = new Set([envelope.eid]);

    const msg = envelope.msg;
    if (!msg || msg.from === this.selfId) return;

    switch (msg.kind) {
      case "state": {
        if (!isIntactState(msg.state)) break;
        if (!this.state || msg.state.rev > this.state.rev) this.commit(msg.state);
        break;
      }
      case "request_state": {
        if (this.state) {
          this.post({ kind: "state", state: this.state, from: this.selfId });
        }
        break;
      }
      case "presence": {
        this.presence.set(msg.presence.id, msg.presence);
        this.emit();
        break;
      }
      case "signal": {
        for (const listener of this.signalListeners) listener(msg.signal, msg.role);
        break;
      }
      case "bye": {
        if (this.presence.delete(msg.from)) this.emit();
        break;
      }
    }
  }

  private onStorage = (event: StorageEvent): void => {
    if (event.key === BUS_KEY && event.newValue) {
      try {
        this.receive(JSON.parse(event.newValue) as Envelope);
      } catch {
        /* malformed */
      }
      return;
    }
    // A snapshot written by another tab is a valid signal in its own right.
    if (event.key === STATE_KEY && event.newValue) {
      try {
        const incoming = JSON.parse(event.newValue) as unknown;
        if (!isIntactState(incoming)) return;
        if (!this.state || incoming.rev > this.state.rev) {
          this.state = incoming;
          this.emit();
        }
      } catch {
        /* malformed */
      }
    }
  };

  /** Rebuilds the immutable snapshot and notifies React. */
  private emit(): void {
    this.snapshot = {
      state: this.state,
      peers: Array.from(this.presence.values()).filter(
        (peer) => peer.id !== this.selfId,
      ),
      selfId: this.selfId,
      selfRole: this.selfRole,
      selfView: this.selfView,
      transport: this.transport,
      now: Date.now(),
    };
    for (const listener of this.listeners) listener();
  }
}

/**
 * Shape check for any state arriving from outside this module.
 *
 * Every top-level branch the app dereferences without a guard is listed, so a
 * snapshot written by an older schema is rejected rather than crashing on a
 * returning visitor's first paint.
 *
 * This runs on the wire as well as on storage. A tab still running older code
 * can broadcast its own state here, and `rev` alone says nothing about shape —
 * trusting a peer because its revision is higher is how an old tab takes down
 * a new one.
 */
function isIntactState(value: unknown): value is AppState {
  const s = value as AppState | null;
  return (
    typeof s?.rev === "number" &&
    Boolean(s.credit) &&
    Boolean(s.current) &&
    Boolean(s.customer?.contactPreferences) &&
    Boolean(s.customer) &&
    Boolean(s.flags) &&
    typeof s.epoch === "number" &&
    typeof s.profileId === "string" &&
    Array.isArray(s.credit?.paymentHistory) &&
    Array.isArray(s.supportCases) &&
    Boolean(s.demo) &&
    Array.isArray(s.bills) &&
    Array.isArray(s.nudges) &&
    Array.isArray(s.timeline) &&
    Array.isArray(s.contactLog)
  );
}

function readStoredState(): AppState | null {
  try {
    const raw = window.localStorage.getItem(STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isIntactState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeStoredState(state: AppState): void {
  try {
    window.localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

/** One store per page. Both surfaces in a tab would share it, by design. */
export const syncStore = new SyncStore();
