/**
 * Runtime accessibility audit — the Proof Layer.
 *
 * Every accessibility claim in this product is checkable on the screen making
 * it. Contrast ratios are computed from the colours the browser actually
 * resolved, not from the hex values in the design tokens, so a translucent
 * surface over another surface is composited exactly as the browser composites
 * it, and ancestor `opacity` is folded in too. Touch targets are measured from
 * real bounding boxes.
 *
 * Known limit, stated rather than hidden: only `background-color` is read, so
 * a gradient or image behind the text is not sampled — the walk falls through
 * to the opaque colour beneath it. Every gradient in this app is a decorative
 * wash below 0.1 alpha, so the error is small, but it is an error and the
 * panel should not imply otherwise.
 *
 * It is deliberately possible for this to report a failure. A proof panel
 * that can only ever say "pass" proves nothing — so everything it displays is
 * measured here, including the heading outline and live-region politeness,
 * which it used to assert on the strength of a non-zero count.
 */

export interface ContrastIssue {
  text: string;
  ratio: number;
  required: number;
  foreground: string;
  background: string;
  fontPx: number;
  bold: boolean;
}

export interface TargetIssue {
  label: string;
  width: number;
  height: number;
}

export interface A11yReport {
  contrast: {
    checked: number;
    passing: number;
    worst: number;
    issues: ContrastIssue[];
  };
  targets: {
    checked: number;
    passing: number;
    smallest: number;
    issues: TargetIssue[];
  };
  reducedMotion: boolean;
  /** Headings found, to show the document outline is real. */
  headings: { level: number; text: string }[];
  /**
   * True when the outline never skips a level going down (h1 → h3). Measured,
   * not assumed: the panel used to print "in order" beside a bare count.
   */
  outlineOk: boolean;
  /** The first skip found, for the panel to name. */
  outlineProblem: string | null;
  liveRegions: { total: number; assertive: number };
}

/** WCAG AA: 3:1 for large text (>=24px, or >=18.66px bold), else 4.5:1. */
function requiredRatio(fontPx: number, bold: boolean): number {
  const isLarge = fontPx >= 24 || (bold && fontPx >= 18.66);
  return isLarge ? 3 : 4.5;
}

export function auditAccessibility(root: HTMLElement | null): A11yReport {
  const empty: A11yReport = {
    contrast: { checked: 0, passing: 0, worst: 21, issues: [] },
    targets: { checked: 0, passing: 0, smallest: Infinity, issues: [] },
    reducedMotion: false,
    headings: [],
    outlineOk: true,
    outlineProblem: null,
    liveRegions: { total: 0, assertive: 0 },
  };
  if (!root || typeof window === "undefined") return empty;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------ contrast */
  const contrastIssues: ContrastIssue[] = [];
  let checked = 0;
  let passing = 0;
  let worst = 21;

  const textEls = Array.from(root.querySelectorAll<HTMLElement>("*")).filter((el) => {
    if (el.closest("[data-a11y-ignore]")) return false;
    if (el.closest(".sr-only, .sr-only-focusable")) return false;
    /*
      Two exemptions WCAG 1.4.3 states outright, both of which this audit has
      to honour or it reports failures that are not failures.

      `aria-hidden` content is not shown to assistive tech and carries no
      information — the breathing status dot is a pulse beside a label that
      already says the thing. Measuring it flags the animation's own midpoint.

      "Inactive user interface components" are exempt too. A disabled button is
      dimmed *to communicate that it is disabled*; demanding 4.5:1 of it would
      mean removing the only visual signal that it cannot be pressed.
    */
    if (el.closest('[aria-hidden="true"]')) return false;
    if (el.closest(":disabled, [aria-disabled='true']")) return false;
    // Only elements that directly own visible text.
    const own = Array.from(el.childNodes).some(
      (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim(),
    );
    if (!own) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    const style = window.getComputedStyle(el);
    return style.visibility !== "hidden" && style.display !== "none";
  });

  for (const el of textEls) {
    const style = window.getComputedStyle(el);
    const fg = parseColor(style.color);
    if (!fg || fg[3] === 0) continue;
    const bg = resolveBackground(el);
    if (!bg) continue;

    /*
      `opacity` on this element or any ancestor multiplies what actually
      reaches the eye, and it is a separate property from the alpha in
      `color`. Ignoring it is how a contrast checker reports a pass that the
      screen does not deliver, so fold the accumulated factor into the
      foreground alpha before compositing.
    */
    const alpha = fg[3] * inheritedOpacity(el);
    if (alpha <= 0) continue;
    const composited = composite([fg[0], fg[1], fg[2], alpha], bg);
    const ratio = contrastRatio(composited, bg);
    const fontPx = parseFloat(style.fontSize) || 16;
    const weight = parseInt(style.fontWeight, 10) || 400;
    const required = requiredRatio(fontPx, weight >= 700);

    checked += 1;
    worst = Math.min(worst, ratio);
    if (ratio >= required) {
      passing += 1;
    } else {
      contrastIssues.push({
        text: (el.textContent ?? "").trim().slice(0, 60),
        ratio: Math.round(ratio * 100) / 100,
        required,
        foreground: style.color,
        background: `rgb(${bg[0]}, ${bg[1]}, ${bg[2]})`,
        fontPx: Math.round(fontPx),
        bold: weight >= 700,
      });
    }
  }

  /* ------------------------------------------------------------- targets */
  const targetIssues: TargetIssue[] = [];
  let tChecked = 0;
  let tPassing = 0;
  let smallest = Infinity;

  const interactive = Array.from(
    root.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [role="button"]'),
  ).filter((el) => {
    if (el.closest("[data-a11y-ignore]")) return false;
    if (el instanceof HTMLInputElement && el.type === "hidden") return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });

  for (const el of interactive) {
    const rect = effectiveTargetSize(el);
    const min = Math.min(rect.width, rect.height);
    tChecked += 1;
    smallest = Math.min(smallest, min);
    if (min >= 44) {
      tPassing += 1;
    } else {
      targetIssues.push({
        label:
          (el.getAttribute("aria-label") || el.textContent || el.tagName)
            .trim()
            .slice(0, 40) || el.tagName,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
    }
  }

  /* ------------------------------------------------------------ structure */
  const headings = Array.from(root.querySelectorAll<HTMLElement>("h1, h2, h3, h4"))
    .filter((el) => !el.closest("[data-a11y-ignore]"))
    .map((el) => ({
      level: Number(el.tagName.slice(1)),
      text: (el.textContent ?? "").trim().slice(0, 50),
    }));

  /*
    Walk the outline and find the first downward skip. Going back *up* any
    distance is legal — a new h2 after an h4 closes two sections — so only an
    increase of more than one level is a fault.
  */
  let outlineProblem: string | null = null;
  for (let i = 1; i < headings.length; i += 1) {
    const jump = headings[i].level - headings[i - 1].level;
    if (jump > 1) {
      outlineProblem = `h${headings[i - 1].level} → h${headings[i].level} at “${headings[i].text}”`;
      break;
    }
  }

  const liveNodes = Array.from(root.querySelectorAll("[aria-live]"));
  const liveRegions = {
    total: liveNodes.length,
    assertive: liveNodes.filter((el) => el.getAttribute("aria-live") === "assertive")
      .length,
  };

  return {
    contrast: {
      checked,
      passing,
      worst: Math.round(worst * 100) / 100,
      issues: contrastIssues.sort((a, b) => a.ratio - b.ratio).slice(0, 6),
    },
    targets: {
      checked: tChecked,
      passing: tPassing,
      smallest: smallest === Infinity ? 0 : Math.round(smallest),
      issues: targetIssues.slice(0, 6),
    },
    reducedMotion,
    headings,
    outlineOk: outlineProblem === null,
    outlineProblem,
    liveRegions,
  };
}

/**
 * The box a finger actually has to hit.
 *
 * A 16px radio inside a 44px-tall `<label>` is a 44px target, because the
 * label activates the control. Measuring the input alone would report a
 * failure that does not exist for the person using it — and a proof panel
 * that cries wolf gets ignored, which is worse than not having one.
 *
 * Measured with `offsetWidth`/`offsetHeight` rather than
 * `getBoundingClientRect`, because the rect includes CSS transforms and the
 * layout box does not. Screens here animate in from `scale: 0.98`, which
 * renders every 44px control 43.1px wide for a quarter of a second — long
 * enough for the panel to catch one and report eight failures that correct
 * themselves before anyone can look. The size of a control is a property of
 * its layout, not of whichever frame of a transition we sampled.
 */
function effectiveTargetSize(el: HTMLElement): { width: number; height: number } {
  const own = { width: el.offsetWidth, height: el.offsetHeight };
  const label = el.closest("label");
  if (!label) return own;

  // Only count the label if it is the control's own clickable wrapper.
  const controls = label.querySelectorAll("input, select, textarea, button");
  if (controls.length !== 1) return own;

  const wrapper = { width: label.offsetWidth, height: label.offsetHeight };
  return Math.min(wrapper.width, wrapper.height) > Math.min(own.width, own.height)
    ? wrapper
    : own;
}

/* ------------------------------------------------------------- colour ---- */

type RGBA = [number, number, number, number];

function parseColor(value: string): RGBA | null {
  const m = value.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return null;
  return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
}

/**
 * The product of the *settled* `opacity` on this element and every ancestor.
 *
 * A single `opacity: 0.6` wrapper quietly costs 40% of the contrast of
 * everything inside it, and nothing in the computed `color` of the text
 * reflects that — so it has to be folded in.
 *
 * "Settled" is the whole difficulty. A fade-in passes through every value
 * between 0 and 1, and a panel that reports whichever frame it happened to
 * catch is worse than one that ignores opacity altogether: it fails at random
 * and gets dismissed. Two sources are therefore read as 1:
 *
 *  · an inline `style.opacity`, which is how animation libraries drive a fade
 *    (Framer Motion writes one on every animated element here) — a design
 *    decision to dim something is written as a class or a rule, not inline;
 *  · any element with a running animation, which covers CSS keyframes such as
 *    the breathing status dot.
 *
 * What survives is static dimming — the case worth catching.
 */
function inheritedOpacity(el: HTMLElement): number {
  let factor = 1;
  let node: HTMLElement | null = el;
  while (node) {
    const animating =
      node.style.opacity !== "" ||
      (typeof node.getAnimations === "function" && node.getAnimations().length > 0);
    if (!animating) {
      const value = parseFloat(window.getComputedStyle(node).opacity);
      if (!Number.isNaN(value) && value < 1) factor *= value;
    }
    node = node.parentElement;
  }
  return factor;
}

/**
 * Walk up compositing every translucent background until an opaque one is
 * found. This is what makes layered surfaces measurable: their alpha is
 * blended exactly as the browser blends it.
 *
 * Only `background-color` is read — see the note at the top of the file about
 * gradients.
 */
function resolveBackground(el: HTMLElement): RGBA | null {
  const layers: RGBA[] = [];
  let node: HTMLElement | null = el;

  while (node) {
    const bg = parseColor(window.getComputedStyle(node).backgroundColor);
    if (bg && bg[3] > 0) {
      layers.push(bg);
      if (bg[3] >= 1) break;
    }
    node = node.parentElement;
  }

  if (layers.length === 0) return [246, 247, 248, 1]; // --color-void

  // Bottom-most layer first, then composite upward.
  let base: RGBA = layers[layers.length - 1];
  if (base[3] < 1) base = composite(base, [246, 247, 248, 1]);
  for (let i = layers.length - 2; i >= 0; i -= 1) {
    base = composite(layers[i], base);
  }
  return base;
}

function composite(fg: RGBA, bg: RGBA): RGBA {
  const a = fg[3];
  return [
    Math.round(fg[0] * a + bg[0] * (1 - a)),
    Math.round(fg[1] * a + bg[1] * (1 - a)),
    Math.round(fg[2] * a + bg[2] * (1 - a)),
    1,
  ];
}

function relativeLuminance([r, g, b]: RGBA): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: RGBA, b: RGBA): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const light = Math.max(la, lb);
  const dark = Math.min(la, lb);
  return (light + 0.05) / (dark + 0.05);
}
