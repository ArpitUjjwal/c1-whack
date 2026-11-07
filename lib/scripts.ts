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
  /** Phrasings to stay away from, with the reason. */
  avoid: { phrase: string; why: string }[];
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
 * Every variant follows the same rules, taken from Alex's declared profile:
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
  const amount = money(credit.minimumDue);
  const split = money(Math.round((credit.minimumDue / 3) * 100) / 100);
  const fee = money(credit.lateFee);
  const prefs = customer.contactPreferences;
  const refundLine = credit.lateFeeRefunded
    ? `“I've refunded the ${fee} late fee, since you've paid. Nothing else changes.”`
    : `“And because you've paid, I can refund the ${fee} late fee. We do that once a year.”`;

  const universalAvoid = [
    {
      phrase: "“You need to…” / “You must…”",
      why: "Pressure is what preceded the 14 quiet days in the first place.",
    },
    {
      phrase: "“Delinquent”, “default”, “collections”",
      why: "Alex asked for plain language. These words escalate without informing.",
    },
    {
      phrase: "Leading with a fee refund",
      why: "Goodwill follows action. Offered before paying, it rewards going quiet.",
    },
    {
      phrase: "Stacking options: “You can do A, or B, or C…”",
      why: "Alex processes one step at a time. Offer one thing, wait, then offer the next.",
    },
  ];

  /* ------------------------------------------- resolved: close out warmly */
  if (credit.status === "current" && flags.autopayEnabled) {
    return {
      situation: "Paid and automated. Nothing outstanding.",
      opener: `“All done, Alex. The card's up to date, and from now on the minimum goes out by itself.”`,
      lines: [
        "“You don't have to remember the date any more. If you ever want it off, it's one tap.”",
        "“It was paid well before anything is reported to the credit reference agencies.”",
        refundLine,
        "“Is there anything else you'd like me to take off your plate while I'm here?”",
      ],
      avoid: universalAvoid,
      nextStep: "Close the contact. No follow-up task needed.",
    };
  }

  if (credit.status === "current") {
    return {
      situation: "Alex just cleared the past-due amount, unassisted.",
      opener: `“That's it — it's done. The card's up to date.”`,
      lines: [
        "“It's paid well before anything is reported to the credit reference agencies.”",
        "“Your safe-to-spend didn't move, because that money was already set aside for you.”",
        refundLine,
        "“One optional thing, and then I'll let you go: I can set up a Direct Debit so the minimum pays itself each month.”",
      ],
      avoid: universalAvoid,
      nextStep: credit.lateFeeRefunded
        ? "Offer the Direct Debit once, then close the contact."
        : `Optional: refund the ${fee} fee now Alex has paid (once a year). Offer the Direct Debit once, then close.`,
    };
  }

  /* ------------------------------------------------------- arrangement made */
  if (credit.status === "extended") {
    return {
      situation: `Extension accepted. New date: ${longDate(credit.dueDate)}.`,
      opener: `“You're set. Nothing's due until ${longDate(credit.dueDate)}.”`,
      lines: [
        "“There's no extra fee for the extra time.”",
        "“You'll get one gentle reminder two days before. Nothing in between.”",
        "“You don't need to do anything today.”",
      ],
      avoid: universalAvoid,
      nextStep: `Confirm the reminder is set for two days before ${longDate(credit.dueDate)}.`,
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
      avoid: universalAvoid,
      nextStep: "Note the plan on the account and end the contact.",
    };
  }

  /* --------------------------------------- offers out, waiting on a response */
  if (flags.extensionOffered && !flags.extensionAccepted) {
    return {
      situation: "Extension offered. Waiting on Alex — do not chase.",
      opener: `“I've put the option in your app. There's no rush on it.”`,
      lines: [
        `“It moves the date to ${
          credit.extendedDueDate ? longDate(credit.extendedDueDate) : "two weeks out"
        }. No extra fee for the extra time.”`,
        "“Take it whenever. It'll still be there tomorrow.”",
        "“I'll stay quiet unless you want me.”",
      ],
      avoid: [
        ...universalAvoid,
        {
          phrase: "Repeating the offer",
          why: "Alex has seen it. A second ask reads as a deadline.",
        },
      ],
      nextStep: "Stop talking and let Alex decide. Don't send another nudge.",
    };
  }

  if (flags.splitPlanOffered && !flags.splitPlanAccepted) {
    return {
      situation: "Split plan offered. Waiting on Alex.",
      opener: `“I've split it into three in your app — ${split} to start.”`,
      lines: [
        `“${split} now, then two more. Smaller pieces, same result.”`,
        "“Only start it if it feels doable. Otherwise we'll find something else.”",
      ],
      avoid: universalAvoid,
      nextStep: "Wait. If nothing happens in 48 hours, offer the extension instead.",
    };
  }

  /* ----------------------------------- live in the app, past due, no offer yet */
  if (opts.customerOnline) {
    return {
      situation: `Past due ${credit.daysOverdue} days. Alex is in the app right now${
        opts.customerView ? ` — on ${opts.customerView}` : ""
      }.`,
      opener: `“Hi Alex, it's ${state.agentName} at Capital One. You're not in any trouble — I just wanted to make one thing easy.”`,
      lines: [
        `“There's ${amount} on the ${credit.nickname} that slipped past its date. That's the whole of it.”`,
        `“${creditFileLine(payByDate(credit))}”`,
        `“Paying it won't change your safe-to-spend number — we'd already set that ${amount} aside.”`,
        "“There's a button in your app that does it in one tap. Want me to wait while you look?”",
      ],
      avoid: [
        ...universalAvoid,
        {
          phrase: "Mentioning the 14-day gap",
          why: "Naming the gap makes it a thing to be ashamed of. Alex knows.",
        },
      ],
      nextStep:
        "Say the one thing, then go quiet and let Alex act. Don't offer anything yet — the app already makes it one tap.",
    };
  }

  /* --------------------------------------------- offline: proactive, one touch */
  return {
    situation: `Past due ${credit.daysOverdue} days. ${customer.daysSinceLastOpen} days without opening the app.`,
    opener: `“Hi Alex — ${state.agentName} at Capital One. Nothing's wrong, and you don't need to call me back.”`,
    lines: [
      `“There's ${amount} sitting on your card. That's all it is.”`,
      `“${creditFileLine(payByDate(credit))}”`,
      "“When you open the app, there's one button at the top that handles it. Nothing else to read.”",
      "“If that amount doesn't work this month, tell me and I'll move the date. No explanation needed.”",
    ],
    avoid: [
      ...universalAvoid,
      {
        phrase: "“We've tried to reach you several times.”",
        why: "Three unopened emails is evidence the channel failed, not that Alex did.",
      },
      {
        phrase: "Any mention of a deadline or final notice",
        why: "Alex told us money tasks are hard to start. Urgency reliably produces another 14 days of silence.",
      },
    ],
    nextStep: `${CHANNEL_LABEL[prefs.channel]}, once — Alex's chosen channel. Not between ${hourLabel(prefs.quietHours.start)} and ${hourLabel(prefs.quietHours.end)}. Then wait; no second message today.`,
  };
}
