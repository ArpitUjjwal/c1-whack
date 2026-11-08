import { z } from "zod";
import { longDate, money } from "./format";
import type { ExplainDraft } from "./ai/provider";

/**
 * "What does this mean?" — the subjects, the facts, and the answer we can
 * always give.
 *
 * Two decisions shape this file.
 *
 * **The client sends numbers, not sentences.** A request names one of a fixed
 * set of subjects and carries the raw figures behind it; every label, every
 * formatted amount and every date string is built here, on the server. So the
 * model can only ever be handed facts this app composed, and a caller cannot
 * put words in its mouth by relabelling a field.
 *
 * **There is always a local answer.** `explainLocally` covers every subject
 * from the same facts. It is plainer than a written one and it never fails,
 * which is what lets the explainer ship a deterministic fallback rather than
 * an error state — and what the readability gate falls back *to* when a
 * written answer comes out too dense.
 */

export const ExplainRequest = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("safe-to-spend"),
    available: z.number().finite(),
    committed: z.number().finite(),
    horizonDays: z.number().int().min(1).max(60),
  }),
  z.object({
    kind: z.literal("credit-balance"),
    balance: z.number().finite(),
    minimumDue: z.number().finite(),
    dueDate: z.string().max(10),
    daysOverdue: z.number().int().min(0).max(999),
  }),
  z.object({
    kind: z.literal("late-fee"),
    lateFee: z.number().finite(),
    refunded: z.boolean(),
  }),
  z.object({
    kind: z.literal("bill"),
    name: z.string().max(60),
    amount: z.number().finite(),
    dueDate: z.string().max(10),
    autopay: z.boolean(),
  }),
]);

export type ExplainSubject = z.infer<typeof ExplainRequest>;

/** What the customer tapped, named the way they would name it. */
export function subjectLabel(s: ExplainSubject): string {
  switch (s.kind) {
    case "safe-to-spend":
      return "their Safe to spend figure";
    case "credit-balance":
      return "the balance on their Capital One credit card";
    case "late-fee":
      return "a late fee on their credit card";
    case "bill":
      return `a bill called "${s.name}"`;
  }
}

/** The facts, formatted here so the model never formats a number itself. */
export function factsFor(s: ExplainSubject): { label: string; value: string }[] {
  switch (s.kind) {
    case "safe-to-spend":
      return [
        { label: "Safe to spend", value: money(s.available) },
        { label: "Already set aside for bills", value: money(s.committed) },
        { label: "Period those bills cover", value: `the next ${s.horizonDays} days` },
      ];
    case "credit-balance":
      return [
        { label: "Balance on the card", value: money(s.balance) },
        { label: "Minimum payment", value: money(s.minimumDue) },
        { label: "It was due", value: longDate(s.dueDate) },
        {
          label: "Days past due",
          value: s.daysOverdue > 0 ? `${s.daysOverdue}` : "none — it is not late",
        },
      ];
    case "late-fee":
      return [
        { label: "Fee charged", value: money(s.lateFee) },
        {
          label: "Status",
          value: s.refunded ? "already refunded to the account" : "on the account",
        },
      ];
    case "bill":
      return [
        { label: "Bill", value: s.name },
        { label: "Amount", value: money(s.amount) },
        { label: "Due", value: longDate(s.dueDate) },
        {
          label: "How it is paid",
          value: s.autopay ? "automatically, by Direct Debit" : "you pay this one yourself",
        },
      ];
  }
}

/**
 * The answer with no model involved.
 *
 * Written from the same facts, in the same shape, so the UI cannot tell the
 * difference structurally — only the provenance label says which produced it.
 */
export function explainLocally(s: ExplainSubject): ExplainDraft {
  switch (s.kind) {
    case "safe-to-spend":
      return {
        headline: "Money you can spend without missing a bill.",
        plainWords: [
          `You have ${money(s.available)} to use.`,
          `${money(s.committed)} is already set aside for bills due in the next ${s.horizonDays} days, so it is not counted here.`,
          "The figure only moves when a bill or a payment changes it.",
        ],
        whatYouCouldDo: [],
      };

    case "credit-balance":
      return {
        headline: "What is on the card, and the part due now.",
        plainWords: [
          `The full balance is ${money(s.balance)}.`,
          `The minimum payment is ${money(s.minimumDue)}. It was due on ${longDate(s.dueDate)}.`,
          s.daysOverdue > 0
            ? `It is ${s.daysOverdue} days past that date.`
            : "It is not late.",
        ],
        whatYouCouldDo: [
          `Pay the minimum of ${money(s.minimumDue)}.`,
          "Pay a smaller amount towards it.",
          "Ask the support team for more time.",
        ],
      };

    case "late-fee":
      return {
        headline: "A fee added when a payment arrives late.",
        plainWords: [
          `The fee is ${money(s.lateFee)}.`,
          s.refunded
            ? "It has already been refunded to your account."
            : "It is on the account now.",
        ],
        whatYouCouldDo: s.refunded ? [] : ["Ask the support team about the fee."],
      };

    case "bill":
      return {
        headline: s.autopay ? "A bill that pays itself." : "A bill you pay yourself.",
        plainWords: [
          `${s.name} is ${money(s.amount)}.`,
          `It is due on ${longDate(s.dueDate)}.`,
          s.autopay
            ? "It goes out by Direct Debit, so you do not need to do anything."
            : "Nothing is set up to pay it automatically.",
        ],
        whatYouCouldDo: [],
      };
  }
}
