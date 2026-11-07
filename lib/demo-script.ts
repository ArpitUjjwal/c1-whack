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
    note: "Open on the number. Then: this is what that looks like for one customer.",
  },
  {
    caption: "Alex hasn't opened the app in 14 days. Three reminder emails, none opened.",
    look: "bank",
    note: "Set the scene. The silence is the problem, not the £41.",
  },
  {
    caption:
      "The Silence Model reads that silence as information — six features, weights on screen.",
    look: "bank",
    note: "Point at the contributions. Say the weights are hand-tuned, not trained.",
  },
  {
    caption: "The Silence Model picks the channel: one in-app message, not a fourth email.",
    look: "bank",
    note: "It decides how to reach out, never what to give away. Point at the 'never feeds credit decisions' line.",
  },
  {
    caption: "Now watch what the standard collections script would have said.",
    look: "bank",
    signal: { to: "bank", action: "load_bad_example" },
    note: "The Pressure Index spikes as the words land.",
  },
  {
    caption:
      "100 out of 100. Every harmful phrase is underlined, with the reason and the points.",
    look: "bank",
    note: "This is the message that causes the next two weeks of silence.",
  },
  {
    caption: "One click rewrites it.",
    look: "bank",
    signal: { to: "bank", action: "rewrite_draft" },
    note: "The threats go. The one real consequence stays — once, calmly, with the date.",
  },
  {
    caption: "Sent. It reaches Alex's phone instantly, and calmly.",
    look: "both",
    signal: { to: "bank", action: "send_draft" },
  },
  {
    caption: "Alex is on the home screen, and starting to struggle with it.",
    look: "customer",
    signal: { to: "customer", action: "inject_strain" },
    note: "Scroll thrash and taps that hit nothing. Strain crosses 45.",
  },
  {
    caption:
      "The app offers to simplify. It never says why, never diagnoses, and takes no for an answer.",
    look: "customer",
    note: "Read the offer wording out loud — that is the accessibility work.",
  },
  {
    caption: "Focus Mode: one decision, nothing else. Load drops below 25.",
    look: "both",
    action: { type: "SET_FOCUS_MODE", on: true },
    note: "Watch the Screen lens on the console drop at the same moment. Only the screen's load crosses over — never how Alex is finding it.",
  },
  {
    caption: "Alex pays. Safe-to-Spend doesn't move — that money was already set aside.",
    look: "both",
    action: { type: "PAY_CREDIT", amount: 41 },
    note: "The strongest single line in the product.",
  },
  {
    caption:
      "The console rewrites itself mid-sentence: balances, timeline, and the agent's script.",
    look: "bank",
  },
  {
    caption:
      "Only now, after Alex has paid, is there an optional goodwill refund — once a year. It rewards re-engaging, not silence.",
    look: "both",
    action: { type: "REFUND_LATE_FEE" },
    note: "Concessions are extras, never the mechanism.",
  },
  {
    caption:
      "Thirty days, three policies. Standard: never resolved, reported, six years on file. Clarity's design alone: resolved on day four, nothing given away.",
    look: "bank",
    note: "Run the simulation. The extras lane is faster, but the design lane is the claim.",
  },
];
