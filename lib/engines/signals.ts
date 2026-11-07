/**
 * Cognitive signal collection.
 *
 * Watches how the customer is interacting — not what they are doing, but how
 * hard they appear to be finding it — and derives a strain estimate that the
 * interface can respond to.
 *
 * Three rules this is built under:
 *
 *  1. Nothing identifying is collected. Timestamps of gesture *kinds*, in
 *     memory, in the tab. Nothing is persisted, and the strain reading never
 *     leaves the device: the agent console receives the screen's load and
 *     Focus Mode state, never this. (See `useCognitiveMonitor`.)
 *  2. Every signal decays. A moment of confusion two minutes ago is not
 *     evidence about now, so each window is short and rolling.
 *  3. The output is advisory. It can offer to simplify the screen; it can
 *     never take an action on the customer's behalf.
 */

export type StrainBand = "calm" | "strained" | "overloaded";

export interface StrainContribution {
  label: string;
  points: number;
  detail: string;
}

export interface StrainReading {
  score: number;
  band: StrainBand;
  contributions: StrainContribution[];
}

/** Strain at or above this offers Focus Mode. */
export const FOCUS_OFFER_THRESHOLD = 45;

/** Rolling windows, in milliseconds. */
const WINDOWS = {
  scrollReversal: 12_000,
  deadTap: 20_000,
  churn: 30_000,
} as const;

export interface SignalContext {
  /** Days since the previous session — a standing avoidance signal. */
  daysSinceLastOpen: number;
  /** Local hour, 0–23. Passed in rather than read, to keep this pure. */
  hour: number;
}

/**
 * Collects raw events. Lives outside React (it is driven by DOM listeners)
 * and is read on a timer, so nothing here runs during render.
 */
export class SignalCollector {
  private scrollReversals: number[] = [];
  private deadTaps: number[] = [];
  private churn: number[] = [];
  private lastInteractionAt = 0;
  private lastScrollTop = 0;
  private lastScrollDir: 1 | -1 | 0 = 0;

  /** Call once when the surface mounts so idle is measured from arrival. */
  start(now: number): void {
    this.lastInteractionAt = now;
  }

  /** Any deliberate interaction resets the idle clock. */
  recordInteraction(now: number): void {
    this.lastInteractionAt = now;
  }

  /**
   * A reversal is a scroll direction change. One or two is reading; a run of
   * them inside a few seconds is hunting for something that isn't findable.
   */
  recordScroll(scrollTop: number, now: number): void {
    const delta = scrollTop - this.lastScrollTop;
    if (Math.abs(delta) < 12) return;
    const dir: 1 | -1 = delta > 0 ? 1 : -1;
    if (this.lastScrollDir !== 0 && dir !== this.lastScrollDir) {
      this.scrollReversals.push(now);
    }
    this.lastScrollDir = dir;
    this.lastScrollTop = scrollTop;
  }

  /** A tap that hit nothing interactive — looking for a control that isn't there. */
  recordDeadTap(now: number): void {
    this.deadTaps.push(now);
  }

  /** Opening and closing disclosures repeatedly: searching, not reading. */
  recordDisclosureToggle(now: number): void {
    this.churn.push(now);
  }

  /** Used by the Demo Director to show the mechanism without hand-thrashing. */
  injectStrain(now: number): void {
    for (let i = 0; i < 6; i += 1) this.scrollReversals.push(now - i * 300);
    this.deadTaps.push(now - 400, now - 900);
  }

  reset(now: number): void {
    this.scrollReversals = [];
    this.deadTaps = [];
    this.churn = [];
    this.lastInteractionAt = now;
    this.lastScrollDir = 0;
  }

  read(now: number, ctx: SignalContext): StrainReading {
    this.scrollReversals = prune(this.scrollReversals, now, WINDOWS.scrollReversal);
    this.deadTaps = prune(this.deadTaps, now, WINDOWS.deadTap);
    this.churn = prune(this.churn, now, WINDOWS.churn);

    const contributions: StrainContribution[] = [];

    const thrash = Math.min(30, this.scrollReversals.length * 6);
    if (thrash > 0) {
      contributions.push({
        label: "Scrolling back and forth",
        points: thrash,
        detail: `${this.scrollReversals.length} direction changes in the last 12 seconds`,
      });
    }

    const taps = Math.min(20, this.deadTaps.length * 10);
    if (taps > 0) {
      contributions.push({
        label: "Taps that hit nothing",
        points: taps,
        detail: `${this.deadTaps.length} tap${this.deadTaps.length === 1 ? "" : "s"} on something that isn't a control`,
      });
    }

    const churn = Math.min(15, this.churn.length * 5);
    if (churn > 0) {
      contributions.push({
        label: "Opening and closing details",
        points: churn,
        detail: `${this.churn.length} toggles — looking for something specific`,
      });
    }

    const idleMs = now - this.lastInteractionAt;
    const idle = idleMs > 45_000 ? 25 : idleMs > 25_000 ? 15 : 0;
    if (idle > 0) {
      contributions.push({
        label: "Stalled on the screen",
        points: idle,
        detail: `${Math.round(idleMs / 1000)}s without acting on anything`,
      });
    }

    if (ctx.hour >= 23 || ctx.hour < 5) {
      contributions.push({
        label: "Late-night session",
        points: 10,
        detail: "Money tasks after 11pm correlate with avoidance and worse decisions",
      });
    }

    if (ctx.daysSinceLastOpen >= 7) {
      contributions.push({
        label: "Returning after a long gap",
        points: 10,
        detail: `${ctx.daysSinceLastOpen} days since the last session`,
      });
    }

    const score = Math.min(100, Math.round(contributions.reduce((s, c) => s + c.points, 0)));

    return {
      score,
      band: score >= FOCUS_OFFER_THRESHOLD ? "overloaded" : score >= 25 ? "strained" : "calm",
      contributions,
    };
  }
}

function prune(stamps: number[], now: number, window: number): number[] {
  return stamps.filter((t) => now - t <= window);
}
