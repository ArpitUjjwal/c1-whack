/**
 * The Pressure Index.
 *
 * Scores a message an agent is about to send, before it reaches the customer.
 *
 * The premise: most of the harm in an arrears conversation is not done by
 * anyone deciding to be harsh. It is done by standard phrasing that nobody
 * chose — template language, collections vocabulary, an urgency formula
 * inherited from a process. Alex's file says plainly that pressure produces
 * silence, so a sentence that applies pressure is a defect in the same way a
 * crash is a defect, and it should be caught before it ships.
 *
 * One distinction matters more than any word list: a *threat* is pressure,
 * but a *real consequence*, stated once, calmly, with a date, is information
 * the customer needs to decide. Deleting it would be misleading — the FCA
 * expects communications to be clear, fair and not misleading — so the index
 * flags threats at full weight and lets one dated consequence through free.
 *
 * Everything here is a transparent lexicon plus a handful of structural
 * rules. No model, no training data, no opacity: each finding names the exact
 * span that caused it and the weight it contributed, so an agent can disagree
 * with the tool and see exactly why it said what it said.
 */

import { creditFileLine } from "../compliance";
import { ABUSE, hasAbuse, normaliseTextSpeak } from "./sentiment";
import type { Tone } from "../types";
import {
  LONG_SENTENCE_WORDS,
  analyseReadability,
  splitSentences,
  splitWords,
  type ReadabilityStats,
} from "./readability";

export type FindingKind =
  | "urgency"
  | "shame"
  | "threat"
  | "jargon"
  | "long-sentence"
  | "grade"
  | "multiple-asks"
  | "passive"
  | "consequence"
  | "abuse"
  | "shouting";

/**
 * Span kinds beyond the scored findings: `allowed` marks the one dated
 * consequence that is let through, `locked` marks compliance wording the
 * rewriters may not touch. Neither contributes points.
 */
export type SpanKind = FindingKind | "allowed" | "locked";

export interface PressureSpan {
  start: number;
  end: number;
  kind: SpanKind;
  text: string;
  /** Why this span is a problem, in one sentence an agent can act on. */
  why: string;
}

export interface PressureFinding {
  kind: FindingKind;
  label: string;
  detail: string;
  /** Points this finding contributed to the score. */
  weight: number;
  count: number;
}

export type PressureBand = "calm" | "firm" | "pressuring" | "harmful";

export interface PressureReport {
  /** 0–100. Higher is worse. */
  score: number;
  band: PressureBand;
  spans: PressureSpan[];
  findings: PressureFinding[];
  readability: ReadabilityStats;
  /** Which engine produced this. Shown in the UI so the source is never hidden. */
  source: "local" | "claude";
}

interface LexEntry {
  pattern: RegExp;
  why: string;
}

/* ------------------------------------------------------------- lexicons -- */

/** Deadline and compulsion language. Reliably produces avoidance. */
const URGENCY: LexEntry[] = [
  { pattern: /\b(?:you|u|ya) must\b/gi, why: "Compulsion. Offer the action instead of demanding it." },
  { pattern: /\bmust be\b/gi, why: "Compulsion. Say what happens, not what is compelled." },
  { pattern: /\b(?:you|u|ya) need to\b/gi, why: "Reads as an order. 'You can' leaves the choice with the customer." },
  { pattern: /\b(?:you|u|ya) have to\b/gi, why: "Reads as an order." },
  { pattern: /\brequired to\b/gi, why: "Procedural compulsion." },
  { pattern: /\bimmediately\b/gi, why: "Manufactured urgency. There is no same-day deadline here." },
  { pattern: /\bright away\b/gi, why: "Manufactured urgency." },
  { pattern: /\bright now\b/gi, why: "Manufactured urgency. There is no same-minute deadline here." },
  { pattern: /\b(?:get|have) (?:this|it|that) (?:done|sorted|paid|cleared)\b/gi, why: "A demand, not an offer. Say what they can do, and leave the choice with them." },
  { pattern: /\bdo it now\b|\bpay now\b/gi, why: "Manufactured urgency." },
  { pattern: /\bas soon as possible\b/gi, why: "Manufactured urgency." },
  { pattern: /\basap\b/gi, why: "Manufactured urgency, and an abbreviation." },
  { pattern: /\burgent(ly)?\b/gi, why: "Nothing here is urgent. Saying so costs trust." },
  { pattern: /\bfinal (notice|demand|reminder)\b/gi, why: "Collections escalation language." },
  { pattern: /\blast chance\b/gi, why: "Threat framing disguised as a deadline." },
  { pattern: /\bact now\b/gi, why: "Marketing urgency in a financial-difficulty context." },
  { pattern: /\b(don't|do not) delay\b/gi, why: "Implies the delay was a choice." },
  { pattern: /\bfailure to\b/gi, why: "Blame plus consequence in three words." },
  { pattern: /\bdeadline\b/gi, why: "A hard word for a date that is usually movable." },
];

/** Blame directed at the customer. The strongest predictor of disengagement. */
const SHAME: LexEntry[] = [
  { pattern: /\b(?:you|u|ya) (failed|neglected|ignored)\b/gi, why: "Direct blame. They already know." },
  { pattern: /\b(?:you|u|ya) (did not|didn't|have not|haven't)\b/gi, why: "Frames the gap as a personal failing." },
  { pattern: /\b(?:you|u|ya) were supposed to\b/gi, why: "Scolding." },
  { pattern: /\b(?:your|ur) responsibility\b/gi, why: "Assigns fault rather than offering help." },
  { pattern: /\bwe('ve| have) (tried|attempted|made)\b/gi, why: "Unopened emails mean the channel failed, not the customer." },
  { pattern: /\b(repeatedly|numerous|several) (attempts|times|notices)\b/gi, why: "Counting past contacts is a reprimand." },
  { pattern: /\bonce again\b/gi, why: "Implies a pattern of fault." },
  { pattern: /\bstill (has not|hasn't|have not|haven't)\b/gi, why: "Emphasises the lapse." },
];

/**
 * Threats: escalation, vague menace, punishment. Flagged at full weight. A
 * real consequence is handled separately below, because it is not a threat.
 */
const THREAT: LexEntry[] = [
  { pattern: /\blegal action\b/gi, why: "Escalation. Not proportionate to £41." },
  { pattern: /\b(reported|report) to\b/gi, why: "Threat framing. If the credit file matters here, say it once, calmly, with the date." },
  { pattern: /\bconsequences\b/gi, why: "Vague threat, which is worse than a specific one." },
  { pattern: /\bpenalt(y|ies)\b/gi, why: "Punishment framing." },
  { pattern: /\b(suspend|suspended|terminate|close your account)\b/gi, why: "Service-withdrawal threat." },
  { pattern: /\bcollection(s| agency)?\b/gi, why: "The single most avoidance-producing word in banking." },
];

/** Terms Alex asked not to receive without a plain-language gloss. */
const JARGON: LexEntry[] = [
  { pattern: /\bdelinquen(t|cy)\b/gi, why: "Collections vocabulary. Say 'past its date'." },
  { pattern: /\bdefault(ed)?\b/gi, why: "Collections vocabulary with a legal connotation." },
  { pattern: /\bcharge[- ]?off\b/gi, why: "Internal accounting term." },
  { pattern: /\barrears\b/gi, why: "Jargon. Say 'behind'." },
  { pattern: /\bremittance\b/gi, why: "Jargon. Say 'payment'." },
  { pattern: /\b(adverse|derogatory)\b/gi, why: "Credit-file jargon." },
  { pattern: /\bamortization\b/gi, why: "Unexplained finance term." },
  { pattern: /\baccrued?\b/gi, why: "Unexplained finance term." },
  { pattern: /\boutstanding (obligation|balance)\b/gi, why: "Say what is owed, in pounds." },
  { pattern: /\bAPR\b/g, why: "Needs a gloss: the yearly cost of carrying a balance." },
];

/**
 * Phrases that state a consequence. Not threats in themselves: the first one
 * that comes with a specific date is allowed; undated or repeated ones score.
 */
const CONSEQUENCE: RegExp[] = [
  /\bcredit (file|report|score|rating|history)\b/gi,
  /\b(affect|impact|damage|hurt|harm) your credit\b/gi,
  /\bto avoid\b/gi,
];

const MONTHS =
  "January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec";

/** "29 November", "29th Nov", "November 29". A specific date, not "soon". */
const DATE_RE = new RegExp(
  `\\b(\\d{1,2}(st|nd|rd|th)?\\s+(${MONTHS})|(${MONTHS})\\s+\\d{1,2}(st|nd|rd|th)?)\\b`,
  "i",
);

export function hasSpecificDate(text: string): boolean {
  return DATE_RE.test(text);
}

/** Capitalised words that are names, not shouting. */
const ACRONYMS = new Set([
  "APR", "UK", "ATM", "PIN", "ISA", "FCA", "DD", "ID", "OK", "PDF", "SMS", "URL", "GBP", "CONC",
]);

/* ------------------------------------------------------------- scoring --- */

const WEIGHTS: Record<FindingKind, { each: number; cap: number; label: string }> = {
  urgency: { each: 14, cap: 42, label: "Urgency and compulsion" },
  shame: { each: 18, cap: 54, label: "Blame directed at the customer" },
  threat: { each: 20, cap: 60, label: "Consequence and threat framing" },
  jargon: { each: 8, cap: 24, label: "Jargon without a plain-language gloss" },
  "long-sentence": { each: 6, cap: 18, label: "Sentences too long to hold" },
  grade: { each: 4, cap: 20, label: "Reading level above plain language" },
  "multiple-asks": { each: 10, cap: 10, label: "More than one decision in one message" },
  passive: { each: 5, cap: 10, label: "Passive voice hiding who does what" },
  consequence: { each: 10, cap: 30, label: "Consequence with no date, or said twice" },
  // One insult is enough to make a message unsendable.
  abuse: { each: 70, cap: 100, label: "Insults, contempt or swearing" },
  // Capitals and exclamation marks read as shouting in a demand.
  shouting: { each: 9, cap: 27, label: "Shouting: capitals or exclamation marks" },
};

function weightOf(kind: SpanKind): number {
  return kind === "allowed" || kind === "locked" ? 0 : WEIGHTS[kind].each;
}

const LEXICONS: { kind: FindingKind; entries: LexEntry[] }[] = [
  { kind: "abuse", entries: ABUSE },
  { kind: "urgency", entries: URGENCY },
  { kind: "shame", entries: SHAME },
  { kind: "threat", entries: THREAT },
  { kind: "jargon", entries: JARGON },
];

export function bandFor(score: number): PressureBand {
  if (score < 20) return "calm";
  if (score < 40) return "firm";
  if (score < 65) return "pressuring";
  return "harmful";
}

export const BAND_COPY: Record<
  PressureBand,
  { label: string; tone: "pos" | "attn" | "red"; advice: string }
> = {
  calm: {
    label: "Calm",
    tone: "pos",
    advice: "Safe to send. This reads the way the customer asked to be spoken to.",
  },
  firm: {
    label: "A little firm",
    tone: "attn",
    advice: "Sendable, but softening one phrase would cost nothing.",
  },
  pressuring: {
    label: "Pressuring",
    tone: "red",
    advice: "This applies pressure. On this file, pressure is what produced the silence.",
  },
  harmful: {
    label: "Likely to cause another silence",
    tone: "red",
    advice: "Do not send. Rewrite it — the whole account history says this backfires.",
  },
};

export interface AnalyseOptions {
  /**
   * Compliance wording present in `text` verbatim. It is highlighted as
   * locked and never scored — it is required, so penalising it would only
   * teach agents to delete it.
   */
  locked?: string[];
}

/**
 * Score a draft message. Pure, synchronous and fast enough to run on every
 * keystroke, which is the point: the feedback has to arrive while the agent
 * is still writing the sentence, not after they have sent it.
 */
export function analysePressure(text: string, opts: AnalyseOptions = {}): PressureReport {
  const spans: PressureSpan[] = [];

  // Locked ranges: highlighted, never scored.
  const lockedRanges: [number, number][] = [];
  for (const segment of opts.locked ?? []) {
    if (!segment.trim()) continue;
    const at = text.indexOf(segment);
    if (at === -1) continue;
    lockedRanges.push([at, at + segment.length]);
    spans.push({
      start: at,
      end: at + segment.length,
      kind: "locked",
      text: segment,
      why: "Required wording. Locked: the rewriter cannot change it.",
    });
  }
  const inLocked = (start: number, end: number) =>
    lockedRanges.some(([a, b]) => start >= a && end <= b);
  const counts = new Map<FindingKind, number>();
  const examples = new Map<FindingKind, string[]>();

  const bump = (kind: FindingKind, example?: string) => {
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
    if (example) {
      const list = examples.get(kind) ?? [];
      if (list.length < 3 && !list.includes(example)) list.push(example);
      examples.set(kind, list);
    }
  };

  for (const { kind, entries } of LEXICONS) {
    for (const entry of entries) {
      // Each RegExp is module-level and global, so reset before reuse.
      entry.pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = entry.pattern.exec(text)) !== null) {
        if (inLocked(match.index, match.index + match[0].length)) {
          if (match[0].length === 0) entry.pattern.lastIndex += 1;
          continue;
        }
        spans.push({
          start: match.index,
          end: match.index + match[0].length,
          kind,
          text: match[0],
          why: entry.why,
        });
        bump(kind, match[0].toLowerCase());
        if (match[0].length === 0) entry.pattern.lastIndex += 1;
      }
    }
  }

  /*
    Consequences, sentence by sentence. The first one that names a specific
    date is information and goes free — unless a locked segment already says
    it, in which case saying it again is repetition. Undated ones, and any
    after the first, score.
  */
  let consequenceStated = (opts.locked ?? []).some((seg) =>
    CONSEQUENCE.some((re) => {
      re.lastIndex = 0;
      return re.test(seg);
    }),
  );
  let cursor = 0;
  for (const sentence of splitSentences(text)) {
    const offset = text.indexOf(sentence, cursor);
    if (offset === -1) continue;
    cursor = offset + sentence.length;
    if (inLocked(offset, offset + sentence.length)) continue;

    let first: RegExpExecArray | null = null;
    for (const re of CONSEQUENCE) {
      re.lastIndex = 0;
      const m = re.exec(sentence);
      if (m && (!first || m.index < first.index)) first = m;
    }
    if (!first) continue;

    const start = offset + first.index;
    const end = start + first[0].length;
    if (!consequenceStated && hasSpecificDate(sentence)) {
      consequenceStated = true;
      spans.push({
        start,
        end,
        kind: "allowed",
        text: first[0],
        why: "A real consequence, stated once, with a date. Allowed — the customer needs it to decide.",
      });
      continue;
    }

    spans.push({
      start,
      end,
      kind: "consequence",
      text: first[0],
      why: consequenceStated
        ? "Already said once. Saying it again turns information into pressure."
        : "State it once, calmly, with the date — or leave it to the locked wording.",
    });
    bump("consequence", first[0].toLowerCase());
  }

  /*
    Shouting. Words in capitals (not acronyms like APR) are shouting on
    their own; exclamation marks only count when the message is already
    demanding or shouting — "Well done!" is fine, "Pay now!" is not.
  */
  const CAPS = /\b[A-Z]{2,}(?:\s+[A-Z]{2,})*\b/g;
  let capsRuns = 0;
  CAPS.lastIndex = 0;
  let caps: RegExpExecArray | null;
  while ((caps = CAPS.exec(text)) !== null) {
    const words = caps[0].split(/\s+/);
    if (words.every((w) => ACRONYMS.has(w))) continue;
    if (inLocked(caps.index, caps.index + caps[0].length)) continue;
    capsRuns += 1;
    spans.push({
      start: caps.index,
      end: caps.index + caps[0].length,
      kind: "shouting",
      text: caps[0],
      why: "Capitals read as shouting. Write it in normal case.",
    });
    bump("shouting", caps[0]);
  }
  const demanding = capsRuns > 0 || (counts.get("urgency") ?? 0) > 0 || (counts.get("abuse") ?? 0) > 0;
  if (demanding) {
    const bangs = (text.match(/!/g) ?? []).length;
    for (let i = 0; i < Math.min(bangs, 2); i += 1) bump("shouting", "!");
  }

  const readability = analyseReadability(text);

  for (const long of readability.longSentences) {
    bump("long-sentence", `${long.words} words`);
  }

  // Reading level above the plain-language target.
  const gradeOver = Math.max(0, Math.ceil(readability.grade - 8));
  for (let i = 0; i < gradeOver; i += 1) bump("grade");

  // More than one thing being asked of the customer at once.
  const questionCount = (text.match(/\?/g) ?? []).length;
  const imperativeLeads = splitSentences(text).filter((s) =>
    /^(please\s+)?(pay|call|reply|confirm|send|visit|log|click|update|contact)\b/i.test(s),
  ).length;
  if (questionCount + imperativeLeads > 1) bump("multiple-asks");

  // Rough passive-voice detector: a form of "to be" followed by a past participle.
  const passiveMatches =
    text.match(/\b(is|are|was|were|been|being|be)\s+\w+(ed|wn|en)\b/gi) ?? [];
  for (const m of passiveMatches) bump("passive", m.toLowerCase());

  const findings: PressureFinding[] = [];
  let score = 0;

  for (const [kind, count] of counts) {
    const w = WEIGHTS[kind];
    const weight = Math.min(w.cap, w.each * count);
    score += weight;
    findings.push({
      kind,
      label: w.label,
      detail: describe(kind, examples.get(kind) ?? [], count, readability),
      weight,
      count,
    });
  }

  score = Math.min(100, Math.round(score));
  findings.sort((a, b) => b.weight - a.weight);
  spans.sort((a, b) => a.start - b.start);

  return {
    score,
    band: bandFor(score),
    spans: mergeOverlaps(spans),
    findings,
    readability,
    source: "local",
  };
}

function describe(
  kind: FindingKind,
  examples: string[],
  count: number,
  readability: ReadabilityStats,
): string {
  switch (kind) {
    case "long-sentence":
      return `${count} sentence${count === 1 ? "" : "s"} over ${LONG_SENTENCE_WORDS} words. Plain language is one idea at a time.`;
    case "grade":
      return `Reads at grade ${readability.grade}. The target is 8 or below.`;
    case "multiple-asks":
      return "Asking for more than one thing forces a decision about which to do first.";
    case "passive":
      return `Passive voice hides who acts${examples.length ? ` — “${examples[0]}”` : ""}.`;
    case "consequence":
      return "Keep the real consequence, once, with its date. Drop the rest.";
    default:
      return examples.length
        ? `Found ${examples.map((e) => `“${e}”`).join(", ")}.`
        : `${count} occurrence${count === 1 ? "" : "s"}.`;
  }
}

/** Overlapping matches would double-underline; keep the highest-weight span. */
function mergeOverlaps(spans: PressureSpan[]): PressureSpan[] {
  const out: PressureSpan[] = [];
  for (const span of spans) {
    const prev = out[out.length - 1];
    if (prev && span.start < prev.end) {
      // Locked always wins: it is the one span the agent cannot act on.
      if (prev.kind === "locked") continue;
      if (span.kind === "locked" || weightOf(span.kind) > weightOf(prev.kind)) {
        out[out.length - 1] = span;
      }
      continue;
    }
    out.push(span);
  }
  return out;
}

/* ------------------------------------------------------------- rewrite --- */

/** Placeholder for removed urgency, resolved once we know if a date is stated. */
const WHEN = "\u2063WHEN\u2063";

interface Substitution {
  pattern: RegExp;
  replacement: string;
  /**
   * The phrase carried a real consequence wrapped in a threat. The threat is
   * removed; the consequence is restated once, calmly, with a date, below.
   */
  consequence?: boolean;
}

/**
 * Phrase-level substitutions. Conservative: the meaning must survive, and so
 * must any real consequence — it is re-stated, not deleted.
 */
const SUBSTITUTIONS: Substitution[] = [
  {
    pattern: /\s*failure to do so will (be reported to|affect) (the |your )?credit( bureaus?| reference agenc(y|ies)| file| report| rating)?\.?/gi,
    replacement: "",
    consequence: true,
  },
  {
    pattern: /\s*(this |it )?will be reported to the credit( bureaus?| reference agenc(y|ies))\.?/gi,
    replacement: "",
    consequence: true,
  },
  { pattern: /\s*to avoid (collections?|further action|a default|damage to your credit)/gi, replacement: "", consequence: true },
  { pattern: /\byou must pay\b/gi, replacement: "you can pay" },
  { pattern: /\byou need to pay\b/gi, replacement: "you can pay" },
  { pattern: /\byou have to pay\b/gi, replacement: "you can pay" },
  { pattern: /\byou must\b/gi, replacement: "you can" },
  { pattern: /\byou need to\b/gi, replacement: "you can" },
  { pattern: /\byou have to\b/gi, replacement: "you can" },
  // Timing is information. Urgency goes; the date stays (see WHEN below).
  { pattern: /\s*\b(immediately|right away|right now|as soon as possible|asap)\b/gi, replacement: ` ${WHEN}` },
  { pattern: /\b(?:get|have) (?:this|it|that) (?:done|sorted|paid|cleared)\b/gi, replacement: "sort this out" },
  { pattern: /\b(?:do it|pay) now\b/gi, replacement: "pay" },
  { pattern: /\bfinal (notice|demand|reminder)\b/gi, replacement: "a note" },
  { pattern: /\b(is|was) delinquent\b/gi, replacement: "is behind" },
  { pattern: /\bdelinquent\b/gi, replacement: "past its date" },
  { pattern: /\bdelinquency\b/gi, replacement: "the missed payment" },
  { pattern: /\bin arrears\b/gi, replacement: "behind" },
  { pattern: /\bremittance\b/gi, replacement: "payment" },
  { pattern: /\boutstanding balance\b/gi, replacement: "balance" },
  { pattern: /\bfailure to\b/gi, replacement: "if you don't" },
  {
    pattern: /\bwe('ve| have) (tried|attempted) to (reach|contact) you( several times| repeatedly| numerous times)?\b/gi,
    replacement: "I wanted to check in",
  },
  { pattern: /\byou (failed|neglected) to (make|pay|send|submit)\b/gi, replacement: "we didn't receive" },
  { pattern: /\burgent(ly)?\b/gi, replacement: "" },
  { pattern: /\bact now\b/gi, replacement: "whenever suits you" },
];

export interface RewriteContext {
  amount?: string;
  agentName?: string;
  /** Customer's first name, for a Warm greeting. */
  firstName?: string;
  /**
   * What the customer has chosen to share, for the Claude brief. Only shared
   * labels and note — never anything from their phone.
   */
  customer?: {
    name: string;
    firstName: string;
    preferences: string[];
    note: string;
    minimumDue: number;
    daysOverdue: number;
  };
  /** The tone the agent picked. The rewrite is written in it. */
  tone?: Tone;
  /** Whether there is anything to celebrate (e.g. the account is up to date). */
  goodNews?: boolean;
  /** Human date by which paying keeps the missed payment off the credit file. */
  payBy?: string;
  /**
   * Locked compliance wording that will be appended verbatim on send. Never
   * rewritten; used only to avoid restating what it already says.
   */
  locked?: string[];
}

export interface RewriteResult {
  text: string;
  /** Score of the rewritten text, so the improvement is visible. */
  report: PressureReport;
  /** True when substitutions were not enough and a template was used. */
  usedTemplate: boolean;
}

/** True when locked wording already states the credit-file consequence. */
function lockedStatesConsequence(locked: string[] = []): boolean {
  return locked.some((seg) =>
    CONSEQUENCE.some((re) => {
      re.lastIndex = 0;
      return re.test(seg);
    }),
  );
}

/**
 * Local rewrite.
 *
 * Two stages: targeted phrase substitution, then — only if the result is
 * still applying pressure — a known-good template. Threats are removed; a
 * real consequence is restated once, calmly, with the date, unless locked
 * wording already carries it. The UI says which engine produced the result,
 * and the Claude path replaces this with a bespoke rewrite when a key is
 * present.
 */
export function rewriteLocally(text: string, ctx: RewriteContext = {}): RewriteResult {
  const tone = effectiveTone(ctx);
  const consequenceElsewhereEarly = lockedStatesConsequence(ctx.locked ?? []);

  // An insult poisons the whole message: start again from the facts, in the
  // picked tone, rather than trying to salvage the sentence around it.
  if (hasAbuse(normaliseTextSpeak(text))) {
    const out = template(ctx, !consequenceElsewhereEarly, tone);
    return { text: out, report: analysePressure(out), usedTemplate: true };
  }

  /*
    Shouting, or a draft too short to carry the facts, is rewritten from the
    facts in the picked tone — patching "u need to get this done RIGHT NOW!"
    word by word can only produce a politer fragment, not a good message.
  */
  const shouted = analysePressure(text).findings.some((f) => f.kind === "shouting");

  let out = normaliseTextSpeak(text)
    // A leading "no" / "look" / "listen" is a retort, not content.
    .replace(/^\s*(?:no|look|listen|ugh)\b[,!.]?\s+/i, "");
  let droppedConsequence = false;
  for (const { pattern, replacement, consequence } of SUBSTITUTIONS) {
    pattern.lastIndex = 0;
    if (consequence && pattern.test(out)) droppedConsequence = true;
    pattern.lastIndex = 0;
    out = out.replace(pattern, replacement);
  }

  const locked = ctx.locked ?? [];
  const consequenceElsewhere = lockedStatesConsequence(locked);
  let statedDate = false;

  if (droppedConsequence && !consequenceElsewhere && ctx.payBy) {
    out = `${tidy(out.replace(new RegExp(` ?${WHEN}`, "g"), ""))} ${creditFileLine(ctx.payBy)}`;
    statedDate = true;
  }
  // Urgency removed: keep the timing if we have a real date and haven't said it.
  out = out.replace(
    new RegExp(` ?${WHEN}`, "g"),
    !statedDate && !consequenceElsewhere && ctx.payBy ? ` by ${ctx.payBy}` : "",
  );

  out = tidy(out);
  out = splitLongSentences(out);

  let report = analysePressure(out);
  let usedTemplate = false;

  const tooShort = splitWords(out).length < 8;

  if (report.score >= 40 || shouted || tooShort) {
    out = template(ctx, !consequenceElsewhere, tone);
    report = analysePressure(out);
    usedTemplate = true;
  } else {
    out = applyTone(out, tone, ctx);
    report = analysePressure(out);
  }

  return { text: out, report, usedTemplate };
}

/** Celebrate only when there is good news; otherwise Warm is the honest choice. */
function effectiveTone(ctx: RewriteContext): Tone {
  const tone = ctx.tone ?? "calm";
  return tone === "celebrate" && !ctx.goodNews ? "warm" : tone;
}

const GREETING = /^(hi|hello|dear|good (morning|afternoon|evening))\b/i;

/** Dress a substituted message in the picked tone, without adding pressure. */
function applyTone(text: string, tone: Tone, ctx: RewriteContext): string {
  const name = ctx.firstName ?? "there";
  // Calm and Warm never shout: exclamation marks become full stops.
  if (tone !== "celebrate") text = text.replace(/!+/g, ".");
  if (tone === "warm") {
    const opened = GREETING.test(text) ? text : `Hi ${name}, ${lowerFirst(text)}`;
    return /here if you need/i.test(opened) ? opened : `${opened} I'm here if you need anything.`;
  }
  if (tone === "celebrate") {
    return /good news|well done/i.test(text) ? text : `Good news, ${name}! ${text}`;
  }
  return text;
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function template(ctx: RewriteContext, includeConsequence: boolean, tone: Tone = "calm"): string {
  const amount = ctx.amount ?? "the minimum";
  const name = ctx.firstName ?? "there";
  const agent = ctx.agentName ?? "your support team";
  if (tone === "celebrate") {
    return `Good news, ${name}! Your card is up to date and there's nothing else to do. Thanks for sorting it.`;
  }
  if (tone === "warm") {
    return [
      `Hi ${name}, it's ${agent} at Capital One. I hope you're doing OK.`,
      `There's ${amount} on your card that's past its date.`,
      includeConsequence && ctx.payBy ? creditFileLine(ctx.payBy) : "",
      `There's one button at the top of the app for it.`,
      `I'm here if you'd like a hand with anything.`,
    ]
      .filter(Boolean)
      .join(" ");
  }
  return [
    `Hi ${ctx.firstName ?? "there"} — it's ${ctx.agentName ?? "your support team"} at Capital One. You don't need to reply.`,
    `There's ${amount} on your card that's past its date.`,
    includeConsequence && ctx.payBy ? creditFileLine(ctx.payBy) : "",
    `There's one button at the top of the app for it.`,
    `If that amount doesn't work this month, tell me and we'll find something that does.`,
  ]
    .filter(Boolean)
    .join(" ");
}

/** Repair the spacing and capitalisation that substitutions leave behind. */
function tidy(text: string): string {
  return text
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,!?;:])/g, "$1")
    .replace(/(?<!\b[A-Z])([.!?])\s*([a-z])/g, (_m, p: string, c: string) => `${p} ${c.toUpperCase()}`)
    .replace(/^\s*([a-z])/, (_m, c: string) => c.toUpperCase())
    .trim();
}

/** Break over-long sentences at a natural joint rather than mid-clause. */
function splitLongSentences(text: string): string {
  return splitSentences(text)
    .map((sentence) => {
      if (splitWords(sentence).length <= LONG_SENTENCE_WORDS) return sentence;
      const split = sentence.replace(/,\s+(and|but|so)\s+/i, ". ");
      return split.replace(/;\s+/g, ". ");
    })
    .join(" ")
    .replace(/(?<!\b[A-Z])([.!?])\s*([a-z])/g, (_m, p: string, c: string) => `${p} ${c.toUpperCase()}`);
}
