"use client";

/**
 * Presence indicator. Colour never carries the meaning on its own — the label
 * beside it always says the same thing in words.
 */
export function LiveDot({
  online,
  className = "",
}: {
  online: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${
        online ? "bg-pos breathe shadow-[0_0_8px_var(--color-pos)]" : "bg-fg-3/40"
      } ${className}`}
    />
  );
}
