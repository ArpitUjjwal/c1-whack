import type { AppState } from "./types";
import { isoDaysFromToday } from "./format";

/**
 * Alex's self-declared needs, in Alex's own phrasing. Exported so the Claude
 * prompt reads the same words the agent sees, rather than a paraphrase.
 */
export const ALEX_PROFILE = [
  "Prefers plain language",
  "Finds money tasks hard to start",
  "One step at a time",
  "No urgency or pressure language",
];

export const ALEX_SUPPORT_NOTE =
  "Checking my balance makes me panic, so I put it off. Then it gets worse. Please keep it short and tell me the one thing to do.";

/**
 * Alex — the persona at the centre of the demo.
 *
 * Alex has a Capital One UK credit card with a payment that slipped past its
 * due date 6 days ago, a current account at another bank linked over Open
 * Banking, and a 14-day gap since the last time the app was
 * opened. The gap is the point: avoidance is a symptom, not negligence, and
 * both surfaces are designed around that.
 */
export function createInitialState(): AppState {
  const now = Date.now();

  return {
    rev: 1,
    agentName: "Jordan P.",
    customer: {
      name: "Alex Rivera",
      firstName: "Alex",
      memberSince: "2021",
      cognitiveProfile: [...ALEX_PROFILE],
      daysSinceLastOpen: 14,
      openedAppToday: false,
      supportNote: ALEX_SUPPORT_NOTE,
      contactPreferences: {
        channel: "in_app",
        maxPerWeek: 2,
        quietHours: { start: 21, end: 8 },
        setOn: isoDaysFromToday(-65),
      },
    },
    current: {
      id: "cur-4417",
      nickname: "Everyday current account",
      provider: "Northgate Bank",
      linkedVia: "Open Banking",
      balance: 1284.6,
      sortCode: "20-45-77",
      accountNumber: "12344417",
      type: "Current account",
    },
    credit: {
      id: "cc-8842",
      nickname: "Classic card",
      balance: 842.15,
      creditLimit: 3000,
      minimumDue: 41,
      dueDate: isoDaysFromToday(-6),
      daysOverdue: 6,
      status: "overdue",
      lateFee: 12,
      lateFeeRefunded: false,
      extendedDueDate: null,
      apr: 34.9,
      accountNumber: "4417889200008842",
      type: "Credit Card",
    },
    bills: [
      {
        id: "bill-rent",
        name: "Rent",
        amount: 720,
        dueDate: isoDaysFromToday(4),
        autopay: false,
        icon: "🏠",
      },
      {
        id: "bill-phone",
        name: "Phone",
        amount: 55,
        dueDate: isoDaysFromToday(7),
        autopay: true,
        icon: "📱",
      },
      {
        id: "bill-electric",
        name: "Energy",
        amount: 88.4,
        dueDate: isoDaysFromToday(11),
        autopay: true,
        icon: "💡",
      },
    ],
    nudges: [],
    /*
      Spread over a fortnight, as a real cadence is: only the last one falls
      inside the current seven days, so Clarity's first message is the
      second contact this week, not the fourth.
    */
    contactLog: [
      { channel: "email", at: now - 13 * 86_400_000, by: "system" },
      { channel: "email", at: now - 9 * 86_400_000, by: "system" },
      { channel: "email", at: now - 5 * 86_400_000, by: "system" },
    ],
    timeline: [
      {
        id: "tl-seed-1",
        actor: "system",
        title: "Payment due date passed",
        detail: "Minimum payment of £41.00 was not received. £12 late fee added.",
        at: now - 6 * 86_400_000,
      },
      {
        id: "tl-seed-2",
        actor: "system",
        title: "3 reminder emails sent — none opened",
        detail: "Standard collections cadence, spread over the last fortnight. No response.",
        at: now - 4 * 86_400_000,
      },
      {
        id: "tl-seed-3",
        actor: "system",
        title: "No app activity for 14 days",
        detail:
          "Alex told us money tasks are hard to start. Flagged for proactive, low-pressure outreach instead of another reminder.",
        at: now - 2 * 86_400_000,
        highlight: true,
      },
    ],
    ui: {
      focusMode: false,
      focusDeclined: false,
      focusOffers: 0,
      adaptiveEnabled: true,
    },
    demo: {
      beat: -1,
      active: false,
    },
    flags: {
      extensionOffered: false,
      extensionAccepted: false,
      splitPlanOffered: false,
      splitPlanAccepted: false,
      autopayEnabled: false,
      caughtUp: false,
      winsCount: 0,
    },
  };
}
