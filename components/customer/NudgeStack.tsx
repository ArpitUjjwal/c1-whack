"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import type { Nudge, Tone } from "@/lib/types";

const toneStyles: Record<Tone, { shell: string; eyebrow: string }> = {
  calm: { shell: "border-calm/30 bg-calm-dim", eyebrow: "text-calm" },
  warm: { shell: "border-attn/30 bg-attn-dim", eyebrow: "text-attn" },
  celebrate: { shell: "border-pos/30 bg-pos-dim", eyebrow: "text-pos" },
};

/**
 * Live nudge receiver.
 *
 * Messages an agent sends arrive here instantly. They are toasts, never
 * modals: they do not block and they do not cover what the customer is doing.
 * `aria-live="polite"` means a screen reader finishes its current sentence
 * before announcing one, which matters a great deal mid-task.
 *
 * One at a time, newest first. Stacking them would undo the entire point of a
 * home screen with a single thing on it; dismissing one reveals the next.
 */
export function NudgeStack({
  nudges,
  onDismiss,
  onAction,
}: {
  nudges: Nudge[];
  onDismiss: (id: string) => void;
  onAction: (nudge: Nudge) => void;
}) {
  const visible = nudges.slice(-1);
  const queued = Math.max(0, nudges.length - 1);

  return (
    <div
      aria-live="polite"
      aria-relevant="additions"
      className="pointer-events-none absolute inset-x-0 bottom-20 z-30 space-y-2.5 px-4"
    >
      <AnimatePresence initial={false}>
        {visible.map((nudge) => {
          const tone = toneStyles[nudge.tone];
          return (
            <motion.div
              key={nudge.id}
              layout
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
              className={`glass-2 pointer-events-auto rounded-xl2 border p-4 backdrop-blur-xl ${tone.shell}`}
            >
              <p
                className={`text-xs font-semibold tracking-[0.1em] uppercase ${tone.eyebrow}`}
              >
                {nudge.fromAgent} · Capital One
              </p>
              <h3 className="mt-1.5 font-semibold text-fg">{nudge.title}</h3>
              <p className="mt-1 text-[0.9375rem] text-fg-2">{nudge.body}</p>

              <div className="mt-3 flex flex-wrap gap-2">
                {nudge.actionLabel ? (
                  <Button size="sm" variant="calm" onClick={() => onAction(nudge)}>
                    {nudge.actionLabel}
                  </Button>
                ) : null}
                <Button size="sm" variant="ghost" onClick={() => onDismiss(nudge.id)}>
                  {nudge.actionLabel ? "Later" : "Got it"}
                </Button>
              </div>

              {queued > 0 ? (
                <p className="mt-2 text-xs text-fg-3">
                  {queued} more message{queued === 1 ? "" : "s"} after this one
                </p>
              ) : null}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
