/**
 * The Financial Advocate — the paperwork half.
 *
 * When a payment is going to be hard, the Advocate prepares a support request
 * from validated facts and the customer's own choices. It never sends
 * anything, moves money, or asks for a concession on the customer's behalf:
 * the customer reviews exactly what will be shared, edits it if they like,
 * and sends it themselves.
 *
 * What it will not put in a request is as important as what it will. There
 * is no field for how anyone is feeling, and the "not shared" list is shown
 * to the customer and to the bank side by side.
 */

import { CHANNEL_LABEL } from "./contact";
import { longDate, money } from "./format";
import type {
  AppState,
  ContactChannel,
  Difficulty,
  HelpWanted,
  SupportRequest,
} from "./types";

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  cant_face_it: "I can't face sorting it out right now",
  cant_pay_full: "I can't pay the full amount right now",
  dont_understand: "I don't understand what I owe",
  cant_find_how: "I can't work out how to pay",
  something_else: "Something else",
};

/** The support team's view of the same choice: neutral, third person. */
const DIFFICULTY_SUMMARY: Record<Difficulty, string> = {
  cant_face_it: "Needs a simpler way to deal with it",
  cant_pay_full: "Can't pay the full amount right now",
  dont_understand: "Unsure what is owed",
  cant_find_how: "Can't find how to pay",
  something_else: "Asked for help",
};

export const HELP_LABEL: Record<HelpWanted, string> = {
  simpler: "Make it simpler to sort out",
  explain: "Explain it to me in writing",
  arrangement: "Talk about a payment arrangement",
  call_back: "Call me back at a time I choose",
};

/**
 * Shown on both screens. Everything here exists somewhere in the app or the
 * customer's head; none of it is in the request.
 */
export const NOT_SHARED: string[] = [
  "How you're feeling, or why",
  "Any diagnosis or health information",
  "How you've been using the app (strain, screen measurements)",
  "Whether Safe Mode is on",
  "What you explored in the Time Machine",
  "Private notes or conversations",
];

export interface AdvocateInputs {
  item: { label: string; amount: number; dueDate: string };
  difficulty: Difficulty;
  helpWanted: HelpWanted;
  canPay: { amount: number; date: string } | null;
  contact: ContactChannel;
  keepRepliesShort: boolean;
}

/** Validated facts, the only thing an AI drafter is given. */
export interface AdvocateFacts {
  /** For the summary line; the drafter never sees anything but these fields. */
  difficultySummary: string;
  firstName: string;
  task: string;
  amount: string;
  dueDate: string;
  difficulty: string;
  helpWanted: string;
  canPay: string | null;
  contact: string;
  keepRepliesShort: boolean;
}

export function factsFor(state: AppState, inputs: AdvocateInputs): AdvocateFacts {
  return {
    difficultySummary: DIFFICULTY_SUMMARY[inputs.difficulty],
    firstName: state.customer.firstName,
    task: `${inputs.item.label} on the ${state.credit.nickname}`,
    amount: money(inputs.item.amount),
    dueDate: longDate(inputs.item.dueDate),
    difficulty: DIFFICULTY_LABEL[inputs.difficulty],
    helpWanted: HELP_LABEL[inputs.helpWanted],
    canPay: inputs.canPay
      ? `${money(inputs.canPay.amount)} on ${longDate(inputs.canPay.date)}`
      : null,
    contact: CHANNEL_LABEL[inputs.contact],
    keepRepliesShort: inputs.keepRepliesShort,
  };
}

/**
 * The deterministic draft. Always available; the Claude path replaces it only
 * when a key is configured and the call succeeds.
 */
export function draftLocally(facts: AdvocateFacts): { message: string; summary: string } {
  const lines = [
    `Hi, I need some help with my ${lowerFirst(facts.task)} (${facts.amount}, due ${facts.dueDate}).`,
    `${facts.difficulty}.`,
    facts.canPay ? `I could manage ${facts.canPay}.` : "",
    `What I'd like: ${facts.helpWanted.charAt(0).toLowerCase()}${facts.helpWanted.slice(1)}.`,
    `Please reply by ${facts.contact.toLowerCase()}${facts.keepRepliesShort ? ", and keep it short" : ""}.`,
  ].filter(Boolean);

  const summary = `${facts.difficultySummary}: ${facts.amount}, ${lowerFirst(facts.task)}. Wants: ${facts.helpWanted.toLowerCase()}.${
    facts.canPay ? ` Could manage ${facts.canPay}.` : ""
  }`;

  return { message: lines.join(" "), summary };
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

export function toRequest(
  inputs: AdvocateInputs,
  draft: { message: string; summary: string },
  draftedBy: "local" | "claude",
  cardNickname: string,
): SupportRequest {
  return {
    task: `${inputs.item.label} — ${cardNickname}`,
    amount: inputs.item.amount,
    dueDate: inputs.item.dueDate,
    difficulty: inputs.difficulty,
    helpWanted: inputs.helpWanted,
    canPay: inputs.canPay,
    contact: inputs.contact,
    keepRepliesShort: inputs.keepRepliesShort,
    message: draft.message.trim(),
    summary: draft.summary,
    draftedBy,
  };
}
