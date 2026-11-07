/**
 * Thirty-day policy simulation.
 *
 * Runs the same customer through two outreach policies side by side: the
 * standard collections cadence, and Clarity's. It exists because the argument
 * for this product is an outcome argument, and an outcome argument that is
 * only asserted is worth very little.
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

/** Engagement at day zero: 14 days silent, three unopened emails. */
const STARTING_ENGAGEMENT = 0.3;

/** Engagement at which the customer acts. */
const RESOLVE_THRESHOLD = 0.65;

/** Each pressuring contact multiplies engagement by this. */
const PRESSURE_MULTIPLIER = 0.78;

const LATE_FEE = 29;

export interface SimEvent {
  day: number;
  label: string;
  detail: string;
  kind: "pressure" | "support" | "neutral" | "resolve" | "harm";
  engagement: number;
}

export interface SimOutcome {
  policy: "standard" | "clarity";
  label: string;
  events: SimEvent[];
  /** Day the account was resolved, or null if it never was. */
  resolvedOn: number | null;
  feesCharged: number;
  reportedToBureau: boolean;
  /** Engagement at the end — willingness to deal with us again. */
  finalEngagement: number;
}

export interface SimulationResult {
  standard: SimOutcome;
  clarity: SimOutcome;
}

interface Step {
  day: number;
  label: string;
  detail: string;
  kind: SimEvent["kind"];
  multiply?: number;
  add?: number;
  fee?: number;
  bureau?: boolean;
}

/** The cadence an arrears queue runs today: contact, contact, escalate. */
const STANDARD_POLICY: Step[] = [
  { day: 1, label: "Automated email reminder", detail: "Template 4a. Subject line contains “action required”.", kind: "pressure", multiply: PRESSURE_MULTIPLIER },
  { day: 5, label: "Second email reminder", detail: "Identical template. The first was never opened.", kind: "pressure", multiply: PRESSURE_MULTIPLIER },
  { day: 10, label: "Outbound collections call", detail: "No answer. Logged as an attempt.", kind: "pressure", multiply: PRESSURE_MULTIPLIER },
  { day: 15, label: "Late fee applied", detail: "$29 added automatically. No human reviewed the file.", kind: "harm", multiply: PRESSURE_MULTIPLIER, fee: LATE_FEE },
  { day: 21, label: "Final notice issued", detail: "Escalation language. Mentions credit reporting.", kind: "pressure", multiply: PRESSURE_MULTIPLIER },
  { day: 30, label: "Reported to credit bureaus", detail: "30 days past due. Stays on Alex's file for six years.", kind: "harm", multiply: PRESSURE_MULTIPLIER, bureau: true },
];

/** Remove the fee, remove the pressure, remove the effort — in that order. */
const CLARITY_POLICY: Step[] = [
  { day: 0, label: "Silence Model flags the file", detail: "14 days quiet plus three unopened emails. Routed to proactive support, not the arrears queue.", kind: "neutral" },
  { day: 0, label: "Late fee waived, unprompted", detail: "Before any ask. Costs $29 and removes the reason to avoid looking.", kind: "support", add: 0.12 },
  { day: 1, label: "One gentle in-app nudge", detail: "Scored 0 on the Pressure Index before sending. No deadline, one action.", kind: "support", add: 0.1 },
  { day: 3, label: "Customer opens the app", detail: "Cognitive load measured at 38. Focus Mode offered and accepted — load drops to 11.", kind: "support", add: 0.08 },
  { day: 4, label: "Payment extension offered", detail: "Moves the date rather than asking for money that isn't there.", kind: "support", add: 0.09 },
];

function run(policy: Step[], label: string, id: SimOutcome["policy"]): SimOutcome {
  let engagement = STARTING_ENGAGEMENT;
  let fees = 0;
  let bureau = false;
  let resolvedOn: number | null = null;
  const events: SimEvent[] = [];

  for (const step of policy) {
    // Once resolved, the remaining escalation steps never fire.
    if (resolvedOn !== null) break;

    if (step.multiply !== undefined) engagement *= step.multiply;
    if (step.add !== undefined) engagement += step.add;
    engagement = Math.max(0.02, Math.min(1, engagement));

    if (step.fee) fees += step.fee;
    if (step.bureau) bureau = true;

    events.push({
      day: step.day,
      label: step.label,
      detail: step.detail,
      kind: step.kind,
      engagement: round2(engagement),
    });

    if (engagement >= RESOLVE_THRESHOLD) {
      resolvedOn = step.day;
      events.push({
        day: step.day,
        label: "Account resolved",
        detail: "Customer acts. Nothing past due, no fee, nothing reported.",
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
    feesCharged: fees,
    reportedToBureau: bureau,
    finalEngagement: round2(engagement),
  };
}

export function runSimulation(): SimulationResult {
  return {
    standard: run(STANDARD_POLICY, "Standard collections cadence", "standard"),
    clarity: run(CLARITY_POLICY, "Clarity", "clarity"),
  };
}

/** The assumptions, surfaced in the UI so the model can be argued with. */
export const SIMULATION_ASSUMPTIONS = [
  `Engagement starts at ${STARTING_ENGAGEMENT.toFixed(2)} — 14 days silent, three unopened emails.`,
  `The customer acts when engagement reaches ${RESOLVE_THRESHOLD.toFixed(2)}.`,
  `Each pressuring contact multiplies engagement by ${PRESSURE_MULTIPLIER.toFixed(2)}.`,
  "Supportive actions add a fixed amount, shown on each step.",
  "Illustrative assumptions, not measured outcomes. Shown so they can be argued with.",
];

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
