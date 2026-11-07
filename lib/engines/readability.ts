/**
 * Readability measurement.
 *
 * Shared by the Pressure Index (how hard is this message to read?) and the
 * Proof Layer (what grade level is actually on screen right now?). Plain
 * language is the first thing Alex asked for, so it needs to be a number
 * somebody can check rather than a claim in a design doc.
 *
 * Flesch–Kincaid is a crude instrument — it counts syllables, not meaning —
 * and the UI says so. It is still the right tool here: it is standard, it is
 * cheap, and it moves in the right direction when prose gets worse.
 */

export interface ReadabilityStats {
  words: number;
  sentences: number;
  syllables: number;
  /** Flesch–Kincaid grade level. ~8 is the plain-language target. */
  grade: number;
  /** Flesch reading ease, 0–100. Higher is easier. */
  ease: number;
  averageWordsPerSentence: number;
  /** Sentences over the long-sentence threshold, with their word counts. */
  longSentences: { text: string; words: number }[];
}

/** Sentences longer than this are hard to hold in working memory. */
export const LONG_SENTENCE_WORDS = 20;

const VOWELS = "aeiouy";

/**
 * Syllable estimate. Counts vowel groups, drops a silent trailing "e", and
 * floors at one. Wrong on a handful of words, consistent across all of them.
 */
export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length === 0) return 0;
  if (w.length <= 3) return 1;

  let count = 0;
  let prevWasVowel = false;
  for (const ch of w) {
    const isVowel = VOWELS.includes(ch);
    if (isVowel && !prevWasVowel) count += 1;
    prevWasVowel = isVowel;
  }
  // Silent "e", but never "le" (as in "table"), which is its own syllable.
  if (w.endsWith("e") && !w.endsWith("le") && count > 1) count -= 1;
  return Math.max(1, count);
}

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function splitWords(text: string): string[] {
  return text.split(/\s+/).filter((w) => /[a-z0-9]/i.test(w));
}

export function analyseReadability(text: string): ReadabilityStats {
  const sentenceTexts = splitSentences(text);
  const words = splitWords(text);
  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);

  const sentenceCount = Math.max(1, sentenceTexts.length);
  const wordCount = words.length;

  if (wordCount === 0) {
    return {
      words: 0,
      sentences: 0,
      syllables: 0,
      grade: 0,
      ease: 100,
      averageWordsPerSentence: 0,
      longSentences: [],
    };
  }

  const wps = wordCount / sentenceCount;
  const spw = syllables / wordCount;

  const grade = 0.39 * wps + 11.8 * spw - 15.59;
  const ease = 206.835 - 1.015 * wps - 84.6 * spw;

  const longSentences = sentenceTexts
    .map((s) => ({ text: s, words: splitWords(s).length }))
    .filter((s) => s.words > LONG_SENTENCE_WORDS);

  return {
    words: wordCount,
    sentences: sentenceTexts.length,
    syllables,
    grade: round1(Math.max(0, grade)),
    ease: round1(Math.max(0, Math.min(100, ease))),
    averageWordsPerSentence: round1(wps),
    longSentences,
  };
}

/** Plain-language verdict for a grade level, for people who don't read F–K. */
export function gradeVerdict(grade: number): {
  label: string;
  tone: "pos" | "attn" | "red";
} {
  if (grade <= 8) return { label: "Plain language", tone: "pos" };
  if (grade <= 11) return { label: "Harder than it needs to be", tone: "attn" };
  return { label: "Too dense", tone: "red" };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
