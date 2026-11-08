"use client";

/**
 * A gentle in-app tip, recommended by the bank's aggregate Insights report
 * and shown to everyone on that screen — never targeted at one person, and
 * never based on anything measured on this phone. Closing it is remembered.
 */
export function Tip({ text, onDismiss }: { text: string; onDismiss: () => void }) {
  return (
    <div
      role="note"
      className="flex items-start justify-between gap-3 rounded-xl border border-calm/25 bg-calm-dim px-3.5 py-2.5"
    >
      <p className="text-sm text-fg-2">
        <span className="font-semibold text-calm">Tip · </span>
        {text}
      </p>
      <button
        type="button"
        onClick={onDismiss}
        className="min-h-[44px] shrink-0 px-2 text-sm font-semibold text-fg-3 hover:text-fg"
      >
        Got it
      </button>
    </div>
  );
}
