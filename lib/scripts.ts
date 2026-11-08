import type { AppState } from "./types";
import { creditFileLine, payByDate } from "./compliance";
import { CHANNEL_LABEL, hourLabel } from "./contact";
import { longDate, money } from "./format";

export interface AgentScript {
  /** One line naming the situation the agent is actually in. */
  situation: string;
  /** Word-for-word opener, written to Alex's declared preferences. */
  opener: string;
  /** Supporting lines, in the order they should be said. */
  lines: string[];
  /** The single next action the agent should take. */
  nextStep: string;
}

/**
 * Neuro-inclusive scripting.
 *
 * The script is derived from live state rather than picked from a static
 * library, so it changes the moment Alex does something in the app — pay the
 * bill mid-call and the agent's words update before they finish the sentence.
 *
 * Every variant follows the same rules, taken from Alex's stated preferences:
 * short sentences, one instruction at a time, no urgency language, no
 * collections vocabulary, and the consequence of each option stated plainly.
 *
 * Two things the script will not do. It will not lead with a concession —
 * the fee refund is offered only after Alex has paid, once a year — and it
 * will not hide the one real consequence: it is said once, calmly, with the
 * date, because removing it would mislead.
 */
export function buildAgentScript(
  state: AppState,
  opts: { customerOnline: boolean; customerView: string | null },
): AgentScript {
  const { credit, flags, customer } = state;
  /** The active customer's first name — every line is about them. */
  const n = customer.firstName;
  const amount = money(credit.minimumDue);
  const split = money(Math.round((credit.minimumDue / 3) * 100) / 100);
  const fee = money(credit.lateFee);
  const prefs = customer.contactPreferences;
  const refundLine = credit.lateFeeWaivedByGrace
    ? `“There's no late fee on this one — your last few payments were on time, so it was waived automatically.”`
    : credit.lateFeeRefunded
    ? `“I've refunded the ${fee} late fee, since you've paid. Nothing else changes.”`
    : `“And because you've paid, I can refund the ${fee} late fee. We do that once a year.”`;


  /* ------------------------------------- an open request: follow the case */
  const open = [...state.supportCases].reverse().find((c) => c.status !== "resolved");
  if (open && credit.status !== "current") {
    const reply = `${CHANNEL_LABEL[open.contact]}${open.keepRepliesShort ? ", kept short" : ""}`;

    if (open.status === "review_needed") {
      return {
        situation: `Request #${open.ref}: ${open.summary}`,
        opener: `“Thanks for sending this, ${n}. You don't need to explain anything else.”`,
        lines: [
          `“It's the ${amount} on your card. I can make paying it simpler — three small steps in the app.”`,
          `“${creditFileLine(payByDate(credit))}”`,
          "“If that doesn't fit, an adviser can look at other options with you.”",
        ],
        nextStep: `Pick a pathway in the Rescue Simulator. Reply by ${reply}.`,
      };
    }
    if (open.status === "guided_offered") {
      return {
        situation: `Request #${open.ref}: guided payment offered. Waiting on ${n} — don't chase.`,
        opener: "“It's in your app now: three small steps. Take it whenever suits you.”",
        lines: ["“If you'd rather do something different, just reply and I'll pass it to an adviser.”"],
        nextStep: "Wait. No second message today.",
      };
    }
    if (open.status === "specialist_review") {
      return {
        situation: `Request #${open.ref}: with a specialist adviser${
          open.replyBy ? `, reply due ${longDate(open.replyBy)}` : ""
        }.`,
        opener: "“An adviser has your request. They'll reply in writing — you don't need to do anything.”",
        lines: ["“Nothing about your payment changes until you agree to it.”"],
        nextStep: "Adviser: run the eligibility check. Any arrangement needs a second approver.",
      };
    }
    if (open.status === "arrangement_offered") {
      return {
        situation: `Request #${open.ref}: arrangement approved and offered. Waiting on ${n}.`,
        opener: "“An adviser has offered you a new date. It's in your app.”",
        lines: [
          "“There's no extra fee for the extra time.”",
          "“An arrangement doesn't stop a late payment being reported, so paying by the date still matters.”",
        ],
        nextStep: `Wait for ${n} to accept. Don't repeat the offer.`,
      };
    }
  }

  /* ------------------------------------------- resolved: close out warmly */
  if (credit.status === "current" && flags.autopayEnabled) {
    return {
      situation: "Paid and automated. Nothing outstanding.",
      opener: `“All done, ${n}. The card's up to date, and from now on the minimum goes out by itself.”`,
      lines: [
        "“You don't have to remember the date any more. If you ever want it off, it's one tap.”",
        "“It was paid well before anything is reported to the credit reference agencies.”",
        refundLine,
        "“Is there anything else you'd like me to take off your plate while I'm here?”",
      ],
      nextStep: "Close the contact. No follow-up task needed.",
    };
  }

  if (credit.status === "current") {
    return {
      situation: `${n} just cleared the past-due amount, unassisted.`,
      opener: `“That's it — it's done. The card's up to date.”`,
      lines: [
        "“It's paid well before anything is reported to the credit reference agencies.”",
        "“Your safe-to-spend didn't move, because that money was already set aside for you.”",
        refundLine,
        "“One optional thing, and then I'll let you go: I can set up a Direct Debit so the minimum pays itself each month.”",
      ],
      nextStep: credit.lateFeeRefunded || credit.lateFeeWaivedByGrace
        ? "Offer the Direct Debit once, then close the contact."
        : `Optional: refund the ${fee} fee now ${n} has paid (once a year). Offer the Direct Debit once, then close.`,
    };
  }

  /* ------------------------------------------------------- arrangement made */
  if (credit.status === "extended") {
    return {
      situation: `Extension accepted. New date: ${longDate(credit.dueDate)}.`,
      opener: `“You're set. Nothing's due until ${longDate(credit.dueDate)}.”`,
      lines: [
        "“There's no extra fee for the extra time.”",
        // Only promise a reminder if Alex has reminders switched on — the
        // script must never promise anything the product won't do.
        customer.contactPreferences.remindDaysBefore
          ? `“You'll get a reminder in the app ${customer.contactPreferences.remindDaysBefore} day${
              customer.contactPreferences.remindDaysBefore === 1 ? "" : "s"
            } before. Nothing in between.”`
          : "“The new date is in your app. Nothing's due before then.”",
        "“You don't need to do anything today.”",
      ],
      nextStep: customer.contactPreferences.remindDaysBefore
        ? `Nothing to set up: ${n}'s reminder is automatic, from their own settings.`
        : "Note the new date on the account. No follow-up needed.",
    };
  }

  if (credit.status === "split_plan") {
    return {
      situation: `Split plan running. First ${split} paid.`,
      opener: `“First piece is done. The other two will pay themselves.”`,
      lines: [
        `“Two more payments of ${split}, and then the card's clear of this.”`,
        "“You don't need to do anything for either of them.”",
        "“If a date ever lands badly, message me in the app and I'll move it.”",
      ],
      nextStep: "Note the plan on the account and end the contact.",
    };
  }

  /* --------------------------------------- offers out, waiting on a response */
  if (flags.extensionOffered && !flags.extensionAccepted) {
    return {
      situation: `Extension offered. Waiting on ${n} — do not chase.`,
      opener: `“I've put the option in your app. There's no rush on it.”`,
      lines: [
        `“It moves the date to ${
          credit.extendedDueDate ? longDate(credit.extendedDueDate) : "two weeks out"
        }. No extra fee for the extra time.”`,
        "“Take it whenever. It'll still be there tomorrow.”",
        "“I'll stay quiet unless you want me.”",
      ],
      nextStep: `Stop talking and let ${n} decide. Don't send another nudge.`,
    };
  }

  if (flags.splitPlanOffered && !flags.splitPlanAccepted) {
    return {
      situation: `Split plan offered. Waiting on ${n}.`,
      opener: `“I've split it into three in your app — ${split} to start.”`,
      lines: [
        `“${split} now, then two more. Smaller pieces, same result.”`,
        "“Only start it if it feels doable. Otherwise we'll find something else.”",
      ],
      nextStep: "Wait. If nothing happens in 48 hours, offer the extension instead.",
    };
  }

  /* ----------------------------------- live in the app, past due, no offer yet */
  if (opts.customerOnline) {
    return {
      situation: `Past due ${credit.daysOverdue} days. ${n} is in the app right now${
        opts.customerView ? ` — on ${opts.customerView}` : ""
      }.`,
      opener: `“Hi ${n}, it's ${state.agentName} at Capital One. You're not in any trouble — I just wanted to make one thing easy.”`,
      lines: [
        `“There's ${amount} on the ${credit.nickname} that slipped past its date. That's the whole of it.”`,
        `“${creditFileLine(payByDate(credit))}”`,
        `“Paying it won't change your safe-to-spend number — we'd already set that ${amount} aside.”`,
        "“There's a button in your app that does it in one tap. Want me to wait while you look?”",
      ],
      nextStep:
        `Say the one thing, then go quiet and let ${n} act. Don't offer anything yet — the app already makes it one tap.`,
    };
  }

  /* --------------------------------------------- offline: proactive, one touch */
  return {
    situation: `Past due ${credit.daysOverdue} days. ${customer.daysSinceLastOpen} days without opening the app.`,
    opener: `“Hi ${n} — ${state.agentName} at Capital One. Nothing's wrong, and you don't need to call me back.”`,
    lines: [
      `“There's ${amount} sitting on your card. That's all it is.”`,
      `“${creditFileLine(payByDate(credit))}”`,
      "“When you open the app, there's one button at the top that handles it. Nothing else to read.”",
      "“If that amount doesn't work this month, tell me and I'll move the date. No explanation needed.”",
    ],
    nextStep: `${CHANNEL_LABEL[prefs.channel]}, once — ${n}'s chosen channel. Not between ${hourLabel(prefs.quietHours.start)} and ${hourLabel(prefs.quietHours.end)}. Then wait; no second message today.`,
  };
}
