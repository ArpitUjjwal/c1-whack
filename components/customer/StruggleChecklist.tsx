"use client";

import { STRUGGLES, type StruggleId } from "@/lib/struggles";

/**
 * "What do you find hard?" — the same list in the first-run setup and in
 * Settings, so the two can never drift apart. Each option says what it will
 * change before it is ticked. Real checkboxes, 44px rows, whole row clickable.
 */
export function StruggleChecklist({
  selected,
  onToggle,
}: {
  selected: StruggleId[];
  onToggle: (id: StruggleId) => void;
}) {
  return (
    <ul className="space-y-2">
      {STRUGGLES.map((s) => {
        const on = selected.includes(s.id);
        return (
          <li key={s.id}>
            <label
              className={`flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-link ${
                on ? "border-calm bg-calm-dim" : "border-edge bg-glass"
              }`}
            >
              <input
                type="checkbox"
                checked={on}
                onChange={() => onToggle(s.id)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-calm)]"
              />
              <span className="min-w-0">
                <span className="block text-[0.9375rem] font-semibold text-fg">{s.label}</span>
                <span className="block text-sm text-fg-2">{s.effect}</span>
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
