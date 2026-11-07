"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useId, useState, type ReactNode } from "react";

/**
 * Progressive disclosure.
 *
 * Anything a customer does not need in order to make the next decision —
 * routing numbers, APR, statement mechanics, the arithmetic behind a figure —
 * lives in here. Collapsed by default, one tap away, properly announced.
 *
 * `onToggle` lets the cognitive-signal collector notice churn: opening and
 * closing the same panel repeatedly is a searching-for-something signal.
 */
export function Disclosure({
  label,
  openLabel,
  children,
  defaultOpen = false,
  onToggle,
}: {
  label: string;
  openLabel?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  onToggle?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const buttonId = useId();

  return (
    <div>
      <button
        id={buttonId}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          const next = !open;
          setOpen(next);
          onToggle?.(next);
        }}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-link transition-colors hover:text-fg"
      >
        <motion.span
          aria-hidden="true"
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="text-[0.65rem] leading-none"
        >
          ▶
        </motion.span>
        {open ? (openLabel ?? `Hide ${label.replace(/^show\s+/i, "")}`) : label}
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={panelId}
            role="region"
            aria-labelledby={buttonId}
            key="panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-3">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
