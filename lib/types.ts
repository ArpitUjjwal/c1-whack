/**
 * Shared domain model for the "Make Credit Accessible" demo.
 *
 * A single `AppState` object is the one source of truth, mirrored into every
 * open tab (the customer phone view and the bank agent console) by
 * `useRealtimeSync`. Every field here is intentionally plain JSON so the whole
 * state can be structured-cloned over BroadcastChannel and JSON-serialised
 * into localStorage.
 */

export type Role = "customer" | "bank";

/** Who caused a thing to happen. Drives the icon + colour on the timeline. */
export type Actor = "customer" | "agent" | "system";

/** Emotional register of a message shown to the customer. Never "danger". */
export type Tone = "calm" | "warm" | "celebrate";

/**
 * Alex's everyday account. Capital One UK only offers credit cards, so this is
 * a current account at another bank, linked read-only over Open Banking. It
 * is what Safe-to-Spend reads and what a card payment is made from.
 */
export interface CurrentAccount {
  id: string;
  nickname: string;
  /** The other bank. Fictional. */
  provider: string;
  linkedVia: "Open Banking";
  balance: number;
  /** Hidden behind progressive disclosure — jargon stays out of the default view. */
  sortCode: string;
  accountNumber: string;
  type: "Current account";
}

export type CreditStatus =
  /** Payment is past its due date and nothing has been arranged yet. */
  | "overdue"
  /** Customer accepted an agent-offered extension; no action needed right now. */
  | "extended"
  /** Customer accepted a split plan; first instalment scheduled. */
  | "split_plan"
  /** Caught up. The happy state. */
  | "current";

export interface CreditAccount {
  id: string;
  nickname: string;
  /** Statement balance still owed on the card. */
  balance: number;
  creditLimit: number;
  minimumDue: number;
  /** ISO date (yyyy-mm-dd) the minimum was due. */
  dueDate: string;
  daysOverdue: number;
  status: CreditStatus;
  lateFee: number;
  /**
   * Goodwill is conditional on action: the fee can be refunded once a year,
   * after the customer has paid. Going quiet never earns it.
   */
  lateFeeRefunded: boolean;
  /** ISO date the payment is now due, when an extension has been granted. */
  extendedDueDate: string | null;
  apr: number;
  accountNumber: string;
  type: "Credit Card";
}

/** A scheduled outgoing payment, deducted from Safe-to-Spend. */
export interface Bill {
  id: string;
  name: string;
  amount: number;
  /** ISO date (yyyy-mm-dd). */
  dueDate: string;
  autopay: boolean;
  /** Emoji used as a quiet visual anchor — decorative, hidden from a11y tree. */
  icon: string;
}

/**
 * A message pushed from the agent console into the customer's app in real time.
 * Rendered as a gentle toast, never as a blocking alert.
 */
export interface Nudge {
  id: string;
  title: string;
  body: string;
  tone: Tone;
  /** Label for the optional single call-to-action. One choice, never a menu. */
  actionLabel?: string;
  /** Which in-app action the CTA performs. */
  action?: "focus_catchup" | "accept_extension" | "accept_split" | "dismiss";
  /** Display name of the agent who sent it, for trust. */
  fromAgent: string;
  createdAt: number;
  seen: boolean;
  dismissed: boolean;
}

export interface TimelineEvent {
  id: string;
  actor: Actor;
  title: string;
  detail?: string;
  at: number;
  /** Flags the behavioural-avoidance entry so the console can highlight it. */
  highlight?: boolean;
}

export interface CustomerProfile {
  name: string;
  firstName: string;
  memberSince: string;
  /** Self-declared accessibility needs, shown verbatim to the agent. */
  cognitiveProfile: string[];
  /** Days between the previous session and today — the avoidance signal. */
  daysSinceLastOpen: number;
  /** Flipped the moment the customer tab comes online. */
  openedAppToday: boolean;
  /** Free-text context the customer chose to share with support. */
  supportNote: string;
  /** Rules Alex set on a calm day for how we may contact them. */
  contactPreferences: ContactPreferences;
}

export type ContactChannel = "in_app" | "email" | "phone" | "letter";

/**
 * Consent-based contact rules, in the spirit of an Advance Choice Document:
 * set by the customer when things are fine, honoured when they are not. The
 * console shows them and warns on a breach; it never infers them.
 */
export interface ContactPreferences {
  channel: ContactChannel;
  /** At most this many messages in any rolling seven days. */
  maxPerWeek: number;
  /** Local hours, 0–23. No contact from `start` until `end`. */
  quietHours: { start: number; end: number };
  /** ISO date the customer set these. */
  setOn: string;
}

/** One contact made with the customer, on any channel. */
export interface ContactRecord {
  channel: ContactChannel;
  at: number;
  by: Actor;
}

export interface Flags {
  extensionOffered: boolean;
  extensionAccepted: boolean;
  splitPlanOffered: boolean;
  splitPlanAccepted: boolean;
  autopayEnabled: boolean;
  /** Set once the customer has cleared the overdue payment, drives celebration. */
  caughtUp: boolean;
  /** Count of things the customer has resolved — a low-key dopamine counter. */
  winsCount: number;
}

/**
 * Interface state the customer owns and the agent can see.
 *
 * Focus Mode lives in shared state on purpose: the console needs to know the
 * screen has been simplified (it changes what the agent should say), and the
 * customer's decision to decline it must survive a refresh so the app never
 * asks twice.
 */
export interface UiState {
  focusMode: boolean;
  /** Set once the customer turns the offer down. The app then stops asking. */
  focusDeclined: boolean;
  /** How many times Focus Mode has been offered this session. */
  focusOffers: number;
  /**
   * The customer's switch for the whole adaptive layer. Off means nothing is
   * measured, nothing is published, and Focus Mode is never offered.
   */
  adaptiveEnabled: boolean;
}

/** Demo Director position. Shared so both windows show the same beat. */
export interface DemoState {
  /** -1 when the director is not running. */
  beat: number;
  active: boolean;
}

/**
 * Live, per-tab measurements. Deliberately NOT part of `AppState`: these
 * change every second, and pushing them through the revision-counted state
 * would churn it constantly. They ride on an ephemeral `signal` message and
 * are dropped when the tab goes quiet, exactly like presence.
 */
export interface Telemetry {
  /** Cognitive load of the screen currently rendered — a property of the screen. */
  load: number;
  loadBand: string;
  /**
   * Interaction strain is a reading about the person, not the screen, so it
   * never leaves the customer's device. These fields exist only on the
   * customer tab's own copy and are never published to another window.
   */
  strain?: number;
  strainBand?: string;
  /** Alex's own choice, so the agent can see it. */
  focusMode: boolean;
  view: string;
  at: number;
}

/**
 * Things the Demo Director asks a surface to do. Kept off `AppState` because
 * they are instructions, not facts about the account.
 */
export type DemoAction =
  | "inject_strain"
  | "load_bad_example"
  | "rewrite_draft"
  | "send_draft";

export type Signal =
  | { type: "telemetry"; telemetry: Telemetry }
  | { type: "demo_action"; action: DemoAction };

export interface AppState {
  /** Monotonic revision. Receivers only accept a state with a higher `rev`. */
  rev: number;
  customer: CustomerProfile;
  current: CurrentAccount;
  credit: CreditAccount;
  bills: Bill[];
  nudges: Nudge[];
  timeline: TimelineEvent[];
  /** Every contact made, on every channel. Drives the frequency guard. */
  contactLog: ContactRecord[];
  flags: Flags;
  ui: UiState;
  demo: DemoState;
  /** Name shown on agent-authored messages. */
  agentName: string;
}

/** Live presence of one open tab. Never persisted — it is "who is looking now". */
export interface Presence {
  id: string;
  role: Role;
  /** Human-readable description of what that tab is doing. */
  view: string;
  at: number;
}

/* ------------------------------------------------------------------ actions */

export type Action =
  | { type: "CUSTOMER_CAME_ONLINE" }
  | { type: "CUSTOMER_VIEWED"; view: string }
  | { type: "PAY_CREDIT"; amount: number }
  | { type: "ENABLE_AUTOPAY" }
  | { type: "SEND_NUDGE"; nudge: Omit<Nudge, "id" | "createdAt" | "seen" | "dismissed"> }
  | { type: "MARK_NUDGES_SEEN" }
  | { type: "DISMISS_NUDGE"; id: string }
  | { type: "OFFER_EXTENSION"; newDueDate: string }
  | { type: "ACCEPT_EXTENSION" }
  | { type: "OFFER_SPLIT_PLAN" }
  | { type: "ACCEPT_SPLIT_PLAN" }
  | { type: "REFUND_LATE_FEE" }
  | { type: "SET_CONTACT_PREFERENCES"; preferences: ContactPreferences }
  | { type: "SET_ADAPTIVE"; on: boolean }
  | { type: "AGENT_NOTE"; text: string }
  | { type: "SET_FOCUS_MODE"; on: boolean }
  | { type: "DECLINE_FOCUS" }
  | { type: "OFFER_FOCUS" }
  | { type: "DEMO_SET_BEAT"; beat: number; active: boolean }
  | { type: "RESET_DEMO" };

/* ----------------------------------------------------------------- messages */

/** Wire format for cross-tab messages. */
export type SyncMessage =
  | { kind: "state"; state: AppState; from: string }
  | { kind: "request_state"; from: string }
  | { kind: "presence"; presence: Presence; from: string }
  /** Ephemeral, never persisted, never revision-counted. */
  | { kind: "signal"; signal: Signal; from: string; role: Role }
  | { kind: "bye"; from: string };
