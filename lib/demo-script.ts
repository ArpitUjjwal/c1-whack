import type { Action, DemoAction, Role } from "./types";

/**
 * The Demo Director's script.
 *
 * One keypress advances both windows, because the beat lives in shared state
 * and travels over the same channel everything else does. That removes the
 * worst failure mode of a two-window live demo: the two windows getting out
 * of step while someone talks.
 *
 * Each beat may dispatch a state action, send an instruction to a surface, or
 * do nothing but put a caption up.
 */
export interface Beat {
  /** Shown in the caption bar on both windows. */
  caption: string;
  /** Which window the audience should be looking at. */
  look: Role | "both";
  /** One line on what is being demonstrated, for the presenter. */
  note?: string;
  /** Dispatched to shared state when the beat is entered. */
  action?: Action;
  /** Ephemeral instruction, and which surface should carry it out. */
  signal?: { to: Role; action: DemoAction };
}

export const BEATS: Beat[] = [
  {
    caption:
      "Nearly half of people behind on payments feel harassed (49%) or overwhelmed (48%) by the volume of contact from creditors. — Money and Mental Health",
    look: "both",
    note: "Open on the number. Then: most banking apps assume you can manage your money today. What about the days you can't?",
  },
  {
    caption:
      "First time in the new app: Alex ticks what's hard — starting money tasks, and phone calls. The app changes as they tick.",
    look: "customer",
    signal: { to: "customer", action: "setup_pick" },
    note: "No diagnosis, no reasons. Read out the effect line under each option.",
  },
  {
    caption:
      "Alex chooses to share the resulting preferences — only those labels — with support. What they ticked never leaves the phone.",
    look: "both",
    signal: { to: "customer", action: "setup_finish" },
    note: "Point at the console: 'How Alex prefers to bank' fills in live. Sharing starts switched off.",
  },
  {
    caption:
      "Alex hasn't opened the app in 14 days. Instead of a pile of notifications: what changed, in three lines, and one next step.",
    look: "customer",
    signal: { to: "customer", action: "setup_open" },
    note: "Welcome-back. No guilt language, no counts of days.",
  },
  {
    caption:
      "Because Alex said starting money tasks is hard, the app opens in Safe Mode: just what matters. (Anyone can also tap “I can't handle banking today”.)",
    look: "customer",
    signal: { to: "customer", action: "enter_safe_mode" },
    note: "Available to anyone. And the bank is never told: Safe Mode lives on the phone.",
  },
  {
    caption:
      "The Financial Time Machine: if Alex steps away for a week, what actually needs attention?",
    look: "customer",
    signal: { to: "customer", action: "time_machine_week" },
    note: "Card minimum needs you. Rent: check it's arranged. Phone and energy pay themselves. Projected balance, assumptions printed. It never acts.",
  },
  {
    caption:
      "“I can't manage this one right now.” The Advocate prepares the request — and shows exactly what will be shared, and what won't.",
    look: "customer",
    signal: { to: "customer", action: "advocate_open" },
    note: "Read the 'Not shared' list out loud. No feelings, no diagnosis, nothing from Safe Mode or the Time Machine.",
  },
  {
    caption: "Alex sends it. Nothing left the phone until Alex pressed the button.",
    look: "both",
    signal: { to: "customer", action: "advocate_send" },
  },
  {
    caption:
      "Request #1042 lands in the Care Centre instantly — beside it, what was deliberately not shared.",
    look: "bank",
    note: "Point at the access log: opening the case was recorded. Alex never has to explain twice.",
  },
  {
    caption:
      "The Rescue Simulator: three pathways, seen from Alex's side, before anything is offered.",
    look: "bank",
    note: "Standard process: four contacts, reported at 30 days. No pathway assumes an extension or a fee waiver.",
  },
  {
    caption: "Before replying, watch what the standard collections script would have said.",
    look: "bank",
    signal: { to: "bank", action: "load_bad_example" },
    note: "The Pressure Index spikes as the words land.",
  },
  {
    caption: "One click rewrites it. The threats go; the one real date stays.",
    look: "bank",
    signal: { to: "bank", action: "rewrite_draft" },
    note: "100 → 0. Removing a real consequence would be misleading, so it's kept — once, calmly, with the date.",
  },
  {
    caption:
      "Sent — the 2nd message this week, inside Alex's own limit. On the phone it waits quietly: Safe Mode holds messages until Alex wants them.",
    look: "both",
    signal: { to: "bank", action: "send_draft" },
    note: "Point at the frequency guard, then at '1 message — read when you like' on the phone.",
  },
  {
    caption: "The agent offers guided payment support.",
    look: "both",
    action: { type: "OFFER_GUIDED_PAYMENT" },
    note: "Fits the request: Alex asked for a simpler way, not different terms.",
  },
  {
    caption: "Alex's screen updates: the same payment, in three small steps.",
    look: "customer",
  },
  {
    caption: "Alex pays. Safe-to-Spend doesn't move — that money was already set aside.",
    look: "both",
    action: { type: "PAY_CREDIT", amount: 41 },
  },
  {
    caption:
      "Across everyone: Accessibility Insights — what customers struggle with most, in their own words, and what actually works.",
    look: "bank",
    note: "Point at the recommendations: two are tips that go straight back into the app. Built from requests, never from phones; no group under ten.",
  },
  {
    caption:
      "Thirty days, three policies. Standard: never resolved, reported. the design alone: resolved on day four, nothing given away.",
    look: "bank",
    note: "Run the simulation.",
  },
  {
    caption:
      "Most banks respond when a payment fails. This helps customers ask for support before they reach that point.",
    look: "both",
    note: "Then stop talking.",
  },
];
