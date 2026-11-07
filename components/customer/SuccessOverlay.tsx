"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

/**
 * The reward.
 *
 * Task avoidance is partly a feedback problem: the effort of dealing with a
 * payment is immediate and the payoff is invisible. This makes the payoff
 * loud, immediate and unmistakably positive — then gets out of the way on its
 * own, so the celebration never becomes another thing to clear.
 */
export function SuccessOverlay({
  open,
  headline,
  body,
  winsCount,
  onClose,
}: {
  open: boolean;
  headline: string;
  body: string;
  winsCount: number;
  onClose: () => void;
}) {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(onClose, 5200);
    return () => window.clearTimeout(t);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="success"
          className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-void/95 px-7 text-center backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="success-headline"
          aria-describedby="success-body"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(30rem 20rem at 50% 35%, rgba(61,220,151,0.16), transparent 70%)",
            }}
          />
          {!reduceMotion ? <Confetti /> : null}

          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { scale: 0.4, opacity: 0 }}
            animate={reduceMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
            transition={
              reduceMotion
                ? { duration: 0.2 }
                : { type: "spring", stiffness: 260, damping: 14, delay: 0.05 }
            }
            className="pulse-ring relative flex h-24 w-24 items-center justify-center rounded-full bg-pos"
          >
            <svg viewBox="0 0 48 48" className="h-12 w-12" aria-hidden="true">
              <motion.path
                d="M12 25.5 L20.5 34 L36 16"
                fill="none"
                stroke="#06090f"
                strokeWidth="4.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{
                  duration: reduceMotion ? 0.01 : 0.45,
                  delay: reduceMotion ? 0 : 0.28,
                  ease: "easeOut",
                }}
              />
            </svg>
          </motion.div>

          <motion.h2
            id="success-headline"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduceMotion ? 0 : 0.4 }}
            className="relative mt-7 text-2xl font-semibold text-fg"
          >
            {headline}
          </motion.h2>

          <motion.p
            id="success-body"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduceMotion ? 0 : 0.52 }}
            className="relative mt-2.5 text-[0.9375rem] text-fg-2"
          >
            {body}
          </motion.p>

          {winsCount > 0 ? (
            <motion.p
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: reduceMotion ? 0 : 0.68 }}
              className="glass relative mt-5 inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold text-pos"
            >
              {winsCount} thing{winsCount === 1 ? "" : "s"} sorted this week
            </motion.p>
          ) : null}

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: reduceMotion ? 0 : 0.8 }}
            className="relative mt-8 w-full"
          >
            <Button variant="pos" size="lg" fullWidth onClick={onClose}>
              Nice
            </Button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/** Purely decorative, and skipped entirely under reduced motion. */
function Confetti() {
  const pieces = [
    { x: -110, color: "bg-pos", delay: 0.1 },
    { x: -62, color: "bg-calm", delay: 0.18 },
    { x: -20, color: "bg-attn", delay: 0.05 },
    { x: 28, color: "bg-link", delay: 0.22 },
    { x: 74, color: "bg-pos", delay: 0.12 },
    { x: 118, color: "bg-calm", delay: 0.26 },
  ];
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((piece, i) => (
        <motion.span
          key={i}
          className={`absolute top-1/4 left-1/2 h-2 w-2 rounded-sm ${piece.color}`}
          initial={{ opacity: 0, y: 0, x: piece.x, rotate: 0 }}
          animate={{ opacity: [0, 1, 1, 0], y: [0, -70, 220], rotate: 420 }}
          transition={{ duration: 1.9, delay: piece.delay, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}
