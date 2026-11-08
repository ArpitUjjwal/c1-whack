"use client";

/**
 * Browser-side coaching client.
 *
 * Two engines, deliberately layered:
 *
 *  · The **local** engine (`lib/engines/pressure.ts`) is synchronous and runs
 *    on every keystroke. It is the default, not a fallback — feedback has to
 *    arrive while the agent is still writing the sentence.
 *  · The **Claude** pass runs server-side on a typing pause, adds nuance the
 *    lexicon cannot see, and writes a bespoke rewrite.
 *
 * Every remote call degrades silently to the local result. A missing API key,
 * a rate limit, a dropped connection and an outright 500 all look the same
 * from here: the agent keeps a working tool. Nothing in this product can fail
 * in a way that stops the demo.
 */

import {
  analysePressure,
  rewriteLocally,
  type PressureReport,
  type RewriteContext,
  type RewriteResult,
} from "../engines/pressure";
import { draftLocally, type AdvocateFacts } from "../advocate";

export interface CoachAvailability {
  claude: boolean;
  checked: boolean;
}

let availability: CoachAvailability = { claude: false, checked: false };

/** Ask the server once whether a key is configured. */
export async function checkCoachAvailability(): Promise<CoachAvailability> {
  if (availability.checked) return availability;
  try {
    const res = await fetch("/api/coach/analyze", { method: "GET" });
    if (res.ok) {
      const body = (await res.json()) as { claude?: boolean };
      availability = { claude: Boolean(body.claude), checked: true };
    } else {
      availability = { claude: false, checked: true };
    }
  } catch {
    availability = { claude: false, checked: true };
  }
  return availability;
}

/** Instant, synchronous scoring. Always available. */
export function analyseNow(text: string, locked: string[] = []): PressureReport {
  return analysePressure(text, { locked });
}

/**
 * The deeper pass. Resolves to `null` when Claude is not configured or the
 * call fails, and the caller keeps whatever the local engine already gave it.
 */
export async function deepAnalyse(
  text: string,
  locked: string[] = [],
  signal?: AbortSignal,
): Promise<PressureReport | null> {
  if (!text.trim()) return null;
  try {
    const res = await fetch("/api/coach/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, locked }),
      signal,
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { report?: PressureReport };
    return body.report ?? null;
  } catch {
    return null;
  }
}

/**
 * Rewrite. Tries Claude, falls back to the local rewriter, and always returns
 * something usable. The result says which engine produced it so the UI never
 * misrepresents its own provenance.
 */
export async function rewrite(
  text: string,
  ctx: RewriteContext,
  signal?: AbortSignal,
): Promise<RewriteResult & { source: "local" | "claude" }> {
  try {
    const res = await fetch("/api/coach/rewrite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, context: ctx }),
      signal,
    });
    if (res.ok) {
      const body = (await res.json()) as { text?: string };
      if (body.text?.trim()) {
        // Score Claude's output with the same local engine the agent has been
        // watching, so the before/after comparison stays like-for-like.
        const report = analysePressure(body.text);
        return {
          text: body.text,
          report: { ...report, source: "claude" },
          usedTemplate: false,
          source: "claude",
        };
      }
    }
  } catch {
    /* fall through to local */
  }

  const local = rewriteLocally(text, ctx);
  return { ...local, source: "local" };
}

/**
 * Draft a support request. Tries Claude with validated facts only, falls back
 * to the deterministic local draft, and says which one it used.
 */
export async function draftSupportRequest(
  facts: AdvocateFacts,
): Promise<{ message: string; summary: string; source: "local" | "claude" }> {
  try {
    const res = await fetch("/api/advocate/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facts }),
    });
    if (res.ok) {
      const body = (await res.json()) as { message?: string; summary?: string };
      if (body.message?.trim() && body.summary?.trim()) {
        return { message: body.message.trim(), summary: body.summary.trim(), source: "claude" };
      }
    }
  } catch {
    /* fall through to local */
  }
  return { ...draftLocally(facts), source: "local" };
}
