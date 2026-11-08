/**
 * Accessibility Insights — the aggregate view.
 *
 * What customers using the accessible journeys struggle with most, and what
 * actually helps. Built only from data the bank legitimately holds:
 *
 *  · the category a customer chose when they sent a support request
 *    (they chose to share it, and chose the words),
 *  · journey completion — whether a payment or a dispute got finished,
 *  · which support pathway resolved a request.
 *
 * Deliberately NOT used, because the customer was promised it never leaves
 * the phone: Safe Mode, reading settings, read-aloud, Time Machine activity,
 * strain. And no group smaller than ten people is ever shown, so no figure
 * can point to an individual.
 *
 * The figures are illustrative mock data for the demo, labelled as such on
 * screen. Requests sent in this session are added live on top.
 */

import { DIFFICULTY_LABEL } from "./advocate";
import { FOCUS_LOAD_AFTER, FOCUS_LOAD_BEFORE } from "./engines/cognitive-load";
import type { Difficulty, PathwayId, SupportCase } from "./types";

/** Groups smaller than this are suppressed. */
export const MIN_GROUP = 10;

/** Illustrative: requests over the last 90 days, by the customer's chosen category. */
const BASE_BARRIERS: Record<Difficulty, number> = {
  cant_face_it: 1184,
  cant_pay_full: 912,
  dont_understand: 731,
  dd_failed: 538,
  cant_find_how: 296,
  something_else: 7, // below the threshold: suppressed on screen
};

export interface BarrierRow {
  id: Difficulty;
  label: string;
  count: number;
  share: number;
  /** Requests from this demo session included in the count. */
  live: number;
}

export interface JourneyRow {
  id: string;
  name: string;
  /** Share of started journeys that stall or are abandoned. */
  friction: number;
  band: "High" | "Moderate" | "Lower";
  steps?: { name: string; reached: number }[];
}

export interface PathwayRow {
  id: PathwayId;
  label: string;
  /** Share of requests resolved within 30 days on this pathway. */
  resolved: number;
  /** Average contacts the customer received. */
  contacts: number;
}

export interface Recommendation {
  id: string;
  title: string;
  why: string;
  /** Where it lands: a product change, or a tip in the app. */
  kind: "product" | "in-app tip";
}

export interface InsightsReport {
  periodLabel: string;
  totalRequests: number;
  barriers: BarrierRow[];
  suppressedGroups: number;
  journeys: JourneyRow[];
  pathways: PathwayRow[];
  recommendations: Recommendation[];
}

const JOURNEYS: JourneyRow[] = [
  {
    id: "repay",
    name: "Credit repayment",
    friction: 68,
    band: "High",
    steps: [
      { name: "See the amount due", reached: 100 },
      { name: "Choose the account to pay from", reached: 83 },
      { name: "Terms, APR and options screen", reached: 49 },
      { name: "Confirm the payment", reached: 44 },
    ],
  },
  { id: "statement", name: "Understanding a statement", friction: 57, band: "High" },
  { id: "dispute", name: "Disputing a transaction", friction: 41, band: "Moderate" },
  { id: "dd", name: "Setting up a Direct Debit", friction: 19, band: "Lower" },
];

const PATHWAYS: PathwayRow[] = [
  { id: "guided", label: "Accessible guided payment", resolved: 78, contacts: 1.2 },
  { id: "specialist", label: "Specialist support review", resolved: 64, contacts: 2.4 },
  { id: "standard", label: "Standard process", resolved: 31, contacts: 4.6 },
];

export function buildInsights(liveCases: SupportCase[]): InsightsReport {
  const live: Partial<Record<Difficulty, number>> = {};
  for (const c of liveCases) live[c.difficulty] = (live[c.difficulty] ?? 0) + 1;

  const all = (Object.keys(BASE_BARRIERS) as Difficulty[]).map((id) => ({
    id,
    label: DIFFICULTY_LABEL[id],
    count: BASE_BARRIERS[id] + (live[id] ?? 0),
    live: live[id] ?? 0,
  }));
  const total = all.reduce((s, r) => s + r.count, 0);
  const shown = all.filter((r) => r.count >= MIN_GROUP);

  const barriers = shown
    .map((r) => ({ ...r, share: Math.round((r.count / total) * 100) }))
    .sort((a, b) => b.count - a.count);

  return {
    periodLabel: "Last 90 days · illustrative",
    totalRequests: total,
    barriers,
    suppressedGroups: all.length - shown.length,
    journeys: JOURNEYS,
    pathways: PATHWAYS,
    recommendations: recommend(barriers),
  };
}

/**
 * Recommendations follow from the figures above, so they change if the data
 * does. Each says where it lands: a change to the product, or a tip shown in
 * the app to everyone on that screen (never targeted at an individual).
 */
function recommend(barriers: BarrierRow[]): Recommendation[] {
  const top = barriers[0];
  const share = (id: Difficulty) => barriers.find((b) => b.id === id)?.share ?? 0;
  const guided = PATHWAYS.find((p) => p.id === "guided")!;
  const standard = PATHWAYS.find((p) => p.id === "standard")!;

  return [
    {
      id: "guided-default",
      kind: "product",
      title: `Make guided payment the first response to “${top.label}”`,
      why: `It's the most common request (${top.share}%), and guided payment resolves ${guided.resolved}% within 30 days in ${guided.contacts} contacts, against ${standard.resolved}% and ${standard.contacts} for the standard process.`,
    },
    {
      id: "terms-screen",
      kind: "product",
      title: "Fold APR and terms behind “Show the details” on the repayment journey",
      why: `34% of people drop off at the terms screen (83% → 49%) — the biggest single loss. The simplified version measures ${FOCUS_LOAD_BEFORE} → ${FOCUS_LOAD_AFTER} on cognitive load.`,
    },
    {
      id: "listen-tip",
      kind: "in-app tip",
      title: "Offer “Listen” on payment and statement screens",
      why: `${share("dont_understand")}% of requests are “I don't understand what I owe”, and understanding a statement is the second-hardest journey.`,
    },
    {
      id: "reminder-tip",
      kind: "in-app tip",
      title: "Suggest payment reminders on the Time Machine",
      why: `${share("dd_failed")}% of requests follow a Direct Debit that bounced. A reminder before the collection date gives people time to move money.`,
    },
  ];
}

/** The in-app tips the report recommends, as shown to everyone on that screen. */
export const IN_APP_TIPS = {
  listen: {
    id: "listen-tip",
    text: "Prefer to listen? Tap “Listen” on any card and it's read to you.",
  },
  reminders: {
    id: "reminder-tip",
    text: "Reminders can do the remembering for you. Tick “Remembering dates” in Settings & help.",
  },
} as const;
