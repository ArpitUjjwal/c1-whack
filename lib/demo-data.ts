import type { AppState, Bill, Difficulty, HelpWanted, ProfileId } from "./types";
import { addDays, isoDaysFromToday, todayIso } from "./format";
import type { DevicePrefs } from "./device";
import { checkGrace } from "./engines/grace";
import { devicePatchFor, labelsFor, type StruggleId } from "./struggles";

/**
 * The three demo customers.
 *
 * Each has a different combination of access needs, described the way the
 * customer would describe them — preferences, not conditions. Adaptive
 * Support never asks for a diagnosis or a reason, so nothing here says why.
 *
 *  · Alex   — finds it hard to start money tasks. 14 days away; a card
 *             payment slipped past. The main guided demo.
 *  · Priya  — reads numbers more easily than paragraphs (dyslexia). Opened
 *             the app yesterday; confused by her statement.
 *  · Sam    — forgets dates and finds small print hard to read (memory and
 *             low vision). His card's Direct Debit bounced; a strong on-time
 *             record earns him the grace rule.
 */

export interface ProfileConfig {
  id: ProfileId;
  label: string;
  /** One line for the switcher: what this customer shows off. */
  summary: string;
  name: string;
  firstName: string;
  memberSince: string;
  /**
   * First-run setup. `onboarded: false` means the "what do you find hard?"
   * screens show on first open. The customer's phone settings and the labels
   * they share are both derived from `struggles`, so they always agree.
   */
  setup: { onboarded: boolean; struggles: StruggleId[]; shared: boolean };
  /** The note this customer shares with support (empty if not sharing). */
  supportNote: string;
  /** What the Demo Director picks in the setup, for a customer not yet set up. */
  demoSetup?: { struggles: StruggleId[]; share: boolean; note: string };
  daysSinceLastOpen: number;
  contact: { maxPerWeek: number; quietHours: { start: number; end: number }; remindDaysBefore: 0 | 1 | 2 | 3 };
  current: { provider: string; balance: number; sortCode: string; accountNumber: string };
  card: {
    nickname: string;
    balance: number;
    creditLimit: number;
    minimumDue: number;
    daysOverdue: number;
    apr: number;
    accountNumber: string;
    /** The card's own Direct Debit bounced this many days ago. */
    ddReturnedDaysAgo: number | null;
    directDebit: boolean;
    /** Last six statements, oldest first. */
    history: boolean[];
  };
  /** Emails already sent by the standard cadence, as days ago. */
  emailsDaysAgo: number[];
  /** Extra phone settings beyond what `setup.struggles` implies. */
  devicePrefs: Partial<DevicePrefs>;
  /** What the Demo Director prefills in the Advocate for this customer. */
  advocatePreset: { difficulty: Difficulty; helpWanted: HelpWanted };
}

type BillSeed = Omit<Bill, "dueDate"> & { inDays: number };

const PROFILES: Record<ProfileId, ProfileConfig & { billSeeds: BillSeed[] }> = {
  alex: {
    id: "alex",
    label: "Alex",
    summary: "Finds money tasks hard to start · 14 days away · card payment slipped",
    name: "Alex Rivera",
    firstName: "Alex",
    memberSince: "2021",
    // First time in the new app: nothing set up, nothing shared yet.
    setup: { onboarded: false, struggles: [], shared: false },
    supportNote: "",
    demoSetup: {
      struggles: ["overwhelmed", "calls"],
      share: true,
      note: "Keep it short and tell me the one thing to do.",
    },
    daysSinceLastOpen: 14,
    contact: { maxPerWeek: 2, quietHours: { start: 21, end: 8 }, remindDaysBefore: 2 },
    current: { provider: "Northgate Bank", balance: 1284.6, sortCode: "20-45-77", accountNumber: "12344417" },
    card: {
      nickname: "Classic card",
      balance: 842.15,
      creditLimit: 3000,
      minimumDue: 41,
      daysOverdue: 6,
      apr: 34.9,
      accountNumber: "4417889200008842",
      ddReturnedDaysAgo: null,
      directDebit: false,
      // Irregular: the grace rule needs six on time in a row, and they aren't.
      history: [true, false, true, true, false, true],
    },
    billSeeds: [
      { id: "bill-rent", name: "Rent", amount: 720, inDays: 4, autopay: false, icon: "🏠" },
      { id: "bill-phone", name: "Phone", amount: 55, inDays: 7, autopay: true, icon: "📱" },
      { id: "bill-energy", name: "Energy", amount: 88.4, inDays: 11, autopay: true, icon: "💡" },
    ],
    emailsDaysAgo: [13, 9, 5],
    devicePrefs: {},
    advocatePreset: { difficulty: "cant_face_it", helpWanted: "simpler" },
  },
  priya: {
    id: "priya",
    label: "Priya",
    summary: "Reads numbers more easily than paragraphs · statement confusion",
    name: "Priya Shah",
    firstName: "Priya",
    memberSince: "2019",
    setup: { onboarded: true, struggles: ["reading"], shared: true },
    supportNote: "I read numbers better than paragraphs. Put the amount and the date first.",
    daysSinceLastOpen: 1,
    contact: { maxPerWeek: 3, quietHours: { start: 22, end: 7 }, remindDaysBefore: 3 },
    current: { provider: "Harbourside Bank", balance: 960.3, sortCode: "40-11-62", accountNumber: "55102231" },
    card: {
      nickname: "Classic card",
      balance: 1310.5,
      creditLimit: 2500,
      minimumDue: 58,
      daysOverdue: 2,
      apr: 29.9,
      accountNumber: "4417889200006718",
      ddReturnedDaysAgo: null,
      directDebit: false,
      history: [true, true, true, false, true, true],
    },
    billSeeds: [
      { id: "bill-broadband", name: "Broadband", amount: 32, inDays: 3, autopay: true, icon: "🌐" },
      { id: "bill-rent", name: "Rent", amount: 650, inDays: 6, autopay: false, icon: "🏠" },
      { id: "bill-council", name: "Council tax", amount: 118, inDays: 9, autopay: true, icon: "🏛️" },
    ],
    emailsDaysAgo: [1],
    devicePrefs: {},
    advocatePreset: { difficulty: "dont_understand", helpWanted: "explain" },
  },
  sam: {
    id: "sam",
    label: "Sam",
    summary: "Forgets dates, small print is hard to read · Direct Debit bounced",
    name: "Sam Okafor",
    firstName: "Sam",
    memberSince: "2016",
    setup: { onboarded: true, struggles: ["seeing", "remembering", "calls"], shared: true },
    supportNote: "I forget dates and small print is hard to read. Remind me, and make it big.",
    daysSinceLastOpen: 9,
    contact: { maxPerWeek: 2, quietHours: { start: 21, end: 8 }, remindDaysBefore: 3 },
    current: { provider: "Northgate Bank", balance: 412.75, sortCode: "20-45-90", accountNumber: "70338810" },
    card: {
      nickname: "Platinum card",
      balance: 640,
      creditLimit: 1500,
      minimumDue: 25,
      daysOverdue: 3,
      apr: 34.9,
      accountNumber: "4417889200008810",
      ddReturnedDaysAgo: 3,
      directDebit: true,
      // Six on time in a row: the grace rule applies to this one slip.
      history: [true, true, true, true, true, true],
    },
    billSeeds: [
      { id: "bill-phone", name: "Phone", amount: 20, inDays: 2, autopay: true, icon: "📱" },
      { id: "bill-rent", name: "Rent", amount: 495, inDays: 5, autopay: false, icon: "🏠" },
      { id: "bill-water", name: "Water", amount: 34, inDays: 12, autopay: true, icon: "💧" },
    ],
    emailsDaysAgo: [2],
    devicePrefs: {},
    advocatePreset: { difficulty: "dd_failed", helpWanted: "simpler" },
  },
};

export const PROFILE_IDS: ProfileId[] = ["alex", "priya", "sam"];

/** The shared preference labels this customer starts with (empty if not sharing). */
export function startingLabels(p: ProfileConfig): string[] {
  return p.setup.shared ? labelsFor(p.setup.struggles) : [];
}

/**
 * What this customer's phone already holds when the demo starts: settings
 * derived from their setup choices, plus the setup state itself.
 */
export function startingDevicePrefs(id: ProfileId): Partial<DevicePrefs> {
  const p = profileConfig(id);
  return {
    ...devicePatchFor(p.setup.struggles),
    ...p.devicePrefs,
    onboarded: p.setup.onboarded,
    struggles: [...p.setup.struggles],
    sharePreferences: p.setup.shared,
  };
}

export function profileConfig(id: ProfileId): ProfileConfig {
  // Unknown ids (old saved state, a typo) fall back to Alex rather than crash.
  return PROFILES[id] ?? PROFILES.alex;
}

/** Statement months, oldest first, ending last month. */
function historyMonths(count: number): string[] {
  const today = todayIso();
  const [y, m] = today.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (count - i), 1));
    return d.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
  });
}

export function createInitialState(profileId: ProfileId = "alex"): AppState {
  const now = Date.now();
  const p = PROFILES[profileId] ?? PROFILES.alex;
  const dueDate = isoDaysFromToday(-p.card.daysOverdue);
  const months = historyMonths(p.card.history.length);
  const dd = p.card.ddReturnedDaysAgo;
  const paymentHistory = p.card.history.map((onTime, i) => ({ month: months[i], onTime }));
  // The fee was assessed when the date passed; the grace rule decides it then.
  const grace = checkGrace({ paymentHistory, graceUsedOn: null }, dueDate);

  const timeline: AppState["timeline"] = [
    dd !== null
      ? {
          id: "tl-seed-dd",
          actor: "system",
          title: "Direct Debit returned unpaid",
          detail: `The ${p.current.provider} account was short on the day. Minimum of £${p.card.minimumDue.toFixed(2)} not collected.`,
          at: now - dd * 86_400_000,
        }
      : {
          id: "tl-seed-1",
          actor: "system",
          title: "Payment due date passed",
          detail: `Minimum payment of £${p.card.minimumDue.toFixed(2)} was not received.`,
          at: now - p.card.daysOverdue * 86_400_000,
        },
    {
      id: "tl-seed-2",
      actor: "system",
      title: `${p.emailsDaysAgo.length} reminder email${p.emailsDaysAgo.length === 1 ? "" : "s"} sent — none opened`,
      detail:
        p.emailsDaysAgo.length > 1
          ? "Standard collections cadence, spread over the last fortnight. No response."
          : "Standard cadence. No response yet.",
      at: now - Math.min(...p.emailsDaysAgo) * 86_400_000,
    },
  ];
  if (grace.eligible) {
    timeline.push({
      id: "tl-seed-grace",
      actor: "system",
      title: "Late fee waived — grace rule",
      detail: `${grace.reason} No one had to ask.`,
      at: now - p.card.daysOverdue * 86_400_000 + 60_000,
    });
  }
  if (p.daysSinceLastOpen >= 7) {
    timeline.push({
      id: "tl-seed-3",
      actor: "system",
      title: `No app activity for ${p.daysSinceLastOpen} days`,
      detail: "Emails unopened. Flagged for one in-app message instead of another reminder.",
      at: now - 2 * 86_400_000,
      highlight: true,
    });
  }

  return {
    rev: 1,
    profileId,
    agentName: "Jordan P.",
    customer: {
      name: p.name,
      firstName: p.firstName,
      memberSince: p.memberSince,
      cognitiveProfile: startingLabels(p),
      daysSinceLastOpen: p.daysSinceLastOpen,
      openedAppToday: false,
      supportNote: p.setup.shared ? p.supportNote : "",
      contactPreferences: {
        channel: "in_app",
        maxPerWeek: p.contact.maxPerWeek,
        quietHours: p.contact.quietHours,
        remindDaysBefore: p.contact.remindDaysBefore,
        setOn: isoDaysFromToday(-65),
      },
    },
    current: {
      id: `cur-${p.current.accountNumber.slice(-4)}`,
      nickname: "Everyday current account",
      provider: p.current.provider,
      linkedVia: "Open Banking",
      balance: p.current.balance,
      sortCode: p.current.sortCode,
      accountNumber: p.current.accountNumber,
      type: "Current account",
    },
    credit: {
      id: `cc-${p.card.accountNumber.slice(-4)}`,
      nickname: p.card.nickname,
      balance: p.card.balance,
      creditLimit: p.card.creditLimit,
      minimumDue: p.card.minimumDue,
      dueDate,
      daysOverdue: p.card.daysOverdue,
      status: "overdue",
      lateFee: 12,
      lateFeeRefunded: false,
      extendedDueDate: null,
      ddReturnedOn: dd !== null ? addDays(todayIso(), -dd) : null,
      paymentHistory,
      graceUsedOn: grace.eligible ? dueDate : null,
      lateFeeWaivedByGrace: grace.eligible,
      apr: p.card.apr,
      accountNumber: p.card.accountNumber,
      type: "Credit Card",
    },
    bills: p.billSeeds.map(({ inDays, ...bill }) => ({ ...bill, dueDate: isoDaysFromToday(inDays) })),
    nudges: [],
    /*
      Spread as a real cadence is. For Alex only the last email falls inside
      the current seven days, so the first in-app message is the second
      contact this week, not the fourth.
    */
    contactLog: p.emailsDaysAgo.map((d) => ({
      channel: "email" as const,
      at: now - d * 86_400_000,
      by: "system" as const,
    })),
    timeline: timeline.sort((a, b) => a.at - b.at),
    supportCases: [],
    demo: { beat: -1, active: false },
    epoch: now,
    flags: {
      extensionOffered: false,
      extensionAccepted: false,
      splitPlanOffered: false,
      splitPlanAccepted: false,
      autopayEnabled: p.card.directDebit,
      caughtUp: false,
      winsCount: 0,
    },
  };
}
