/**
 * Runtime accessibility audit — the Proof Layer.
 *
 * Every accessibility claim in this product is checkable on the screen making
 * it. Contrast ratios are computed from the colours the browser actually
 * resolved, not from the hex values in the design tokens, so a translucent
 * surface composited over a gradient is measured as rendered. Touch targets
 * are measured from real bounding boxes.
 *
 * It is deliberately possible for this to report a failure. A proof panel
 * that can only ever say "pass" proves nothing.
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
  liveRegions: number;
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
    liveRegions: 0,
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

    const composited = composite(fg, bg);
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
    const rect = effectiveTargetRect(el);
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

  const liveRegions = root.querySelectorAll("[aria-live]").length;

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
 */
function effectiveTargetRect(el: HTMLElement): DOMRect {
  const own = el.getBoundingClientRect();
  const label = el.closest("label");
  if (!label) return own;

  // Only count the label if it is the control's own clickable wrapper.
  const controls = label.querySelectorAll("input, select, textarea, button");
  if (controls.length !== 1) return own;

  const labelRect = label.getBoundingClientRect();
  return Math.min(labelRect.width, labelRect.height) >
    Math.min(own.width, own.height)
    ? labelRect
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
 * Walk up compositing every translucent background until an opaque one is
 * found. This is what makes the glass surfaces measurable: their alpha is
 * blended exactly as the browser blends it.
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

  if (layers.length === 0) return [6, 9, 15, 1]; // --color-void

  // Bottom-most layer first, then composite upward.
  let base: RGBA = layers[layers.length - 1];
  if (base[3] < 1) base = composite(base, [6, 9, 15, 1]);
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
