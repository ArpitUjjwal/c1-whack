/**
 * Cognitive load measurement.
 *
 * Scores how much executive function the screen currently in front of the
 * customer is demanding. The formula is deliberately simple and is printed in
 * the UI beside its own result, because the point is not that the number is
 * precise — it is that the app is willing to be measured at all.
 *
 *   load = 3·(committing actions)
 *        + 1·(every interactive element)
 *        + 1.5·(distinct numbers on screen)
 *        + (words / 25)
 *        + 2·(reading grade above 8)
 *
 * Weights follow from what costs working memory: an irreversible decision
 * costs most, an available option costs something, a number has to be held
 * and compared, prose has to be read, and dense prose has to be re-read.
 *
 * Measured from the live DOM, so it reflects what is actually rendered rather
 * than what the code intended to render.
 */

import { analyseReadability } from "./readability";

export interface LoadContribution {
  label: string;
  count: number;
  points: number;
}

export interface LoadBreakdown {
  score: number;
  band: LoadBand;
  contributions: LoadContribution[];
  grade: number;
  words: number;
}

export type LoadBand = "light" | "moderate" | "heavy" | "overloading";

/** Safe Mode has to get the screen under this. */
export const FOCUS_TARGET = 25;

/**
 * The home screen's measured load before and after Safe Mode, as quoted in
 * the README, ACCESSIBILITY.md, the simulation and the demo. One pair, in one
 * place, so the pitch cannot disagree with itself. Re-measure with the `?`
 * overlay whenever the home screen changes.
 */
export const FOCUS_LOAD_BEFORE = 29;
export const FOCUS_LOAD_AFTER = 19;

const FOCUSABLE =
  'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"]), [role="button"]';

export function bandForLoad(score: number): LoadBand {
  if (score <= 20) return "light";
  if (score <= 40) return "moderate";
  if (score <= 65) return "heavy";
  return "overloading";
}

export const LOAD_BAND_COPY: Record<
  LoadBand,
  { label: string; tone: "pos" | "attn" | "red" }
> = {
  light: { label: "Light", tone: "pos" },
  moderate: { label: "Moderate", tone: "pos" },
  heavy: { label: "Heavy", tone: "attn" },
  overloading: { label: "Overloading", tone: "red" },
};

/**
 * Measure a subtree. Anything marked `data-load-ignore` is skipped — the
 * demo chrome and the judge overlay are not part of the customer's screen and
 * must not inflate its score.
 */
export function measureLoad(root: HTMLElement | null): LoadBreakdown {
  if (!root) {
    return { score: 0, band: "light", contributions: [], grade: 0, words: 0 };
  }

  const ignored = new Set<Element>();
  root.querySelectorAll("[data-load-ignore]").forEach((el) => {
    ignored.add(el);
    el.querySelectorAll("*").forEach((child) => ignored.add(child));
  });

  const isCounted = (el: Element) => !ignored.has(el) && isVisible(el);

  const interactiveEls = Array.from(root.querySelectorAll(FOCUSABLE)).filter(isCounted);

  /*
    A commit is an action that changes something the customer cares about.
    Disclosures (`aria-expanded`) only reveal, navigation (`data-nav`) only
    moves, and neither carries the weight of a decision — so both are counted
    as options rather than commitments.
  */
  const commits = interactiveEls.filter(
    (el) =>
      !el.hasAttribute("aria-expanded") &&
      !el.hasAttribute("data-nav") &&
      (el.tagName === "BUTTON" || el.getAttribute("role") === "button"),
  );

  const text = visibleText(root, ignored);
  const readability = analyseReadability(text);

  // Distinct figures: a repeated number costs nothing extra to hold.
  const numberTokens = new Set(
    (text.match(/\$?\d[\d,]*(\.\d+)?%?/g) ?? []).map((t) => t.trim()),
  );

  const gradeOver = Math.max(0, readability.grade - 8);

  const contributions: LoadContribution[] = [
    { label: "Decisions you can commit to", count: commits.length, points: commits.length * 3 },
    { label: "Things you can interact with", count: interactiveEls.length, points: interactiveEls.length },
    { label: "Distinct numbers on screen", count: numberTokens.size, points: numberTokens.size * 1.5 },
    { label: "Words to read", count: readability.words, points: readability.words / 25 },
    { label: "Reading level above grade 8", count: Math.round(gradeOver * 10) / 10, points: gradeOver * 2 },
  ].filter((c) => c.points > 0);

  const raw = contributions.reduce((sum, c) => sum + c.points, 0);
  const score = Math.min(100, Math.round(raw));

  return {
    score,
    band: bandForLoad(score),
    contributions: contributions.map((c) => ({ ...c, points: Math.round(c.points * 10) / 10 })),
    grade: readability.grade,
    words: readability.words,
  };
}

function isVisible(el: Element): boolean {
  const rect = (el as HTMLElement).getBoundingClientRect?.();
  if (!rect) return false;
  if (rect.width === 0 && rect.height === 0) return false;
  const style = window.getComputedStyle(el);
  return style.visibility !== "hidden" && style.display !== "none" && style.opacity !== "0";
}

/** Text the customer can actually see, excluding ignored chrome and sr-only. */
function visibleText(root: HTMLElement, ignored: Set<Element>): string {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (ignored.has(parent)) return NodeFilter.FILTER_REJECT;
      if (parent.closest("[data-load-ignore]")) return NodeFilter.FILTER_REJECT;
      if (parent.closest(".sr-only, .sr-only-focusable")) return NodeFilter.FILTER_REJECT;
      if (!node.textContent?.trim()) return NodeFilter.FILTER_REJECT;
      if (!isVisible(parent)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const parts: string[] = [];
  let node = walker.nextNode();
  while (node) {
    parts.push(node.textContent!.trim());
    node = walker.nextNode();
  }
  return parts.join(" ");
}
