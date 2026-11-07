/**
 * The Silence Model.
 *
 * Treats not-opening-the-app as information rather than as an absence of it.
 * A conventional arrears queue records what the customer did; the thing that
 * actually predicts the next 30 days on this file is what they didn't do.
 *
 * What it decides, and what it is never allowed to decide: the output is a
 * reach-out *priority* — who to contact first, on which channel, in what tone
 * and at what time. It never decides what to give away (fees, extensions),
 * and it never feeds credit decisions, limits or collections escalation.
 * Rewarding silence with a concession would teach the wrong lesson; the
 * model's job is to make the next contact land, not to buy it.
 *
 * This is an illustrative model with hand-tuned weights. It is not trained on
 * anything, and the UI says so in those words. That is deliberate: a console
 * that shows its six features, their weights and their individual
 * contributions is more useful to an agent — and more honest to a reviewer —
 * than a black box with a better-sounding provenance.
 */

import { CHANNEL_LABEL, hourLabel } from "../contact";
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

export type PriorityBand = "routine" | "soon" | "today" | "first";

export interface SilenceReading {
  /** Reach-out priority, 0–100. Higher means "contact sooner, more gently". */
  score: number;
  band: PriorityBand;
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

export function bandForPriority(score: number): PriorityBand {
  if (score < 25) return "routine";
  if (score < 50) return "soon";
  if (score < 75) return "today";
  return "first";
}

/**
 * Calm colours only. This is a support queue, not a risk flag, and a
 * customer's own disclosure must never turn anything on this screen red.
 */
export const PRIORITY_COPY: Record<PriorityBand, { label: string; tone: "calm" | "link" }> = {
  routine: { label: "Routine", tone: "link" },
  soon: { label: "Reach out soon", tone: "link" },
  today: { label: "Reach out today", tone: "calm" },
  first: { label: "Reach out first", tone: "calm" },
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
  const declaredHardToStart = customer.cognitiveProfile.some((p) =>
    /hard to start/i.test(p),
  );
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
      label: "Earlier long quiet spells",
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
      label: "Told us money tasks are hard to start",
      raw: declaredHardToStart ? "Yes" : "No",
      normalised: declaredHardToStart ? 1 : 0,
      weight: 10,
      contribution: 0,
      why: "Alex told us directly. It moves Alex up the support list. Nothing else.",
    },
  ].map((f) => ({ ...f, contribution: Math.round(f.normalised * f.weight * 10) / 10 }));

  const score = Math.round(features.reduce((sum, f) => sum + f.contribution, 0));
  const band = bandForPriority(score);

  const channels = predictChannels({
    unopened,
    declaredHardToStart,
    preferred: customer.contactPreferences.channel,
    inApp: customer.openedAppToday,
  });

  const recommendation = recommend(state, channels, flags);

  return { score, band, features, channels, recommendation };
}

/**
 * Modelled response rate per channel. Base rates are illustrative; the
 * adjustments are the interesting part and each is named so an agent can
 * disagree with a specific one.
 */
function predictChannels(input: {
  unopened: number;
  declaredHardToStart: boolean;
  preferred: AppState["customer"]["contactPreferences"]["channel"];
  inApp: boolean;
}): ChannelPrediction[] {
  const chosen = (id: string) =>
    id === input.preferred ? [{ label: "The channel Alex chose", delta: 0.06 }] : [];

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
    build("in_app", "Gentle in-app nudge", 0.52, [
      ...(input.inApp ? [{ label: "Customer is in the app now", delta: 0.3 }] : []),
      { label: "No pressure language", delta: 0.08 },
      ...chosen("in_app"),
    ]),
    build("email", "Another email reminder", 0.35, [
      { label: `${input.unopened} previous emails unopened`, delta: -0.22 },
      { label: "Channel already shown to fail here", delta: -0.08 },
      ...chosen("email"),
    ]),
    build("phone", "Outbound phone call", 0.3, [
      ...(input.declaredHardToStart
        ? [{ label: "A call raises the cost of starting", delta: -0.17 }]
        : []),
      { label: "No appointment agreed", delta: -0.06 },
      ...chosen("phone"),
    ]),
    build("letter", "Posted letter", 0.14, [
      { label: "Slow, and arrives without context", delta: -0.04 },
      ...chosen("letter"),
    ]),
  ].sort((a, b) => b.probability - a.probability);
}

/**
 * How to reach out — channel, tone, timing. Never what to give away: there is
 * deliberately no branch here that recommends a fee refund or an extension.
 */
function recommend(
  state: AppState,
  channels: ChannelPrediction[],
  flags: AppState["flags"],
): string {
  const prefs = state.customer.contactPreferences;
  if (state.credit.status === "current") {
    return "Nothing outstanding. Offer a Direct Debit for the minimum once, then close the contact.";
  }
  if (state.credit.status === "extended" || state.credit.status === "split_plan") {
    return "An arrangement is in place. Take no further action — a check-in now reads as chasing.";
  }
  if (flags.extensionOffered && !flags.extensionAccepted) {
    return "An offer is already open. Do not send a second message today — wait.";
  }

  // Alex's own choice outranks the model's odds.
  const best =
    channels.find((c) => c.id === prefs.channel) ?? channels[0];
  const odds = Math.round(best.probability * 100);
  const email = channels.find((c) => c.id === "email");
  const notEmail =
    best.id !== "email" && email
      ? ` Not a fourth email (${Math.round(email.probability * 100)}%).`
      : "";

  return `${CHANNEL_LABEL[best.id as keyof typeof CHANNEL_LABEL] ?? best.label}, once (${odds}% modelled).${notEmail} Calm, one action, no deadline. Not between ${hourLabel(prefs.quietHours.start)} and ${hourLabel(prefs.quietHours.end)}. Then wait 48 hours.`;
}
