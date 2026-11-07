/**
 * The Silence Model.
 *
 * Treats not-opening-the-app as information rather than as an absence of it.
 * A conventional arrears queue records what the customer did; the thing that
 * actually predicts the next 30 days on this file is what they didn't do.
 *
 * This is an illustrative model with hand-tuned weights. It is not trained on
 * anything, and the UI says so in those words. That is deliberate: a console
 * that shows its six features, their weights and their individual
 * contributions is more useful to an agent — and more honest to a reviewer —
 * than a black box with a better-sounding provenance.
 */

import type { AppState } from "../types";

export interface RiskFeature {
  id: string;
  label: string;
  /** Raw value, in its own units, for display. */
  raw: string;
  /** 0–1 after normalisation. */
  normalised: number;
  /** Maximum points this feature can contribute. */
  weight: number;
  /** normalised × weight. */
  contribution: number;
  why: string;
}

export type RiskBand = "low" | "elevated" | "high" | "severe";

export interface SilenceReading {
  score: number;
  band: RiskBand;
  features: RiskFeature[];
  channels: ChannelPrediction[];
  /** The single intervention the model recommends next. */
  recommendation: string;
}

export interface ChannelPrediction {
  id: string;
  label: string;
  /** 0–1 modelled probability this channel produces a response. */
  probability: number;
  /** The named adjustments that produced it, for inspection. */
  factors: { label: string; delta: number }[];
}

export function bandForRisk(score: number): RiskBand {
  if (score < 25) return "low";
  if (score < 50) return "elevated";
  if (score < 75) return "high";
  return "severe";
}

export const RISK_BAND_COPY: Record<
  RiskBand,
  { label: string; tone: "pos" | "attn" | "red" }
> = {
  low: { label: "Low", tone: "pos" },
  elevated: { label: "Elevated", tone: "attn" },
  high: { label: "High", tone: "red" },
  severe: { label: "Severe", tone: "red" },
};

/** Normalise to 0–1 with a ceiling, so one extreme feature cannot dominate. */
function cap(value: number, ceiling: number): number {
  return Math.max(0, Math.min(1, value / ceiling));
}

export function runSilenceModel(state: AppState): SilenceReading {
  const { customer, credit, flags } = state;

  // Silence resets the moment the customer is back in the app.
  const daysSilent = customer.openedAppToday ? 0 : customer.daysSinceLastOpen;
  const unopened = state.timeline.filter((e) =>
    /reminder emails sent/i.test(e.title),
  ).length
    ? 3
    : 0;
  const priorEpisodes = 2; // From the (fictional) 24-month history.
  const timingVariance = 0.62; // Std dev of days-from-due over 12 payments.

  const features: RiskFeature[] = [
    {
      id: "silence",
      label: "Days without opening the app",
      raw: `${daysSilent} days`,
      normalised: cap(daysSilent, 21),
      weight: 30,
      contribution: 0,
      why: "The strongest single predictor on this file. Engagement decays before payment does.",
    },
    {
      id: "unopened",
      label: "Unopened outreach",
      raw: `${unopened} of 3 emails`,
      normalised: cap(unopened, 5),
      weight: 15,
      contribution: 0,
      why: "Evidence the channel failed, not the customer. Sending a fourth is not an intervention.",
    },
    {
      id: "pastdue",
      label: "Days past due",
      raw: `${credit.daysOverdue} days`,
      normalised: cap(credit.daysOverdue, 30),
      weight: 20,
      contribution: 0,
      why: "Matters, but less than silence — a customer who is engaged usually resolves.",
    },
    {
      id: "episodes",
      label: "Prior avoidance episodes",
      raw: `${priorEpisodes} in 24 months`,
      normalised: cap(priorEpisodes, 4),
      weight: 15,
      contribution: 0,
      why: "A repeating pattern, not a one-off. Treat as a standing accommodation need.",
    },
    {
      id: "variance",
      label: "Payment timing variance",
      raw: timingVariance.toFixed(2),
      normalised: timingVariance,
      weight: 10,
      contribution: 0,
      why: "Irregular timing with reliable eventual payment suggests executive function, not capacity.",
    },
    {
      id: "declared",
      label: "Self-declared avoidance",
      raw: customer.cognitiveProfile.some((p) => /avoidance/i.test(p)) ? "Yes" : "No",
      normalised: customer.cognitiveProfile.some((p) => /avoidance/i.test(p)) ? 1 : 0,
      weight: 10,
      contribution: 0,
      why: "Alex told us this directly. The model is required to listen to it.",
    },
  ].map((f) => ({ ...f, contribution: Math.round(f.normalised * f.weight * 10) / 10 }));

  const score = Math.round(features.reduce((sum, f) => sum + f.contribution, 0));
  const band = bandForRisk(score);

  const channels = predictChannels({
    score,
    unopened,
    declaredAvoidance: features[5].normalised === 1,
    inApp: customer.openedAppToday,
  });

  const recommendation = recommend(state, band, flags);

  return { score, band, features, channels, recommendation };
}

/**
 * Modelled response rate per channel. Base rates are illustrative; the
 * adjustments are the interesting part and each is named so an agent can
 * disagree with a specific one.
 */
function predictChannels(input: {
  score: number;
  unopened: number;
  declaredAvoidance: boolean;
  inApp: boolean;
}): ChannelPrediction[] {
  const build = (
    id: string,
    label: string,
    base: number,
    factors: { label: string; delta: number }[],
  ): ChannelPrediction => {
    const probability = Math.max(
      0.01,
      Math.min(0.99, factors.reduce((p, f) => p + f.delta, base)),
    );
    return { id, label, probability, factors };
  };

  return [
    build("inapp", "Gentle in-app nudge", 0.52, [
      ...(input.inApp ? [{ label: "Customer is in the app now", delta: 0.3 }] : []),
      { label: "No pressure language", delta: 0.08 },
      ...(input.declaredAvoidance ? [{ label: "Matches declared preference", delta: 0.06 }] : []),
    ]),
    build("email", "Another email reminder", 0.35, [
      { label: `${input.unopened} previous emails unopened`, delta: -0.22 },
      { label: "Channel already shown to fail here", delta: -0.08 },
    ]),
    build("call", "Outbound phone call", 0.3, [
      ...(input.declaredAvoidance
        ? [{ label: "Declared avoidance — calls raise the cost of engaging", delta: -0.17 }]
        : []),
      { label: "No appointment agreed", delta: -0.06 },
    ]),
    build("letter", "Posted letter", 0.14, [
      { label: "Slow, and arrives without context", delta: -0.04 },
    ]),
  ].sort((a, b) => b.probability - a.probability);
}

function recommend(
  state: AppState,
  band: RiskBand,
  flags: AppState["flags"],
): string {
  if (state.credit.status === "current") {
    return "Nothing outstanding. Offer automatic minimum payments once, then close the contact.";
  }
  if (state.credit.status === "extended" || state.credit.status === "split_plan") {
    return "An arrangement is in place. Take no further action — a check-in now reads as chasing.";
  }
  if (!state.credit.lateFeeWaived) {
    return "Waive the late fee first, unprompted. It is the cheapest trust you will ever buy on this file.";
  }
  if (flags.extensionOffered && !flags.extensionAccepted) {
    return "An offer is already open. Do not send a second message today — wait.";
  }
  if (band === "severe" || band === "high") {
    return "One gentle in-app nudge. It is the only channel the model gives better-than-even odds.";
  }
  return "Low pressure, single action, then stop.";
}
