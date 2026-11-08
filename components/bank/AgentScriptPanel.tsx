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
 * The "don't say" column matters as much as the script: most of the harm in
 * an arrears conversation comes from standard phrasing nobody chose.
 */
export function AgentScriptPanel({
  script,
  onUseLine,
}: {
  script: AgentScript;
  onUseLine?: (line: string) => void;
}) {
  const [copied, setCopied] = useState(false);

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
    <Panel className="p-5" aria-labelledby="script-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="script-heading" className="font-semibold text-fg">
          What to say
        </h2>
        <StatusPill tone="calm">
          <span className="breathe" aria-hidden="true">
            ●
          </span>
          Follows the customer&apos;s state
        </StatusPill>
      </div>

      <p className="glass mt-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-fg-2">
        {script.situation}
      </p>

      <div className="mt-4" aria-live="polite">
        <AnimatePresence mode="wait">
          <motion.div
            key={script.opener}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
          >
            <p className="rounded-xl border-l-2 border-calm bg-calm-dim p-4 text-base leading-relaxed font-medium text-fg">
              {script.opener}
            </p>
            {/*
              Capped and scrolled, the way the activity timeline is: a long
              script should scroll inside its own panel rather than stretch
              the column and push everything beside it down the page.
            */}
            <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
              {script.lines.map((line) => (
                <li key={line} className="flex items-start gap-2.5">
                  <span aria-hidden="true" className="mt-2 text-xs text-calm">
                    ▸
                  </span>
                  <span className="flex-1 text-[0.9375rem] leading-relaxed text-fg-2">
                    {line}
                  </span>
                  {onUseLine ? (
                    <button
                      type="button"
                      onClick={() => onUseLine(line.replace(/^“|”$/g, ""))}
                      className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg px-4 text-xs font-semibold text-link hover:text-fg"
                    >
                      Use
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-4 rounded-xl border border-red-fg/20 bg-red-dim p-3.5">
        <h3 className="text-xs font-semibold tracking-[0.12em] text-red-fg uppercase">
          Don&apos;t say
        </h3>
        <ul className="mt-2 space-y-2">
          {script.avoid.map((item) => (
            <li key={item.phrase} className="text-sm">
              <span className="font-medium text-fg">{item.phrase}</span>
              <span className="block text-fg-3">{item.why}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="glass-2 mt-4 rounded-xl p-3.5">
        <span className="text-xs font-semibold tracking-[0.12em] text-fg-3 uppercase">
          Next step
        </span>
        <p className="mt-1 text-[0.9375rem] font-medium text-fg">{script.nextStep}</p>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <Button size="sm" variant="outline" onClick={copyScript}>
          Copy script
        </Button>
        <span aria-live="polite" className="text-sm font-medium text-pos">
          {copied ? "Copied." : ""}
        </span>
      </div>
    </Panel>
  );
}
