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
 * Everything here is a transparent lexicon plus a handful of structural
 * rules. No model, no training data, no opacity: each finding names the exact
 * span that caused it and the weight it contributed, so an agent can disagree
 * with the tool and see exactly why it said what it said.
 */

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
  | "passive";

export interface PressureSpan {
  start: number;
  end: number;
  kind: FindingKind;
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
  { pattern: /\byou must\b/gi, why: "Compulsion. Offer the action instead of demanding it." },
  { pattern: /\bmust be\b/gi, why: "Compulsion. Say what happens, not what is compelled." },
  { pattern: /\byou need to\b/gi, why: "Reads as an order. 'You can' leaves the choice with Alex." },
  { pattern: /\byou have to\b/gi, why: "Reads as an order." },
  { pattern: /\brequired to\b/gi, why: "Procedural compulsion." },
  { pattern: /\bimmediately\b/gi, why: "Manufactured urgency. There is no same-day deadline here." },
  { pattern: /\bright away\b/gi, why: "Manufactured urgency." },
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
  { pattern: /\byou (failed|neglected|ignored)\b/gi, why: "Direct blame. Alex already knows." },
  { pattern: /\byou (did not|didn't|have not|haven't)\b/gi, why: "Frames the gap as a personal failing." },
  { pattern: /\byou were supposed to\b/gi, why: "Scolding." },
  { pattern: /\byour responsibility\b/gi, why: "Assigns fault rather than offering help." },
  { pattern: /\bwe('ve| have) (tried|attempted|made)\b/gi, why: "Three unopened emails means the channel failed, not Alex." },
  { pattern: /\b(repeatedly|numerous|several) (attempts|times|notices)\b/gi, why: "Counting past contacts is a reprimand." },
  { pattern: /\bonce again\b/gi, why: "Implies a pattern of fault." },
  { pattern: /\bstill (has not|hasn't|have not|haven't)\b/gi, why: "Emphasises the lapse." },
];

/** Consequence language. Occasionally necessary; never a first contact. */
const THREAT: LexEntry[] = [
  { pattern: /\blegal action\b/gi, why: "Escalation. Not proportionate to $41." },
  { pattern: /\b(reported|report) to\b/gi, why: "Credit-reporting threat. Nothing is reportable before 30 days." },
  { pattern: /\b(affect|impact|damage|hurt) your credit\b/gi, why: "Fear framing." },
  { pattern: /\bconsequences\b/gi, why: "Vague threat, which is worse than a specific one." },
  { pattern: /\bto avoid\b/gi, why: "Frames the action as escaping a punishment." },
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
  { pattern: /\boutstanding (obligation|balance)\b/gi, why: "Say what is owed, in dollars." },
  { pattern: /\bAPR\b/g, why: "Needs a gloss: the yearly cost of carrying a balance." },
];

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
};

const LEXICONS: { kind: FindingKind; entries: LexEntry[] }[] = [
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
    advice: "Safe to send. This reads the way Alex asked to be spoken to.",
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

/**
 * Score a draft message. Pure, synchronous and fast enough to run on every
 * keystroke, which is the point: the feedback has to arrive while the agent
 * is still writing the sentence, not after they have sent it.
 */
export function analysePressure(text: string): PressureReport {
  const spans: PressureSpan[] = [];
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
      return `${count} sentence${count === 1 ? "" : "s"} over ${LONG_SENTENCE_WORDS} words. Alex reads one idea at a time.`;
    case "grade":
      return `Reads at grade ${readability.grade}. The target is 8 or below.`;
    case "multiple-asks":
      return "Asking for more than one thing forces a decision about which to do first.";
    case "passive":
      return `Passive voice hides who acts${examples.length ? ` — “${examples[0]}”` : ""}.`;
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
      if (WEIGHTS[span.kind].each > WEIGHTS[prev.kind].each) out[out.length - 1] = span;
      continue;
    }
    out.push(span);
  }
  return out;
}

/* ------------------------------------------------------------- rewrite --- */

/** Phrase-level substitutions. Conservative: meaning must survive intact. */
const SUBSTITUTIONS: [RegExp, string][] = [
  // Must not reintroduce "reported to" — the threat lexicon catches it, and
  // the rewriter would then flag its own output.
  [/\bfailure to do so will be reported to the credit bureaus?\b/gi, "nothing goes on your credit file before 30 days"],
  [/\bwill be reported to the credit bureaus?\b/gi, "goes on your credit file after 30 days"],
  [/\byou must pay\b/gi, "you can pay"],
  [/\byou need to pay\b/gi, "you can pay"],
  [/\byou have to pay\b/gi, "you can pay"],
  [/\byou must\b/gi, "you can"],
  [/\byou need to\b/gi, "you can"],
  [/\byou have to\b/gi, "you can"],
  [/\bimmediately\b/gi, "whenever you're ready"],
  [/\bright away\b/gi, "whenever you're ready"],
  [/\bas soon as possible\b/gi, "whenever you're ready"],
  [/\bto avoid collections?\b/gi, ""],
  [/\bto avoid further action\b/gi, ""],
  [/\bfinal (notice|demand|reminder)\b/gi, "a quick note"],
  [/\b(is|was) delinquent\b/gi, "is behind"],
  [/\bdelinquent\b/gi, "past its date"],
  [/\bdelinquency\b/gi, "the missed payment"],
  [/\bin arrears\b/gi, "behind"],
  [/\bremittance\b/gi, "payment"],
  [/\boutstanding balance\b/gi, "balance"],
  [/\bfailure to\b/gi, "if you don't"],
  [/\bwe('ve| have) (tried|attempted) to (reach|contact) you( several times| repeatedly| numerous times)?\b/gi,
    "I wanted to check in"],
  [/\byou (failed|neglected) to (make|pay|send|submit)\b/gi, "we didn't receive"],
  [/\burgent(ly)?\b/gi, ""],
  [/\bact now\b/gi, "whenever suits you"],
];

export interface RewriteContext {
  amount?: string;
  agentName?: string;
}

export interface RewriteResult {
  text: string;
  /** Score of the rewritten text, so the improvement is visible. */
  report: PressureReport;
  /** True when substitutions were not enough and a template was used. */
  usedTemplate: boolean;
}

/**
 * Local rewrite.
 *
 * Two stages: targeted phrase substitution, then — only if the result is
 * still applying pressure — a known-good template. The template is a real
 * fallback rather than a hidden default: the UI says which one was used, and
 * the Claude path replaces this with a bespoke rewrite when a key is present.
 */
export function rewriteLocally(text: string, ctx: RewriteContext = {}): RewriteResult {
  let out = text;
  for (const [pattern, replacement] of SUBSTITUTIONS) {
    pattern.lastIndex = 0;
    out = out.replace(pattern, replacement);
  }

  out = tidy(out);
  out = splitLongSentences(out);

  let report = analysePressure(out);
  let usedTemplate = false;

  if (report.score >= 40) {
    out = template(ctx);
    report = analysePressure(out);
    usedTemplate = true;
  }

  return { text: out, report, usedTemplate };
}

function template(ctx: RewriteContext): string {
  const amount = ctx.amount ?? "the minimum";
  return [
    `Hi Alex — it's ${ctx.agentName ?? "your support team"} at Capital One. Nothing's wrong, and you don't need to reply.`,
    `There's ${amount} sitting on your card. That's the whole of it.`,
    `There's one button at the top of the app that handles it, whenever you're ready.`,
    `If that amount doesn't work this month, tell me and I'll move the date. No explanation needed.`,
  ].join(" ");
}

/** Repair the spacing and capitalisation that substitutions leave behind. */
function tidy(text: string): string {
  return text
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,!?;:])/g, "$1")
    .replace(/([.!?])\s*([a-z])/g, (_m, p: string, c: string) => `${p} ${c.toUpperCase()}`)
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
    .replace(/([.!?])\s*([a-z])/g, (_m, p: string, c: string) => `${p} ${c.toUpperCase()}`);
}
