/**
 * The Financial Rescue Simulator.
 *
 * For one support request, lays out what each response pathway would look
 * like from the customer's side — touchpoints, effort, what is assumed — so
 * the team can choose the next interaction *before* offering anything.
 *
 * It is an illustrative operational simulation, not a policy engine and not
 * a prediction of customer outcomes. In particular, no pathway assumes an
 * extension or a fee waiver: those are decided by an adviser, under real
 * policy, after an eligibility check and a second approval.
 */

import { CHANNEL_LABEL } from "../contact";
import { money } from "../format";
import type { AppState, PathwayId, SupportCase } from "../types";

export interface PathwayStep {
  who: "bank" | "customer";
  text: string;
}

export interface Pathway {
  id: PathwayId;
  label: string;
  summary: string;
  steps: PathwayStep[];
  /** Separate contacts the customer receives. */
  touchpoints: number;
  customerEffort: "High" | "Medium" | "Low";
  assumes: string;
  outcome: string;
  outcomeTone: "red" | "attn" | "pos" | "calm";
  /** What pressing this pathway's button does. */
  action: "none" | "guided" | "specialist";
  actionLabel: string;
}

export function simulatePathways(c: SupportCase, state: AppState): Pathway[] {
  const prefers = CHANNEL_LABEL[state.customer.contactPreferences.channel].toLowerCase();
  const emailsUnopened = state.contactLog.filter((x) => x.channel === "email").length;
  const cantPayFull = c.difficulty === "cant_pay_full";

  return [
    {
      id: "standard",
      label: "Standard process",
      summary: "The request joins the arrears queue and the usual cadence runs.",
      steps: [
        { who: "bank", text: `Automated email reminder — ${emailsUnopened} already sent, none opened` },
        { who: "bank", text: `Outbound call — customer asked for ${prefers}s` },
        { who: "bank", text: "Final notice, mentioning credit reporting" },
        { who: "customer", text: "Explains the situation again, to someone new" },
      ],
      touchpoints: 4,
      customerEffort: "High",
      assumes: "Nobody reads the request; the queue treats it like any other arrears case.",
      outcome: "Likely still unresolved at 30 days, and reported to the credit reference agencies.",
      outcomeTone: "red",
      action: "none",
      actionLabel: "This is what happens if no one picks it up",
    },
    {
      id: "guided",
      label: "Accessible guided payment",
      summary: "One message in the customer's chosen format, with a step-by-step way to pay.",
      steps: [
        { who: "bank", text: `One ${prefers}${c.keepRepliesShort ? ", kept short" : ""}` },
        { who: "customer", text: `Three small steps: the amount (${money(c.amount)}), where it comes from, one button` },
        { who: "customer", text: "Can stop at any step; nothing to read or work out" },
      ],
      touchpoints: 1,
      customerEffort: "Low",
      assumes: "No change to terms. The customer can pay the amount — it is the task that's hard.",
      outcome: cantPayFull
        ? "The customer said they can't pay the full amount, so this may not fit. Consider specialist review."
        : "Fits the request: the customer asked for a simpler way, not different terms.",
      outcomeTone: cantPayFull ? "attn" : "pos",
      action: "guided",
      actionLabel: "Offer guided payment support",
    },
    {
      id: "specialist",
      label: "Specialist support review",
      summary: "An adviser assesses the request under Capital One's actual policies.",
      steps: [
        { who: "bank", text: "Adviser reads the request — the customer doesn't explain again" },
        { who: "bank", text: `Replies by ${prefers} within two working days` },
        { who: "bank", text: "Any arrangement needs an eligibility check and a second approval" },
      ],
      touchpoints: 2,
      customerEffort: "Medium",
      assumes: "No extension or fee waiver is assumed.",
      outcome: "Refer for human review. Whatever is offered follows normal policy.",
      outcomeTone: "calm",
      action: "specialist",
      actionLabel: "Refer for human review",
    },
  ];
}

/** Illustrative eligibility rules for an arrangement. Not Capital One policy. */
export interface EligibilityCheck {
  label: string;
  pass: boolean;
  detail: string;
}

/** Most an adviser can arrange without escalating further. Illustrative. */
const ADVISER_LIMIT = 250;

export function arrangementEligibility(c: SupportCase, state: AppState): EligibilityCheck[] {
  return [
    {
      label: "The customer asked for an arrangement",
      pass: c.helpWanted === "arrangement" || c.difficulty === "cant_pay_full",
      detail:
        c.helpWanted === "arrangement" || c.difficulty === "cant_pay_full"
          ? "In the request, in their words."
          : "Not requested. Offer only if they ask — don't upsell a concession.",
    },
    {
      label: "No arrangement in the last 12 months",
      pass: !state.flags.extensionAccepted,
      detail: state.flags.extensionAccepted ? "One is already in place." : "None on file.",
    },
    {
      label: "Within adviser authority",
      pass: c.amount <= ADVISER_LIMIT,
      detail: `${money(c.amount)} against an illustrative ${money(ADVISER_LIMIT)} limit.`,
    },
  ];
}
