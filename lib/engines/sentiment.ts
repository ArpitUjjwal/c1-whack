/**
 * Tone check for outgoing messages.
 *
 * Two layers, both deterministic and instant:
 *  1. An abuse lexicon (insults, contempt, swearing, including common
 *     obfuscations and text-speak). Any hit makes the message unsendable.
 *  2. A pre-built sentiment model — AFINN-165 via the `sentiment` package, a
 *     published word-valence list — for overall polarity.
 *
 * The detected tone is then compared with the tone the agent picked (Calm,
 * Warm, Celebrate). Picking "Calm" labels how a message is styled on the
 * customer's phone; it says nothing about the words. This check is what
 * catches the gap.
 *
 * AFINN scores ordinary banking words ("pay", "due", "fee") as negative, and
 * reads "nothing's wrong" as negative. Those are zeroed below so only real
 * hostility moves the score.
 */

import Sentiment from "sentiment";
import type { Tone } from "../types";

const analyser = new Sentiment();

/** Neutral in a banking context, whatever AFINN thinks. */
const DOMAIN_NEUTRAL: Record<string, number> = {
  pay: 0, paid: 0, paying: 0, payment: 0, payments: 0, owe: 0, owed: 0,
  due: 0, debt: 0, late: 0, fee: 0, fees: 0, charge: 0, charged: 0,
  balance: 0, credit: 0, minimum: 0, avoid: 0, wrong: 0, problem: 0,
  worry: 0, worries: 0, trouble: 0, miss: 0, missed: 0, failure: 0,
};

export interface AbuseEntry {
  pattern: RegExp;
  why: string;
}

/**
 * Insults, contempt and swearing aimed at a customer. Patterns tolerate
 * common obfuscations (b1tch, f*ck) because a filter that a single asterisk
 * defeats is not a filter.
 */
export const ABUSE: AbuseEntry[] = [
  { pattern: /\bb[i1!*]tch(es|y)?\b/gi, why: "An insult. Never acceptable to a customer." },
  { pattern: /\bf+[\W_]*[u*]+[\W_]*c+[\W_]*k+\w*/gi, why: "Swearing at a customer." },
  { pattern: /\bsh[i1!*]t\w*/gi, why: "Swearing at a customer." },
  { pattern: /\b(bastard|arsehole|asshole|dickhead|prick|wanker|twat|cow)s?\b/gi, why: "An insult. Never acceptable to a customer." },
  { pattern: /\b(idiot|moron|stupid|dumb|thick|useless|pathetic|lazy|loser|deadbeat|scrounger|liar)s?\b/gi, why: "Contempt for the customer. It ends the conversation." },
  { pattern: /\b(shut up|grow up|get a grip|sort yourself out|get your act together|or else)\b/gi, why: "Contempt or a veiled threat." },
];

/** Text-speak that hides compulsion from simple patterns ("u need to"). */
export const TEXT_SPEAK: [RegExp, string][] = [
  [/\bu\b/gi, "you"],
  [/\bur\b/gi, "your"],
  [/\bya\b/gi, "you"],
  [/\bpls\b|\bplz\b/gi, "please"],
  [/\bthx\b|\bthnx\b/gi, "thanks"],
];

/** Lower-case "u need to pay" → "you need to pay", for analysis only. */
export function normaliseTextSpeak(text: string): string {
  let out = text;
  for (const [re, to] of TEXT_SPEAK) {
    re.lastIndex = 0;
    out = out.replace(re, to);
  }
  return out;
}

export type DetectedTone =
  | "hostile"
  | "pressuring"
  | "firm"
  | "negative"
  | "neutral"
  | "warm"
  | "celebratory";

export const DETECTED_LABEL: Record<DetectedTone, string> = {
  hostile: "Hostile",
  pressuring: "Pressuring",
  firm: "A little firm",
  negative: "Negative",
  neutral: "Neutral",
  warm: "Warm",
  celebratory: "Celebratory",
};

export interface ToneCheck {
  detected: DetectedTone;
  /** AFINN score after the banking overrides. */
  score: number;
  /** True when any abuse pattern matched. */
  abusive: boolean;
  /** How the picked tone and the detected tone relate. Only insults block. */
  verdict: "match" | "warn" | "block";
  /** One sentence for the agent. Empty when it matches. */
  advice: string;
}

const CELEBRATE_WORDS = /\b(well done|congrat\w*|great news|good news|sorted|all done|caught up|nice one)\b/i;

export function hasAbuse(text: string): boolean {
  return ABUSE.some(({ pattern }) => {
    pattern.lastIndex = 0;
    return pattern.test(text);
  });
}

/**
 * Detect the tone of `text` and compare it with the tone the agent picked.
 * `goodNews` is whether there is anything to celebrate (e.g. the account is
 * up to date) — "Celebrate" on a past-due reminder reads as mockery.
 */
export function checkTone(
  text: string,
  picked: Tone,
  goodNews: boolean,
  /** The Pressure Index band: polite words can still apply pressure. */
  pressure: "calm" | "firm" | "pressuring" | "harmful" = "calm",
): ToneCheck {
  const normal = normaliseTextSpeak(text);
  const abusive = hasAbuse(normal);
  const { score, comparative } = analyser.analyze(normal, { extras: DOMAIN_NEUTRAL });

  let detected: DetectedTone;
  if (abusive || score <= -4 || comparative <= -0.5) detected = "hostile";
  else if (pressure === "pressuring" || pressure === "harmful") detected = "pressuring";
  else if (pressure === "firm" && picked !== "celebrate") detected = "firm";
  else if (score <= -2) detected = "negative";
  else if ((CELEBRATE_WORDS.test(normal) && score >= 0) || (score >= 3 && /!/.test(normal)))
    detected = "celebratory";
  else if (score >= 2) detected = "warm";
  else detected = "neutral";

  const pickedLabel = picked === "calm" ? "Calm" : picked === "warm" ? "Warm" : "Celebrate";

  if (abusive) {
    return {
      detected,
      score,
      abusive,
      verdict: "block",
      advice: `You picked ${pickedLabel}, but this contains an insult or swearing. It can't be sent — rewrite it.`,
    };
  }
  if (detected === "hostile") {
    // Hostile without an insult is a strong warning, not a hard block: the
    // word list can't see sarcasm, and AFINN can misread. Insults block.
    return {
      detected,
      score,
      abusive,
      verdict: "warn",
      advice: `You picked ${pickedLabel}, but this reads as hostile. Rewrite it before sending.`,
    };
  }
  if (detected === "pressuring") {
    return {
      detected,
      score,
      abusive,
      verdict: "warn",
      advice: `You picked ${pickedLabel}, but the wording applies pressure. Rewriting will fix it.`,
    };
  }
  if (detected === "firm") {
    return {
      detected,
      score,
      abusive,
      verdict: "warn",
      advice: `You picked ${pickedLabel}, but one phrase is a little firm. A rewrite softens it.`,
    };
  }
  if (detected === "negative") {
    return {
      detected,
      score,
      abusive,
      verdict: "warn",
      advice: `You picked ${pickedLabel}, but this reads as negative. Rewriting will bring it in line.`,
    };
  }
  if (picked === "celebrate" && !goodNews) {
    return {
      detected,
      score,
      abusive,
      verdict: "warn",
      advice: "Celebrate is for good news, and nothing's been resolved yet. Calm or Warm would fit better.",
    };
  }
  return { detected, score, abusive, verdict: "match", advice: "" };
}
