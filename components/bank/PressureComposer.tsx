"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Meter } from "@/components/ui/Meter";
import { Panel } from "@/components/ui/Panel";
import { StatusPill } from "@/components/ui/StatusPill";
import { analyseNow, checkCoachAvailability, deepAnalyse, rewrite } from "@/lib/ai/client";
import { useRealtimeSync } from "@/lib/realtime";
import {
  BAND_COPY,
  type PressureReport,
  type PressureSpan,
  type SpanKind,
} from "@/lib/engines/pressure";
import { LOCKED_SEGMENTS, payByDate } from "@/lib/compliance";
import { DETECTED_LABEL, checkTone } from "@/lib/engines/sentiment";
import { FREQUENCY_EVIDENCE, checkContact, ordinal } from "@/lib/contact";
import { money } from "@/lib/format";
import type { AppState, Tone } from "@/lib/types";

/**
 * The Pressure Index composer.
 *
 * Nothing reaches the customer from this console without passing through
 * here, and the score updates while the agent types rather than after they
 * send. That ordering is the whole idea: an agent who can see a sentence
 * going wrong rewrites it; an agent told afterwards has already done the harm.
 *
 * Red is used here and in the logo, nowhere else in the product. It marks the
 * bank's own language — never the customer's money.
 *
 * Two guards sit beside the score. Locked segments carry compliance wording
 * (the dated credit-file line, the free debt-advice signpost): they are kept
 * outside the editable draft, so no rewrite — local or Claude — can reach
 * them, and they are appended verbatim on send. And the frequency guard says
 * which message this would be this week, against Alex's own limit.
 */

/** How long the agent must pause before the deeper Claude pass runs. */
const DEEP_DEBOUNCE_MS = 650;

const SPAN_STYLE: Record<SpanKind, string> = {
  urgency: "bg-attn/25 border-b-2 border-attn",
  shame: "bg-red/25 border-b-2 border-red-fg",
  threat: "bg-red/30 border-b-2 border-red-fg",
  jargon: "bg-link/20 border-b-2 border-link",
  consequence: "bg-attn/20 border-b-2 border-dashed border-attn",
  abuse: "bg-red/40 border-b-2 border-red-fg",
  shouting: "bg-attn/30 border-b-2 border-attn",
  allowed: "border-b-2 border-dotted border-pos",
  locked: "",
  "long-sentence": "",
  grade: "",
  "multiple-asks": "",
  passive: "",
};

export function PressureComposer({
  state,
  onSend,
  now,
}: {
  state: AppState;
  onSend: (title: string, body: string, tone: Tone) => void;
  /** Slow-ticking clock from the store; nothing here reads the time in render. */
  now: number;
}) {
  const [title, setTitle] = useState("");
  const [draft, setDraft] = useState("");
  const [pickedTone, setTone] = useState<Tone>("calm");
  const [deep, setDeep] = useState<{ text: string; report: PressureReport } | null>(
    null,
  );
  const [claudeAvailable, setClaudeAvailable] = useState(false);
  const [rewriting, setRewriting] = useState(false);
  /**
   * A Demo Director "send" that arrives while a rewrite is still running is
   * held and sent with the rewritten text, rather than hitting the old draft.
   */
  const pendingDirectorSend = useRef(false);
  /** Synchronous twin of `rewriting`: signals can arrive before a re-render. */
  const rewritingNow = useRef(false);
  const [lastRewrite, setLastRewrite] = useState<{
    from: number;
    to: number;
    source: "local" | "claude";
  } | null>(null);
  const [confirmHarmful, setConfirmHarmful] = useState(false);
  const [confirmContact, setConfirmContact] = useState(false);
  /** Ids of locked segments attached to this message, in the order added. */
  const [lockedIds, setLockedIds] = useState<string[]>([]);

  const payBy = payByDate(state.credit);
  const lockedTexts = useMemo(
    () =>
      lockedIds
        .map((id) => LOCKED_SEGMENTS.find((seg) => seg.id === id))
        .filter((seg): seg is (typeof LOCKED_SEGMENTS)[number] => Boolean(seg))
        .map((seg) => seg.text({ payBy })),
    [lockedIds, payBy],
  );
  /** What actually reaches Alex: the draft, then the locked wording verbatim. */
  const fullText = [draft.trim(), ...lockedTexts].filter(Boolean).join(" ");
  const contact = checkContact(state, now, new Date(now).getHours());

  /*
    The tone buttons label how a message looks on Alex's phone. This checks
    whether the words actually match the tone picked — and blocks insults
    outright, with no "send anyway".
  */
  const goodNews = state.credit.status === "current";
  /** Celebrate only exists while there's good news; otherwise Calm is in force. */
  const tone: Tone = pickedTone === "celebrate" && !goodNews ? "calm" : pickedTone;
  /** Only what the customer chose to share goes into a Claude brief. */
  const coachCustomer = useMemo(
    () => ({
      name: state.customer.name,
      firstName: state.customer.firstName,
      preferences: state.customer.cognitiveProfile,
      note: state.customer.supportNote,
      minimumDue: state.credit.minimumDue,
      daysOverdue: state.credit.daysOverdue,
    }),
    [state.customer, state.credit.minimumDue, state.credit.daysOverdue],
  );
  const [abuseRefused, setAbuseRefused] = useState(false);
  /**
   * The agent's own words from before the first rewrite. Changing tone
   * re-types from this, not from the previous rewrite, so each tone is a
   * fresh take on what the agent meant rather than a layer on top.
   */
  const [rewriteSource, setRewriteSource] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const { onSignal } = useRealtimeSync();

  /* Instant, synchronous, every keystroke. Scored as sent: draft + locked. */
  const localReport = useMemo(
    () => analyseNow(fullText, lockedTexts),
    [fullText, lockedTexts],
  );

  const toneCheck = useMemo(
    () =>
      checkTone(draft, tone, goodNews, localReport.band),
    [draft, tone, goodNews, localReport.band],
  );

  /*
    The report actually shown: Claude's, but only while it still describes the
    text on screen. Tying it to the draft means staleness is derived rather
    than cleared by a setState, so editing never shows a score for old text.
  */
  const report = deep && deep.text === fullText ? deep.report : localReport;
  const band = BAND_COPY[report.band];

  useEffect(() => {
    let cancelled = false;
    checkCoachAvailability().then((a) => {
      if (!cancelled) setClaudeAvailable(a.claude);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /* Deeper pass on a pause. Aborted whenever the text changes again. */
  useEffect(() => {
    if (!claudeAvailable || draft.trim().length < 12) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const result = await deepAnalyse(fullText, lockedTexts, controller.signal, coachCustomer);
      if (result) setDeep({ text: fullText, report: result });
    }, DEEP_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [fullText, lockedTexts, draft, claudeAvailable, coachCustomer]);

  /* Keep the highlight layer aligned with the textarea while it scrolls. */
  const syncScroll = useCallback(() => {
    if (mirrorRef.current && textareaRef.current) {
      mirrorRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  /**
   * Rewrite the draft in the picked tone. `toneOverride` lets a tone change
   * re-type an already-rewritten draft straight away.
   */
  const doRewrite = async (toneOverride?: Tone) => {
    if (!draft.trim()) return;
    rewritingNow.current = true;
    setRewriting(true);
    setAbuseRefused(false);
    const source = toneOverride && rewriteSource ? rewriteSource : draft;
    if (!rewriteSource || !toneOverride) setRewriteSource(source);
    const before = lastRewrite && toneOverride ? lastRewrite.from : report.score;
    // Only the free draft is rewritten. Locked wording never leaves this
    // component except verbatim, on send.
    const result = await rewrite(source, {
      amount: money(state.credit.minimumDue),
      agentName: state.agentName,
      firstName: state.customer.firstName,
      customer: coachCustomer,
      tone: toneOverride ?? tone,
      goodNews,
      payBy,
      locked: lockedTexts,
    });
    setDraft(result.text);
    // Score the rewrite as it will be sent — with the locked wording — so the
    // before/after comparison is like-for-like with the meter.
    const after = analyseNow(
      [result.text.trim(), ...lockedTexts].filter(Boolean).join(" "),
      lockedTexts,
    ).score;
    setLastRewrite({ from: before, to: after, source: result.source });
    rewritingNow.current = false;
    setRewriting(false);
    setConfirmHarmful(false);

    if (pendingDirectorSend.current) {
      pendingDirectorSend.current = false;
      const fullRewritten = [result.text.trim(), ...lockedTexts].filter(Boolean).join(" ");
      // Same guards as a normal send: never an insult, never a harmful score.
      if (after < 65 && !checkTone(result.text, tone, goodNews).abusive) {
        onSend(title.trim() || "A note from your support team", fullRewritten, tone);
        setTitle("");
        setDraft("");
        setLockedIds([]);
        setLastRewrite(null);
        setRewriteSource(null);
        setConfirmContact(false);
      }
    }
  };

  /**
   * `fromDirector` is the Demo Director's send. A presenter cannot double-
   * press a confirm mid-sentence, so it skips the contact-rule confirm — the
   * breach is still on screen, and the harmful-score confirm still applies.
   */
  const send = (fromDirector = false) => {
    if (fromDirector && rewritingNow.current) {
      pendingDirectorSend.current = true;
      return;
    }
    const t = title.trim() || "A note from your support team";
    if (!draft.trim()) return;
    // Insults never reach a customer, whoever presses the button.
    if (toneCheck.abusive) {
      setAbuseRefused(true);
      return;
    }
    if (report.band === "harmful" && !confirmHarmful) {
      setConfirmHarmful(true);
      return;
    }
    if (contact.breaches.length > 0 && !confirmContact && !fromDirector) {
      setConfirmContact(true);
      return;
    }
    onSend(t, fullText, tone);
    setTitle("");
    setDraft("");
    setLockedIds([]);
    setLastRewrite(null);
    setRewriteSource(null);
    setConfirmHarmful(false);
    setConfirmContact(false);
  };

  /*
    The Demo Director drives these three from a keypress. Handlers are kept in
    a ref so the subscription is set up once and still calls the current
    closure — re-subscribing on every keystroke would drop in-flight signals.
  */
  const handlersRef = useRef<{
    loadExample: (focusField?: boolean) => void;
    doRewrite: () => void;
    send: (fromDirector?: boolean) => void;
  }>({
    loadExample: () => {},
    doRewrite: () => {},
    send: () => {},
  });

  useEffect(() => {
    return onSignal((signal) => {
      if (signal.type !== "demo_action") return;
      if (signal.action === "load_bad_example") handlersRef.current.loadExample(false);
      if (signal.action === "rewrite_draft") handlersRef.current.doRewrite();
      if (signal.action === "send_draft") handlersRef.current.send(true);
    });
  }, [onSignal]);

  /**
   * `focusField` is false when the Demo Director loads this. Stealing focus
   * into the textarea would put the presenter's next arrow key into the text
   * field instead of the director, which stalls the demo mid-run.
   */
  const loadExample = (focusField = true) => {
    setTitle("Overdue payment");
    setDraft(
      "You must pay the full balance immediately to avoid collections. Failure to do so will be reported to the credit reference agencies.",
    );
    setLockedIds([]);
    setLastRewrite(null);
    setRewriteSource(null);
    setConfirmHarmful(false);
    setConfirmContact(false);
    if (focusField) textareaRef.current?.focus();
  };

  useEffect(() => {
    handlersRef.current = { loadExample, doRewrite, send };
  });

  return (
    <Panel
      bloom={report.band === "harmful" || report.band === "pressuring" ? "red" : "link"}
      className="p-5"
      aria-labelledby="composer-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="composer-heading" className="font-semibold text-fg">
          Message to {state.customer.firstName}
        </h2>
        <StatusPill tone={claudeAvailable ? "calm" : "neutral"}>
          {claudeAvailable ? "Local + Claude" : "Local engine"}
        </StatusPill>
      </div>
      <p className="mt-1 text-sm text-fg-3">
        Scored as you type. Nothing reaches {state.customer.firstName} without passing through here.
      </p>

      {/* ------------------------------------------------------ the meter -- */}
      <div className="mt-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-xs font-semibold tracking-[0.12em] text-fg-3 uppercase">
            Pressure Index
          </span>
          <span className="flex items-baseline gap-2">
            <span
              className={`tnum text-2xl font-semibold ${
                band.tone === "pos"
                  ? "text-pos"
                  : band.tone === "attn"
                    ? "text-attn"
                    : "text-red-fg"
              }`}
            >
              {report.score}
            </span>
            <span className="text-xs text-fg-3">/ 100</span>
          </span>
        </div>
        <Meter
          className="mt-2"
          value={report.score}
          tone={band.tone === "pos" ? "pos" : band.tone === "attn" ? "attn" : "red"}
          label="Pressure Index"
          valueText={`${report.score} of 100 — ${band.label}`}
          height="lg"
        />
        <p
          aria-live="polite"
          className={`mt-2 text-sm ${
            band.tone === "red" ? "font-semibold text-red-fg" : "text-fg-2"
          }`}
        >
          <strong className="font-semibold">{band.label}.</strong> {band.advice}
        </p>
      </div>

      {/* ------------------------------------------------------- the draft -- */}
      <label htmlFor="nudge-title" className="mt-5 block text-xs font-semibold tracking-[0.1em] text-fg-3 uppercase">
        Headline
      </label>
      <input
        id="nudge-title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={60}
        placeholder="Just checking in"
        className="mt-1.5 w-full rounded-xl border border-edge bg-glass px-3 py-2.5 text-[0.9375rem] text-fg placeholder:text-fg-3 focus:border-link focus:bg-glass-2"
      />

      <label htmlFor="nudge-body" className="mt-3 block text-xs font-semibold tracking-[0.1em] text-fg-3 uppercase">
        Message
      </label>
      <div className="relative mt-1.5">
        {/*
          Highlight layer. A mirror of the textarea's text with the flagged
          spans wrapped, sitting exactly behind it. Font, padding, border and
          line-height must match the textarea or the highlights drift.
        */}
        <div
          ref={mirrorRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl border border-transparent px-3 py-2.5 text-[0.9375rem] leading-relaxed whitespace-pre-wrap break-words text-transparent"
        >
          {renderHighlights(
            draft,
            report.spans.filter((span) => span.end <= draft.length),
          )}
        </div>
        <textarea
          id="nudge-body"
          ref={textareaRef}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            // Edited by hand: that is now the agent's own wording.
            setRewriteSource(null);
          }}
          onScroll={syncScroll}
          rows={4}
          maxLength={400}
          placeholder="Nothing's wrong — I just wanted to make one thing easy."
          className="relative w-full resize-none rounded-xl border border-edge bg-transparent px-3 py-2.5 text-[0.9375rem] leading-relaxed text-fg caret-link placeholder:text-fg-3 focus:border-link"
        />
      </div>

      {/* ------------------------------------------------- locked wording -- */}
      {lockedIds.length > 0 ? (
        <ul className="mt-2 space-y-1.5" aria-label="Locked wording, sent verbatim">
          {lockedIds.map((id) => {
            const seg = LOCKED_SEGMENTS.find((s) => s.id === id);
            if (!seg) return null;
            return (
              <li
                key={id}
                className="flex items-start justify-between gap-3 rounded-xl border border-calm/30 bg-calm-dim px-3 py-2"
              >
                <span className="min-w-0 text-[0.9375rem] text-fg">
                  <span className="mr-1.5 text-xs font-semibold tracking-[0.1em] text-calm uppercase">
                    Locked
                  </span>
                  {seg.text({ payBy })}
                  <span className="block text-xs text-fg-3">{seg.why}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setLockedIds((ids) => ids.filter((x) => x !== id))}
                  className="min-h-11 shrink-0 px-2 text-sm font-semibold text-fg-3 hover:text-fg"
                  aria-label={`Remove ${seg.label}`}
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-xs text-fg-3">Add required wording:</span>
        {LOCKED_SEGMENTS.filter((seg) => !lockedIds.includes(seg.id)).map((seg) => (
          <button
            key={seg.id}
            type="button"
            onClick={() => setLockedIds((ids) => [...ids, seg.id])}
            className="min-h-11 rounded-xl border border-edge bg-glass px-3 text-sm font-medium text-fg-2 hover:text-fg"
          >
            + {seg.label}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------- findings -- */}
      <AnimatePresence initial={false}>
        {report.findings.length > 0 ? (
          <motion.ul
            key="findings"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 space-y-1.5 overflow-hidden text-sm"
          >
            {report.findings.slice(0, 4).map((f) => (
              <li key={f.kind} className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="text-fg">{f.label}</span>
                  <span className="block text-xs text-fg-3">{f.detail}</span>
                </span>
                <span className="tnum shrink-0 text-xs font-semibold text-red-fg">
                  +{f.weight}
                </span>
              </li>
            ))}
          </motion.ul>
        ) : null}
      </AnimatePresence>

      {/* -------------------------------------------------- rewrite result -- */}
      <AnimatePresence>
        {lastRewrite ? (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 rounded-xl border border-pos/25 bg-pos-dim px-3 py-2 text-sm font-medium text-pos"
          >
            Rewritten by {lastRewrite.source === "claude" ? "Claude" : "the local engine"}:{" "}
            <span className="tnum">
              {lastRewrite.from} → {lastRewrite.to}
            </span>
          </motion.p>
        ) : null}
      </AnimatePresence>

      {/* ----------------------------------------------------------- tone -- */}
      <fieldset className="mt-4">
        <legend className="text-xs font-semibold tracking-[0.1em] text-fg-3 uppercase">
          Tone
        </legend>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {(
            [
              { id: "calm", label: "Calm" },
              { id: "warm", label: "Warm" },
              { id: "celebrate", label: "Celebrate" },
            ] as const
          ).map((option) => (
            <label
              key={option.id}
              className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors ${
                option.id === "celebrate" && !goodNews
                  ? "cursor-not-allowed border-edge text-fg-3 opacity-60"
                  : tone === option.id
                    ? "cursor-pointer border-link bg-link-dim text-fg"
                    : "cursor-pointer border-edge bg-glass text-fg-3 hover:text-fg-2"
              }`}
            >
              <input
                type="radio"
                name="nudge-tone"
                value={option.id}
                checked={tone === option.id}
                disabled={option.id === "celebrate" && !goodNews}
                onChange={() => {
                  setTone(option.id);
                  // A draft that came from a rewrite is re-typed in the new tone.
                  if (lastRewrite) void doRewrite(option.id);
                }}
                className="h-4 w-4 accent-[var(--color-link)]"
              />
              {option.label}
            </label>
          ))}
        </div>
        {!goodNews ? (
          <p className="mt-1.5 text-xs text-fg-3">
            Celebrate unlocks when there&apos;s good news — like the card being paid.
          </p>
        ) : null}
      </fieldset>

      {/* ------------------------------------------------------ tone check -- */}
      {draft.trim() ? (
        <div
          aria-live="polite"
          className={`mt-2 rounded-xl border px-3 py-2 text-sm ${
            toneCheck.verdict === "block"
              ? "border-red/40 bg-red/10 text-red-fg"
              : toneCheck.verdict === "warn"
                ? "border-attn/40 bg-attn-dim text-attn"
                : "border-edge text-fg-2"
          }`}
        >
          <span className="font-semibold">Reads as: {DETECTED_LABEL[toneCheck.detected]}</span>
          {toneCheck.advice ? <span> — {toneCheck.advice}</span> : <span> — matches the tone you picked.</span>}
        </div>
      ) : null}

      {/* ------------------------------------------------ frequency guard -- */}
      <div className="mt-4 rounded-xl border border-edge bg-glass p-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone={contact.overLimit ? "attn" : "link"}>
            {ordinal(contact.nextOrdinal)} message this week
          </StatusPill>
          <span className="text-xs text-fg-3">
            {state.customer.firstName}&apos;s limit: {state.customer.contactPreferences.maxPerWeek} a week
          </span>
        </div>
        {contact.breaches.length > 0 ? (
          <ul className="mt-2 space-y-0.5 text-sm text-attn">
            {contact.breaches.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        ) : null}
        <p className="mt-2 text-xs text-fg-3">
          Why it&apos;s counted: {FREQUENCY_EVIDENCE.text} ({FREQUENCY_EVIDENCE.source})
        </p>
      </div>

      {/* --------------------------------------------------------- actions -- */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant={report.score >= 20 ? "primary" : "outline"}
          size="md"
          onClick={() => doRewrite()}
          disabled={!draft.trim() || rewriting}
        >
          {rewriting
            ? "Rewriting…"
            : tone === "warm"
              ? "Rewrite it warmly"
              : tone === "celebrate" && goodNews
                ? "Rewrite it as good news"
                : "Rewrite it calmly"}
        </Button>
        <Button
          variant={report.band === "harmful" || toneCheck.abusive ? "danger" : "pos"}
          size="md"
          onClick={() => send()}
          disabled={!draft.trim()}
        >
          {toneCheck.abusive
            ? "Can't send — rewrite first"
            : report.band === "harmful"
            ? confirmHarmful
              ? "Send anyway — I'm sure"
              : "Send anyway"
            : confirmContact
              ? `Send anyway — break ${state.customer.firstName}'s rule`
              : `Send to ${state.customer.firstName}'s phone`}
        </Button>
        <Button variant="ghost" size="md" onClick={() => loadExample(true)}>
          Load a bad example
        </Button>
      </div>

      {abuseRefused ? (
        <p role="alert" className="mt-2 text-sm font-semibold text-red-fg">
          This contains an insult or swearing, so it can&apos;t be sent. Press
          &ldquo;Rewrite&rdquo; to start again from the facts.
        </p>
      ) : null}

      {confirmContact && !confirmHarmful ? (
        <p role="alert" className="mt-2 text-sm font-semibold text-attn">
          This breaks a rule {state.customer.firstName} set on a calm day. Press again to send anyway.
        </p>
      ) : null}

      {confirmHarmful ? (
        <p role="alert" className="mt-2 text-sm font-semibold text-red-fg">
          This scored {report.score}. On this file, that is the message that
          produces another two weeks of silence. Press again to send it anyway.
        </p>
      ) : null}
    </Panel>
  );
}

/** Wrap flagged spans in the mirror layer, leaving the rest as plain text. */
function renderHighlights(text: string, spans: PressureSpan[]) {
  if (spans.length === 0) return text;
  const nodes: React.ReactNode[] = [];
  let cursor = 0;

  spans.forEach((span, i) => {
    if (span.start > cursor) nodes.push(text.slice(cursor, span.start));
    /*
      `<mark>` has a yellow UA background, so a kind with no style of its own
      has to clear it. The ones that do carry a wash must not be given
      `bg-transparent` as well — Tailwind emits both, the reset wins on source
      order, and the wash silently never renders. That is what used to happen
      to all four: the underline showed and the colour behind the words did not.
    */
    const style = SPAN_STYLE[span.kind] || "bg-transparent";
    nodes.push(
      <mark key={i} className={`rounded-sm text-transparent ${style}`}>
        {text.slice(span.start, span.end)}
      </mark>,
    );
    cursor = span.end;
  });

  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}
