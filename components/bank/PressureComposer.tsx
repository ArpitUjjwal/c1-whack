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
  type FindingKind,
  type PressureReport,
  type PressureSpan,
} from "@/lib/engines/pressure";
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
 */

/** How long the agent must pause before the deeper Claude pass runs. */
const DEEP_DEBOUNCE_MS = 650;

const SPAN_STYLE: Record<FindingKind, string> = {
  urgency: "bg-attn/25 border-b-2 border-attn",
  shame: "bg-red/25 border-b-2 border-red-fg",
  threat: "bg-red/30 border-b-2 border-red-fg",
  jargon: "bg-link/20 border-b-2 border-link",
  "long-sentence": "",
  grade: "",
  "multiple-asks": "",
  passive: "",
};

export function PressureComposer({
  state,
  onSend,
}: {
  state: AppState;
  onSend: (title: string, body: string, tone: Tone) => void;
}) {
  const [title, setTitle] = useState("");
  const [draft, setDraft] = useState("");
  const [tone, setTone] = useState<Tone>("calm");
  const [deep, setDeep] = useState<{ text: string; report: PressureReport } | null>(
    null,
  );
  const [claudeAvailable, setClaudeAvailable] = useState(false);
  const [rewriting, setRewriting] = useState(false);
  const [lastRewrite, setLastRewrite] = useState<{
    from: number;
    to: number;
    source: "local" | "claude";
  } | null>(null);
  const [confirmHarmful, setConfirmHarmful] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const { onSignal } = useRealtimeSync();

  /* Instant, synchronous, every keystroke. */
  const localReport = useMemo(() => analyseNow(draft), [draft]);

  /*
    The report actually shown: Claude's, but only while it still describes the
    text on screen. Tying it to the draft means staleness is derived rather
    than cleared by a setState, so editing never shows a score for old text.
  */
  const report = deep && deep.text === draft ? deep.report : localReport;
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
      const result = await deepAnalyse(draft, controller.signal);
      if (result) setDeep({ text: draft, report: result });
    }, DEEP_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [draft, claudeAvailable]);

  /* Keep the highlight layer aligned with the textarea while it scrolls. */
  const syncScroll = useCallback(() => {
    if (mirrorRef.current && textareaRef.current) {
      mirrorRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  const doRewrite = async () => {
    if (!draft.trim()) return;
    setRewriting(true);
    const before = report.score;
    const result = await rewrite(draft, {
      amount: money(state.credit.minimumDue),
      agentName: state.agentName,
    });
    setDraft(result.text);
    setLastRewrite({ from: before, to: result.report.score, source: result.source });
    setRewriting(false);
    setConfirmHarmful(false);
  };

  const send = () => {
    const t = title.trim() || "A note from your support team";
    const b = draft.trim();
    if (!b) return;
    if (report.band === "harmful" && !confirmHarmful) {
      setConfirmHarmful(true);
      return;
    }
    onSend(t, b, tone);
    setTitle("");
    setDraft("");
    setLastRewrite(null);
    setConfirmHarmful(false);
  };

  /*
    The Demo Director drives these three from a keypress. Handlers are kept in
    a ref so the subscription is set up once and still calls the current
    closure — re-subscribing on every keystroke would drop in-flight signals.
  */
  const handlersRef = useRef<{
    loadExample: (focusField?: boolean) => void;
    doRewrite: () => void;
    send: () => void;
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
      if (signal.action === "send_draft") handlersRef.current.send();
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
      "You must pay the full balance immediately to avoid collections. Failure to do so will be reported to the credit bureaus.",
    );
    setLastRewrite(null);
    setConfirmHarmful(false);
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
          Message to Alex
        </h2>
        <StatusPill tone={claudeAvailable ? "calm" : "neutral"}>
          {claudeAvailable ? "Local + Claude" : "Local engine"}
        </StatusPill>
      </div>
      <p className="mt-1 text-sm text-fg-3">
        Scored as you type. Nothing reaches Alex without passing through here.
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
          {renderHighlights(draft, report.spans)}
        </div>
        <textarea
          id="nudge-body"
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onScroll={syncScroll}
          rows={4}
          maxLength={400}
          placeholder="Nothing's wrong — I just wanted to make one thing easy."
          className="relative w-full resize-none rounded-xl border border-edge bg-transparent px-3 py-2.5 text-[0.9375rem] leading-relaxed text-fg caret-link placeholder:text-fg-3 focus:border-link"
        />
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
              className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors ${
                tone === option.id
                  ? "border-link bg-link-dim text-fg"
                  : "border-edge bg-glass text-fg-3 hover:text-fg-2"
              }`}
            >
              <input
                type="radio"
                name="nudge-tone"
                value={option.id}
                checked={tone === option.id}
                onChange={() => setTone(option.id)}
                className="h-4 w-4 accent-[var(--color-link)]"
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      {/* --------------------------------------------------------- actions -- */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant={report.score >= 20 ? "primary" : "outline"}
          size="md"
          onClick={doRewrite}
          disabled={!draft.trim() || rewriting}
        >
          {rewriting ? "Rewriting…" : "Rewrite it calmly"}
        </Button>
        <Button
          variant={report.band === "harmful" ? "danger" : "pos"}
          size="md"
          onClick={send}
          disabled={!draft.trim()}
        >
          {report.band === "harmful"
            ? confirmHarmful
              ? "Send anyway — I'm sure"
              : "Send anyway"
            : "Send to Alex's phone"}
        </Button>
        <Button variant="ghost" size="md" onClick={() => loadExample(true)}>
          Load a bad example
        </Button>
      </div>

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
    const style = SPAN_STYLE[span.kind];
    nodes.push(
      <mark key={i} className={`rounded-sm bg-transparent text-transparent ${style}`}>
        {text.slice(span.start, span.end)}
      </mark>,
    );
    cursor = span.end;
  });

  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}
