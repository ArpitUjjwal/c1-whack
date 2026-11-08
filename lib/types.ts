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

/** Demo Director position. Shared so both windows show the same beat. */
export interface DemoState {
  /** -1 when the director is not running. */
  beat: number;
  active: boolean;
}

/**
 * Things the Demo Director asks a surface to do. Kept off `AppState` because
 * they are instructions, not facts about the account.
 */
export type DemoAction =
  | "inject_strain"
  | "load_bad_example"
  | "rewrite_draft"
  | "send_draft"
  | "enter_safe_mode"
  | "time_machine_week"
  | "advocate_open"
  | "advocate_send";

/**
 * Ephemeral cross-window instructions. Deliberately only demo choreography:
 * nothing measured on the customer's device is ever sent.
 */
export type Signal = { type: "demo_action"; action: DemoAction };

/* ------------------------------------------------------------ support -- */

/** What got in the way. Chosen by the customer, never inferred. */
export type Difficulty =
  /** Capacity, not money — and no reason asked for. */
  | "cant_face_it"
  | "cant_pay_full"
  | "dont_understand"
  | "cant_find_how"
  | "something_else";

/** The kind of help the customer asked for. */
export type HelpWanted = "simpler" | "explain" | "arrangement" | "call_back";

/** How the bank chose to respond, from the Rescue Simulator. */
export type PathwayId = "standard" | "guided" | "specialist";

export type CaseStatus =
  /** Arrived, nobody has acted yet. */
  | "review_needed"
  /** The bank offered an accessible, step-by-step way to pay. */
  | "guided_offered"
  /** Referred to a specialist adviser, who assesses under real policy. */
  | "specialist_review"
  /** An arrangement passed eligibility and a second approval, and was offered. */
  | "arrangement_offered"
  | "resolved";

/**
 * A consent-based support handoff.
 *
 * Everything in here was reviewed by the customer before it was sent — the
 * whole object is "what Capital One will see". There is deliberately no
 * field for mood, diagnosis, strain, Safe Mode, or anything the customer
 * explored in the Time Machine.
 */
export interface SupportCase {
  id: string;
  /** Human reference, e.g. 1042. */
  ref: number;
  createdAt: number;
  status: CaseStatus;
  /** The task the customer was attempting, in plain words. */
  task: string;
  amount: number;
  /** ISO date the payment was due. */
  dueDate: string;
  difficulty: Difficulty;
  helpWanted: HelpWanted;
  /** Optional: what the customer said they could manage, and when. */
  canPay: { amount: number; date: string } | null;
  contact: ContactChannel;
  /** The customer's own choice to ask for brief replies. */
  keepRepliesShort: boolean;
  /** The request in the customer's voice, as they approved it. */
  message: string;
  /** One-line summary for the support team. */
  summary: string;
  draftedBy: "local" | "claude";
  pathway: PathwayId | null;
  /** ISO date a specialist will reply by, once referred. */
  replyBy: string | null;
  /** Every time someone at the bank looked at or acted on the case. */
  accessLog: { who: string; what: string; at: number }[];
}

/** The fields a customer fills in; the reducer adds the rest. */
export type SupportRequest = Omit<
  SupportCase,
  "id" | "ref" | "createdAt" | "status" | "pathway" | "replyBy" | "accessLog"
>;

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
  /** Requests the customer chose to send. Newest last. */
  supportCases: SupportCase[];
  demo: DemoState;
  /**
   * Changes on every reset. Device-local preferences (Safe Mode, the welcome-
   * back card) key off it, so "Reset demo" clears them too without the bank
   * ever reading them.
   */
  epoch: number;
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
  | { type: "REQUEST_SUPPORT"; request: SupportRequest }
  /** Omitting `id` acts on the newest open case — lets the Demo Director drive it. */
  | { type: "OPEN_CASE"; id?: string; who: string }
  | { type: "OFFER_GUIDED_PAYMENT"; id?: string }
  | { type: "REFER_SPECIALIST"; id?: string; replyBy: string }
  | { type: "APPROVE_ARRANGEMENT"; id?: string; newDueDate: string; approver: string }
  | { type: "AGENT_NOTE"; text: string }
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
