"use client";

import { motion, useReducedMotion } from "framer-motion";

type Tone = "link" | "pos" | "attn" | "calm" | "red";

const fills: Record<Tone, string> = {
  link: "bg-link",
  pos: "bg-pos",
  attn: "bg-attn",
  calm: "bg-calm",
  red: "bg-red",
};

const glows: Record<Tone, string> = {
  link: "shadow-[0_0_12px_-2px_var(--color-link)]",
  pos: "shadow-[0_0_12px_-2px_var(--color-pos)]",
  attn: "shadow-[0_0_12px_-2px_var(--color-attn)]",
  calm: "shadow-[0_0_12px_-2px_var(--color-calm)]",
  red: "shadow-[0_0_14px_-2px_var(--color-red)]",
};

/**
 * A measured value with a real `meter` role.
 *
 * `aria-valuetext` carries the plain-language reading, so a screen reader
 * hears "Pressure: 72 of 100, high" rather than a bare number with no scale.
 */
export function Meter({
  value,
  max = 100,
  tone = "link",
  label,
  valueText,
  height = "md",
  className = "",
}: {
  value: number;
  max?: number;
  tone?: Tone;
  /** Accessible name. Pass the same text you render beside it. */
  label: string;
  /** Plain-language reading of the value. */
  valueText?: string;
  height?: "sm" | "md" | "lg";
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const pct = max <= 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  const h = height === "sm" ? "h-1.5" : height === "lg" ? "h-3" : "h-2";

  return (
    <div
      role="meter"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuetext={valueText}
      aria-label={label}
      className={`${h} w-full overflow-hidden rounded-full bg-glass-2 ${className}`}
    >
      <motion.div
        className={`h-full rounded-full ${fills[tone]} ${glows[tone]}`}
        initial={false}
        animate={{ width: `${Math.max(pct, pct > 0 ? 1.5 : 0)}%` }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 180, damping: 26 }
        }
      />
    </div>
  );
}
