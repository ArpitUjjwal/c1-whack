"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { StatusPill } from "@/components/ui/StatusPill";
import type { AgentScript } from "@/lib/scripts";

/**
 * Agent scripting that reacts to live state.
 *
 * The panel rewrites itself whenever Alex's situation changes — pay the card
 * in the other window and the opener changes from "I wanted to make one thing
 * easy" to "that's it, it's done" before the agent has finished reading.
 *
 * What not to say is handled where words are written: the Pressure Index and
 * tone check score every draft. The next step lives in the next-action bar.
 */
export function AgentScriptPanel({
  script,
  source = "local",
  onUseLine,
}: {
  script: AgentScript;
  /** Which engine wrote this script. Shown, never hidden. */
  source?: "local" | "claude";
  onUseLine?: (line: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [allLines, setAllLines] = useState(false);
  /** Opener plus the first lines: enough to start; the rest on request. */
  const FIRST = 2;
  const lines = allLines ? script.lines : script.lines.slice(0, FIRST);

  const copyScript = async () => {
    const text = [script.opener, ...script.lines]
      .map((line) => line.replace(/^“|”$/g, ""))
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2400);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Panel className="p-4" aria-labelledby="script-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="script-heading" className="font-semibold text-fg">
          What to say
        </h2>
        {/*
          Which engine wrote the words on screen. "Follows the customer's
          state" was true of the template too, so it could not tell the two
          apart — and the agent is about to say this out loud.
        */}
        <StatusPill tone="calm">
          <span className="breathe" aria-hidden="true">
            ●
          </span>
          {source === "claude"
            ? "Written for this call"
            : "Follows the customer's state"}
        </StatusPill>
      </div>

      <p className="glass mt-2 rounded-xl px-3 py-2 text-sm font-medium text-fg-2">
        {script.situation}
      </p>

      <div className="mt-3" aria-live="polite">
        <AnimatePresence mode="wait">
          <motion.div
            key={script.opener}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
          >
            <p className="rounded-xl border-l-2 border-calm bg-calm-dim px-3 py-2.5 text-[0.9375rem] leading-relaxed font-medium text-fg">
              {script.opener}
            </p>
            <ul className="mt-2 space-y-1">
              {lines.map((line) => (
                <li key={line} className="flex items-start gap-2.5">
                  <span aria-hidden="true" className="mt-2 text-xs text-calm">
                    ▸
                  </span>
                  <span className="flex-1 text-sm leading-relaxed text-fg-2">
                    {line}
                  </span>
                  {onUseLine ? (
                    <button
                      type="button"
                      onClick={() => onUseLine(line.replace(/^“|”$/g, ""))}
                      className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg px-4 text-xs font-semibold text-link hover:text-fg"
                    >
                      Use
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
            {script.lines.length > FIRST ? (
              <button
                type="button"
                onClick={() => setAllLines((v) => !v)}
                aria-expanded={allLines}
                className="min-h-[44px] text-sm font-semibold text-link hover:text-fg"
              >
                {allLines ? "Fewer lines" : `More lines (${script.lines.length - FIRST})`}
              </button>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Button size="sm" variant="outline" onClick={copyScript}>
          Copy script
        </Button>
        <span aria-live="polite" className="text-sm font-medium text-pos">
          {copied ? "Copied." : ""}
        </span>
        <span className="text-xs text-fg-3">Script&apos;s next step: {script.nextStep}</span>
      </div>
    </Panel>
  );
}
