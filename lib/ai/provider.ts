import type { FindingKind } from "@/lib/engines/pressure";
import type { AdvocateFacts } from "@/lib/advocate";
import type { CoachCustomer } from "./prompt";

/**
 * The seam between this product and whichever model is behind it.
 *
 * Nothing from a vendor SDK crosses this file — no message shapes, no block
 * types, no error classes. A provider takes domain values and returns domain
 * values, so swapping one for another is a new file in `providers/` rather
 * than an edit to five routes and nine components.
 *
 * Two rules hold for every method here, and they are what make the product
 * work without a key at all:
 *
 *  1. **`null` means "no answer".** Not configured, rate limited, refused,
 *     timed out, malformed — every one of them returns `null`, and the caller
 *     falls back to the deterministic engine it already ran. A provider never
 *     throws at its callers.
 *  2. **The model never decides anything.** It writes and it judges wording.
 *     Every figure, date and entitlement in the output comes from state the
 *     caller validated first, and the caller is free to discard the result.
 */
export interface AiProvider {
  /** Shown in the UI as provenance, never as a brand badge. */
  readonly name: string;

  /** False when no credentials are configured. Routes answer 503. */
  available(): boolean;

  /** A second opinion on a draft message's pressure. Spans are located by the caller. */
  analysePressure(input: AnalyseInput): Promise<AnalysisDraft | null>;

  /** Rewrite a draft so it says the same true thing without the pressure. */
  rewrite(input: RewriteInput): Promise<string | null>;

  /** Draft a support request from facts the customer chose to share. */
  draftAdvocate(facts: AdvocateFacts): Promise<AdvocateDraft | null>;

  /** Explain one thing on the customer's own screen, in plain words. */
  explain(input: ExplainInput): Promise<ExplainDraft | null>;

  /** Write the agent's script for the situation the account is actually in. */
  agentScript(input: ScriptInput): Promise<ScriptDraft | null>;
}

/* ----------------------------------------------------------- analysis ---- */

export interface AnalyseInput {
  text: string;
  /** Compliance wording that must not be scored or flagged. */
  locked: string[];
  customer: CoachCustomer;
}

/**
 * Deliberately no character offsets. Models are unreliable at counting
 * characters, so the model names the phrase and the server finds it — which
 * keeps the highlighting correct even when the model's idea of position is not.
 */
export interface AnalysisDraft {
  score: number;
  findings: { kind: FindingKind; phrase: string; why: string }[];
}

/* ------------------------------------------------------------ rewrite ---- */

export interface RewriteInput {
  text: string;
  amount?: string;
  agentName?: string;
  firstName?: string;
  payBy?: string;
  locked: string[];
  tone: "calm" | "warm" | "celebrate";
  goodNews: boolean;
  customer: CoachCustomer;
}

/* ----------------------------------------------------------- advocate ---- */

export interface AdvocateDraft {
  message: string;
  summary: string;
}

/* ------------------------------------------------------------ explain ---- */

/**
 * What the customer asked about, and the facts needed to answer it.
 *
 * Note what is *not* here: nothing from `lib/device.ts`. Reading preferences,
 * Safe Mode, interaction strain and the rest stay on the phone, so the
 * explainer is told to write plainly for everyone and the device applies the
 * customer's own typeface, size and tint locally. The README's "stored on the
 * phone only" has to stay literally true.
 */
export interface ExplainInput {
  /** What is being explained, in the customer's words where possible. */
  subject: string;
  /** Validated figures and dates, already formatted for display. */
  facts: { label: string; value: string }[];
  /** The customer's first name, for a human sentence. */
  firstName: string;
}

export interface ExplainDraft {
  /** One short sentence answering "what is this?". */
  headline: string;
  /** Two or three plain lines. Each stands alone. */
  plainWords: string[];
  /** Options, never instructions. May be empty when there is nothing to do. */
  whatYouCouldDo: string[];
}

/* ------------------------------------------------------------- script ---- */

export interface ScriptInput {
  /** A plain-language brief of the account, built by the caller from state. */
  situation: string;
  firstName: string;
  facts: { label: string; value: string }[];
  /** The customer's stated contact preferences, as shared with support. */
  preferences: string[];
}

export interface ScriptDraft {
  situation: string;
  opener: string;
  lines: string[];
  avoid: { phrase: string; why: string }[];
  nextStep: string;
}
