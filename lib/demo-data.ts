import type { AppState } from "./types";
import { isoDaysFromToday } from "./format";

/**
 * Alex — the persona at the centre of the demo.
 *
 * Alex has a checking account, a credit card with a payment that slipped past
 * its due date 6 days ago, and a 14-day gap since the last time the app was
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
      cognitiveProfile: [
        "Prefers plain language",
        "Prone to financial avoidance",
        "One step at a time",
        "No urgency or pressure language",
      ],
      daysSinceLastOpen: 14,
      openedAppToday: false,
      supportNote:
        "Checking my balance makes me panic, so I put it off. Then it gets worse. Please keep it short and tell me the one thing to do.",
    },
    checking: {
      id: "chk-4417",
      nickname: "Everyday Checking",
      balance: 1284.6,
      routingNumber: "051405515",
      accountNumber: "000123454417",
      type: "Checking",
    },
    credit: {
      id: "cc-8842",
      nickname: "Quicksilver Card",
      balance: 842.15,
      creditLimit: 3000,
      minimumDue: 41,
      dueDate: isoDaysFromToday(-6),
      daysOverdue: 6,
      status: "overdue",
      lateFee: 29,
      lateFeeWaived: false,
      extendedDueDate: null,
      apr: 24.99,
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
        name: "Electric",
        amount: 88.4,
        dueDate: isoDaysFromToday(11),
        autopay: true,
        icon: "💡",
      },
    ],
    nudges: [],
    timeline: [
      {
        id: "tl-seed-1",
        actor: "system",
        title: "Payment due date passed",
        detail: "Minimum payment of $41.00 was not received.",
        at: now - 6 * 86_400_000,
      },
      {
        id: "tl-seed-2",
        actor: "system",
        title: "3 reminder emails sent — none opened",
        detail: "Standard collections cadence. No response.",
        at: now - 4 * 86_400_000,
      },
      {
        id: "tl-seed-3",
        actor: "system",
        title: "No app activity for 14 days",
        detail:
          "Matches Alex's self-declared avoidance pattern. Flagged for proactive, low-pressure outreach instead of another reminder.",
        at: now - 2 * 86_400_000,
        highlight: true,
      },
    ],
    ui: {
      focusMode: false,
      focusDeclined: false,
      focusOffers: 0,
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
