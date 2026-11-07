/**
 * Thirty-day policy simulation.
 *
 * Runs the same customer through three outreach policies side by side: the
 * standard collections cadence, Clarity's design on its own, and Clarity's
 * design plus optional concessions. The middle lane is the claim. Banks can
 * already waive fees and move dates; if the outcome only improved because of
 * those, the product would have done nothing. So the design-only lane gives
 * nothing away — the fee stands — and it still resolves.
 *
 * Fully deterministic — no randomness anywhere — so it produces an identical
 * result on every run, including live on stage.
 *
 * The model is one number: `engagement`, the modelled probability the customer
 * acts on the next contact. Pressure multiplies it down. Removing pressure, or
 * removing effort, adds to it. The account resolves the first time engagement
 * crosses the threshold.
 *
 * Every constant below is an assumption, named and surfaced in the UI. They
 * are the claim being made, not a hidden implementation detail.
 */

import { CREDIT_FILE_RETENTION } from "../compliance";
import { FOCUS_LOAD_AFTER, FOCUS_LOAD_BEFORE } from "./cognitive-load";

/** Engagement at day zero: 14 days silent, three unopened emails. */
const STARTING_ENGAGEMENT = 0.3;

/** Engagement at which the customer acts. */
const RESOLVE_THRESHOLD = 0.65;

/** Each pressuring contact multiplies engagement by this. */
const PRESSURE_MULTIPLIER = 0.78;

/** Capital One UK's late payment fee. Charged when the date passed. */
const LATE_FEE = 12;

export type PolicyId = "standard" | "design" | "extras";

export interface SimEvent {
  day: number;
  label: string;
  detail: string;
  kind: "pressure" | "support" | "neutral" | "resolve" | "harm" | "extra";
  engagement: number;
}

export interface SimOutcome {
  policy: PolicyId;
  label: string;
  events: SimEvent[];
  /** Day the account was resolved, or null if it never was. */
  resolvedOn: number | null;
  feesCharged: number;
  reportedToBureau: boolean;
  /** Engagement at the end — willingness to deal with us again. */
  finalEngagement: number;
  /** Concessions given away, in plain words. Empty for a design-only policy. */
  concessions: string[];
}

export interface SimulationResult {
  standard: SimOutcome;
  design: SimOutcome;
  extras: SimOutcome;
}

interface Step {
  day: number;
  label: string;
  detail: string;
  kind: SimEvent["kind"];
  multiply?: number;
  add?: number;
  /** Positive charges a fee; negative refunds one. */
  fee?: number;
  bureau?: boolean;
  /** Fires only once the account has resolved, and does not move engagement. */
  afterResolve?: boolean;
  /** Names a concession, so the UI can say what was given away. */
  concession?: string;
}

/** The cadence an arrears queue runs today: contact, contact, escalate. */
const STANDARD_POLICY: Step[] = [
  { day: 0, label: "Late fee already charged", detail: "£12, added when the date passed.", kind: "harm", fee: LATE_FEE },
  { day: 1, label: "Automated email reminder", detail: "Template 4a. Subject line contains “action required”.", kind: "pressure", multiply: PRESSURE_MULTIPLIER },
  { day: 5, label: "Second email reminder", detail: "Identical template. The first was never opened.", kind: "pressure", multiply: PRESSURE_MULTIPLIER },
  { day: 10, label: "Outbound collections call", detail: "No answer. Logged as an attempt.", kind: "pressure", multiply: PRESSURE_MULTIPLIER },
  { day: 15, label: "Second call, then a text", detail: "Contact volume rising. Nothing new is said.", kind: "pressure", multiply: PRESSURE_MULTIPLIER },
  { day: 21, label: "Final notice issued", detail: "Escalation language. Mentions credit reporting.", kind: "pressure", multiply: PRESSURE_MULTIPLIER },
  { day: 30, label: "Reported to credit reference agencies", detail: `Over 30 days in arrears. The missed payment stays on Alex's credit file for ${CREDIT_FILE_RETENTION}.`, kind: "harm", multiply: PRESSURE_MULTIPLIER, bureau: true },
];

/** Remove the pressure, then remove the effort. Nothing given away. */
const DESIGN_STEPS: Step[] = [
  { day: 0, label: "Late fee already charged", detail: "£12, added when the date passed. This policy leaves it in place.", kind: "neutral", fee: LATE_FEE },
  { day: 0, label: "Three unopened emails flag the file", detail: "Account facts only — routed to one in-app message instead of a fourth email.", kind: "neutral" },
  { day: 1, label: "One in-app message, not a fourth email", detail: "Alex's chosen channel, outside quiet hours. Scored calm on the Pressure Index, with the one real date stated once.", kind: "support", add: 0.1 },
  { day: 3, label: "Welcome-back, then Safe Mode", detail: `What changed in three lines; one tap to strip the app to what matters. Screen load ${FOCUS_LOAD_BEFORE} → ${FOCUS_LOAD_AFTER}.`, kind: "support", add: 0.08 },
  { day: 3, label: "Time Machine: one payment needs you", detail: "The rest pay themselves or can wait. Safe-to-Spend shows the £41 was already set aside.", kind: "support", add: 0.08 },
  { day: 4, label: "Help me resolve this → guided payment", detail: "Alex asks; the bank offers three small steps. No change to terms.", kind: "support", add: 0.1 },
];

const AFTER_RESOLVE_DESIGN: Step[] = [
  { day: 4, label: "Direct Debit for the minimum, offered once", detail: "Stops next month's date being something to remember.", kind: "support", afterResolve: true },
];

/** The design, plus the concessions a bank could already offer. */
const EXTRAS_POLICY: Step[] = [
  { ...DESIGN_STEPS[0], detail: "£12, added when the date passed." },
  ...DESIGN_STEPS.slice(1, 3),
  { day: 2, label: "Optional: arrangement offered", detail: "After an eligibility check and a second approver. No extra fee for the extra time.", kind: "extra", add: 0.1, concession: "Arrangement (approved)" },
  ...DESIGN_STEPS.slice(3),
  ...AFTER_RESOLVE_DESIGN,
  { day: 3, label: "Optional: fee refunded after paying", detail: "Once-a-year goodwill. Follows the payment, never the silence.", kind: "extra", afterResolve: true, fee: -LATE_FEE, concession: "£12 fee refunded after payment" },
];

function run(policy: Step[], label: string, id: PolicyId): SimOutcome {
  let engagement = STARTING_ENGAGEMENT;
  let fees = 0;
  let bureau = false;
  let resolvedOn: number | null = null;
  const events: SimEvent[] = [];
  const concessions: string[] = [];

  for (const step of policy) {
    if (step.afterResolve) {
      // Follow-ups only make sense once the account is resolved.
      if (resolvedOn === null) continue;
    } else if (resolvedOn !== null) {
      // Once resolved, the remaining outreach steps never fire.
      continue;
    }

    if (!step.afterResolve) {
      if (step.multiply !== undefined) engagement *= step.multiply;
      if (step.add !== undefined) engagement += step.add;
      engagement = Math.max(0.02, Math.min(1, engagement));
    }

    if (step.fee) fees += step.fee;
    if (step.bureau) bureau = true;
    if (step.concession) concessions.push(step.concession);

    events.push({
      day: step.afterResolve && resolvedOn !== null ? resolvedOn : step.day,
      label: step.label,
      detail: step.detail,
      kind: step.kind,
      engagement: round2(engagement),
    });

    if (!step.afterResolve && resolvedOn === null && engagement >= RESOLVE_THRESHOLD) {
      resolvedOn = step.day;
      events.push({
        day: step.day,
        label: "Account resolved",
        detail: "Customer pays. Well inside 30 days, so nothing is reported.",
        kind: "resolve",
        engagement: round2(engagement),
      });
    }
  }

  return {
    policy: id,
    label,
    events,
    resolvedOn,
    feesCharged: Math.max(0, fees),
    reportedToBureau: bureau,
    finalEngagement: round2(engagement),
    concessions,
  };
}

export function runSimulation(): SimulationResult {
  return {
    standard: run(STANDARD_POLICY, "Standard collections cadence", "standard"),
    design: run([...DESIGN_STEPS, ...AFTER_RESOLVE_DESIGN], "Adaptive Support, design only", "design"),
    extras: run(EXTRAS_POLICY, "Adaptive Support + optional extras", "extras"),
  };
}

/** The assumptions, surfaced in the UI so the model can be argued with. */
export const SIMULATION_ASSUMPTIONS = [
  `Engagement starts at ${STARTING_ENGAGEMENT.toFixed(2)} — 14 days silent, three unopened emails.`,
  `The customer acts when engagement reaches ${RESOLVE_THRESHOLD.toFixed(2)}.`,
  `Each pressuring contact multiplies engagement by ${PRESSURE_MULTIPLIER.toFixed(2)}.`,
  "Supportive actions add a fixed amount, shown on each step.",
  "Concessions are optional extras. The design-only lane resolves without any: the £12 fee stands and the date does not move.",
  "Illustrative assumptions, not measured outcomes. Shown so they can be argued with.",
];

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
