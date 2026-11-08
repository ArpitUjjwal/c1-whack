"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { explainLocally, type ExplainSubject } from "@/lib/explain";
import type { ExplainDraft } from "@/lib/ai/provider";

/**
 * "What does this mean?"
 *
 * The customer's own explain button. It opens a sheet, asks the server, and
 * shows plain words about the figure they were already looking at.
 *
 * Three things it deliberately does not do:
 *
 *  · **It never shows an error.** The server always returns an explanation,
 *    and if the request itself fails this falls back to the same local text
 *    the server would have sent. Someone who taps this is asking for help
 *    understanding their own money; "something went wrong" is the one answer
 *    that must never come back.
 *  · **It never tells them what to do.** `whatYouCouldDo` is rendered as
 *    options, under a heading that says so, and is often empty.
 *  · **It says who wrote it.** A written explanation and the standard one
 *    look alike on purpose, so the label is the only way to tell — which
 *    means the label has to be there.
 */
export function WhatThisMeans({
  subject,
  label = "What does this mean?",
}: {
  subject: ExplainSubject;
  /** Override for places where a more specific question reads better. */
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<{
    explanation: ExplainDraft;
    source: "local" | "claude";
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const ask = async () => {
    setOpen(true);
    if (state || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subject),
      });
      if (res.ok) {
        const body = (await res.json()) as {
          explanation?: ExplainDraft;
          source?: "local" | "claude";
        };
        if (body.explanation) {
          setState({ explanation: body.explanation, source: body.source ?? "local" });
          return;
        }
      }
      setState({ explanation: explainLocally(subject), source: "local" });
    } catch {
      setState({ explanation: explainLocally(subject), source: "local" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={ask}
        className="inline-flex min-h-[44px] items-center gap-1.5 text-[0.8125rem] font-semibold text-link hover:text-fg"
      >
        <Icon name="info" size={16} />
        {label}
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="What this means">
        {loading || !state ? (
          <p className="text-[0.9375rem] text-fg-3" aria-live="polite">
            Working it out…
          </p>
        ) : (
          <div aria-live="polite">
            <p className="text-lg leading-snug font-semibold text-fg">
              {state.explanation.headline}
            </p>

            <ul className="mt-3 space-y-2">
              {state.explanation.plainWords.map((line) => (
                <li key={line} className="text-[0.9375rem] leading-relaxed text-fg-2">
                  {line}
                </li>
              ))}
            </ul>

            {state.explanation.whatYouCouldDo.length > 0 ? (
              <div className="mt-4 rounded-xl bg-deep p-3.5">
                <h3 className="text-[0.8125rem] font-semibold text-fg">
                  Things you could do
                </h3>
                <ul className="mt-2 space-y-1.5">
                  {state.explanation.whatYouCouldDo.map((option) => (
                    <li key={option} className="text-[0.9375rem] text-fg-2">
                      {option}
                    </li>
                  ))}
                </ul>
                <p className="mt-2.5 text-xs text-fg-3">
                  Options, not instructions. Nothing here happens unless you choose it.
                </p>
              </div>
            ) : null}

            <p className="mt-4 text-xs text-fg-3">
              {state.source === "claude"
                ? "Written for you just now, from the figures on this screen, and checked for plain English."
                : "The standard explanation for this screen."}
            </p>
          </div>
        )}

        <Button variant="outline" size="md" fullWidth className="mt-5" onClick={() => setOpen(false)}>
          Close
        </Button>
      </Sheet>
    </>
  );
}
