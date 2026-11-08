/**
 * The next action — what the agent should do now, in one line.
 *
 * Pure: derived from shared state, the clock and presence, so it updates the
 * moment anything changes in either window. First match wins, in order of
 * what matters most: an open request, then waiting (don't chase), then
 * after-payment follow-ups, then a first calm contact — and "hold" whenever
 * contacting now would break one of the customer's own rules.
 *
 * It recommends; it never acts on its own. Every button dispatches an action
 * that already exists, with the same guards the panels below apply.
 */

import { payByDate, payByIso } from "./compliance";
import { checkContact, ordinal } from "./contact";
import { arrangementEligibility } from "./engines/rescue-sim";
import { GRACE_STREAK, onTimeStreak } from "./engines/grace";
import { daysUntil, isoDaysFromToday, money } from "./format";
import type { Action, AppState } from "./types";

export type NextActionButton =
  | { label: string; kind: "dispatch"; action: Action }
  /** Puts a prepared line in the composer and focuses it. */
  | { label: string; kind: "compose"; line: string };

export interface NextAction {
  title: string;
  why: string;
  /** act: do this now · wait: leave it · hold: a rule says not now · done: nothing to do. */
  tone: "act" | "wait" | "hold" | "done";
  primary?: NextActionButton;
  secondary?: NextActionButton;
}

export interface StatusChip {
  label: string;
  tone: "neutral" | "pos" | "attn" | "calm" | "link";
}

export function nextAction(state: AppState, now: number): NextAction {
  const { credit, customer, flags } = state;
  const n = customer.firstName;
  const hour = new Date(now).getHours();
  const contact = checkContact(state, now, hour);
  const open = [...state.supportCases].reverse().find((c) => c.status !== "resolved");
  const paid = credit.status === "current";

  /* 1 · An open request waiting on us. */
  if (open?.status === "review_needed") {
    const refer: NextActionButton = {
      label: "Refer to specialist",
      kind: "dispatch",
      action: { type: "REFER_SPECIALIST", id: open.id, replyBy: isoDaysFromToday(2) },
    };
    if (open.difficulty === "cant_pay_full") {
      return {
        title: `Refer request #${open.ref} to a specialist`,
        why: `${n} said they can't pay the full amount, so guided payment may not fit. An adviser can look at options under policy.`,
        tone: "act",
        primary: refer,
      };
    }
    return {
      title: `Offer guided payment on request #${open.ref}`,
      why: `${open.summary} Guided payment fits: three small steps, no change to terms.`,
      tone: "act",
      primary: {
        label: "Offer guided payment",
        kind: "dispatch",
        action: { type: "OFFER_GUIDED_PAYMENT", id: open.id },
      },
      secondary: refer,
    };
  }

  /* 2 · With a specialist: approve only if the checks pass. */
  if (open?.status === "specialist_review") {
    const checks = arrangementEligibility(open, state);
    if (checks.every((c) => c.pass) && credit.status === "overdue") {
      return {
        title: `Approve an arrangement on #${open.ref}`,
        why: "All eligibility checks pass. Needs a second approver — this button is that approval (simulated).",
        tone: "act",
        primary: {
          label: "Approve arrangement",
          kind: "dispatch",
          action: {
            type: "APPROVE_ARRANGEMENT",
            id: open.id,
            newDueDate: isoDaysFromToday(14),
            approver: "Sam K. (team lead)",
          },
        },
      };
    }
    const failed = checks.find((c) => !c.pass);
    return {
      title: `Reply to #${open.ref} in writing`,
      why: `No arrangement: ${failed ? failed.label.toLowerCase() : "not eligible on these checks"}. Explain the options plainly instead.`,
      tone: "act",
      primary: {
        label: "Write the reply",
        kind: "compose",
        line: `Thanks for waiting, ${n}. I've looked at your request. Here's what I can do.`,
      },
    };
  }

  /* 3 · Something is already with the customer: don't chase. */
  if (
    open?.status === "guided_offered" ||
    open?.status === "arrangement_offered" ||
    (flags.extensionOffered && !flags.extensionAccepted && credit.status === "overdue")
  ) {
    return {
      title: `Waiting on ${n} — don't chase`,
      why: "The next step is in their app. A second message now reads as pressure.",
      tone: "wait",
    };
  }

  /* 4 · Paid: optional goodwill, once a year, never if grace already waived it. */
  if (paid && !credit.lateFeeRefunded && !credit.lateFeeWaivedByGrace) {
    return {
      title: `Refund the ${money(credit.lateFee)} late fee`,
      why: `${n} has paid. Optional goodwill, once a year — it follows the payment, never the silence.`,
      tone: "act",
      primary: { label: `Refund ${money(credit.lateFee)}`, kind: "dispatch", action: { type: "REFUND_LATE_FEE" } },
    };
  }

  /* 5 · Paid and no Direct Debit: one offer, then stop. */
  if (paid && !flags.autopayEnabled) {
    return holdIfNeeded(contact, n, {
      title: "Offer a Direct Debit, once",
      why: "So next month's date doesn't need remembering. Offer it once, then close the contact.",
      tone: "act",
      primary: {
        label: "Write the offer",
        kind: "compose",
        line: `All done, ${n}. If you'd like, I can set up a Direct Debit so the minimum pays itself each month. Just say.`,
      },
    });
  }

  /* 6 · Past due, nothing open: one calm message — unless a rule says not now. */
  if (credit.status === "overdue") {
    return holdIfNeeded(contact, n, {
      title: "Send one calm message",
      why: `${money(credit.minimumDue)} past its date, nothing arranged. The ${ordinal(contact.nextOrdinal)} message this week, in ${n}'s chosen channel.`,
      tone: "act",
      primary: {
        label: "Write the message",
        kind: "compose",
        line: `Hi ${n} — there's ${money(credit.minimumDue)} on your card that's past its date. Paying it by ${payByDate(credit)} should keep it off your credit file. There's one button in the app for it.`,
      },
    });
  }

  return {
    title: `Nothing to do. Leave ${n} be.`,
    why: "Everything is up to date. Contact now would only add noise.",
    tone: "done",
  };
}

/** A contact rule beats the recommendation: say "hold" and why, with no button. */
function holdIfNeeded(
  contact: ReturnType<typeof checkContact>,
  n: string,
  action: NextAction,
): NextAction {
  if (contact.breaches.length === 0) return action;
  return {
    title: `Hold — not now`,
    why: `${action.title} would break one of ${n}'s rules: ${contact.breaches[0]}`,
    tone: "hold",
  };
}

/** The at-a-glance facts beside the next action. */
export function statusChips(state: AppState, now: number, customerOnline: boolean): StatusChip[] {
  const { credit, customer } = state;
  const hour = new Date(now).getHours();
  const contact = checkContact(state, now, hour);
  const chips: StatusChip[] = [
    {
      label: customerOnline ? "In the app now" : customer.openedAppToday ? "Opened today" : "Offline",
      tone: customerOnline ? "pos" : "neutral",
    },
  ];

  if (credit.status === "overdue") {
    chips.push({ label: `${money(credit.minimumDue)} · ${credit.daysOverdue} days past due`, tone: "attn" });
    const days = daysUntil(payByIso(credit));
    chips.push({
      label: `Credit-file date ${payByDate(credit).replace(/^\w+ /, "")} (${days} day${days === 1 ? "" : "s"})`,
      tone: days <= 7 ? "attn" : "neutral",
    });
  } else if (credit.status === "current") {
    chips.push({ label: "Paid · up to date", tone: "pos" });
  } else {
    chips.push({ label: credit.status === "extended" ? "New date agreed" : "Plan running", tone: "calm" });
  }

  chips.push({
    label: `Messages this week ${contact.sentThisWeek}/${customer.contactPreferences.maxPerWeek}`,
    tone: contact.overLimit ? "attn" : "neutral",
  });
  if (contact.breaches.some((b) => /quiet hours/.test(b))) {
    chips.push({ label: "Quiet hours now", tone: "attn" });
  }
  if (credit.lateFeeWaivedByGrace) {
    chips.push({ label: `Fee waived · ${onTimeStreak(credit)}/${GRACE_STREAK} on time`, tone: "pos" });
  }
  return chips;
}
