"use client";

import { Panel } from "@/components/ui/Panel";
import { ListenButton } from "@/components/ui/ListenButton";
import {
  READING_PRESETS,
  type DevicePrefs,
  type ReadingFont,
  type TextSize,
  type Tint,
} from "@/lib/device";

type Patch = Partial<Omit<DevicePrefs, "epoch">>;

/**
 * Reading and listening.
 *
 * Options anyone can turn on, with no reason asked: a reading-friendly font,
 * bigger text, wider spacing, a tinted background, high contrast, and
 * read-aloud speed. Two one-tap presets bundle common combinations. All of it
 * is stored on this phone and never shared.
 */
export function ReadingSettings({
  prefs,
  onChange,
}: {
  prefs: DevicePrefs;
  onChange: (patch: Patch) => void;
}) {
  return (
    <Panel as="article" className="p-5" aria-labelledby="reading-heading">
      <div className="flex items-center justify-between gap-3">
        <h3 id="reading-heading" className="font-semibold text-fg">
          Reading and listening
        </h3>
        <ListenButton
          id="reading-sample"
          label="Try listening"
          text="This is how the app sounds when it reads to you. You can change the speed below."
        />
      </div>
      <p className="mt-1 text-sm text-fg-3">
        Make the app easier to read or listen to. Saved on this phone only.
      </p>

      <div className="mt-3 grid gap-2">
        {READING_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(p.patch)}
            className="min-h-11 rounded-xl border border-edge bg-glass px-3 py-2 text-left hover:border-calm/40"
          >
            <span className="block text-[0.9375rem] font-semibold text-fg">{p.label}</span>
            <span className="block text-sm text-fg-3">{p.detail}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-4 border-t border-edge pt-4">
        <Choice<ReadingFont>
          legend="Font"
          name="reading-font"
          value={prefs.font}
          options={[
            ["standard", "Standard"],
            ["lexend", "Lexend"],
            ["atkinson", "Atkinson"],
          ]}
          onPick={(font) => onChange({ font })}
        />
        <Choice<TextSize>
          legend="Text size"
          name="reading-size"
          value={prefs.textSize}
          options={[
            ["standard", "Standard"],
            ["large", "Large"],
            ["xlarge", "Extra large"],
          ]}
          onPick={(textSize) => onChange({ textSize })}
        />
        <Choice<Tint>
          legend="Background"
          name="reading-tint"
          value={prefs.tint}
          options={[
            ["none", "Plain"],
            ["cream", "Cream"],
            ["blue", "Soft blue"],
          ]}
          onPick={(tint) => onChange({ tint })}
        />
        <Choice<string>
          legend="Read-aloud speed"
          name="reading-rate"
          value={String(prefs.speechRate)}
          options={[
            ["0.8", "Slower"],
            ["1", "Normal"],
            ["1.2", "Faster"],
          ]}
          onPick={(rate) => onChange({ speechRate: Number(rate) })}
        />
        <Toggle
          id="reading-spacing"
          label="Wider spacing, no italics"
          on={prefs.wideSpacing}
          onToggle={(wideSpacing) => onChange({ wideSpacing })}
        />
        <Toggle
          id="reading-contrast"
          label="High contrast"
          on={prefs.highContrast}
          onToggle={(highContrast) => onChange({ highContrast })}
        />
      </div>
    </Panel>
  );
}

function Choice<T extends string>({
  legend,
  name,
  value,
  options,
  onPick,
}: {
  legend: string;
  name: string;
  value: T;
  options: [T, string][];
  onPick: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-fg">{legend}</legend>
      <div className="mt-1.5 grid grid-cols-3 gap-2">
        {options.map(([v, label]) => (
          <label
            key={v}
            className={`flex min-h-11 cursor-pointer items-center justify-center rounded-xl border px-2 text-center text-sm font-medium has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-link ${
              value === v ? "border-calm bg-calm-dim text-fg" : "border-edge text-fg-2"
            }`}
          >
            <input
              type="radio"
              name={name}
              checked={value === v}
              onChange={() => onPick(v)}
              className="sr-only"
            />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Toggle({
  id,
  label,
  on,
  onToggle,
}: {
  id: string;
  label: string;
  on: boolean;
  onToggle: (on: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span id={id} className="text-sm font-medium text-fg">
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby={id}
        onClick={() => onToggle(!on)}
        className={`relative inline-flex h-11 w-[4.25rem] shrink-0 items-center rounded-full border transition-colors ${
          on ? "border-calm bg-calm-dim" : "border-edge bg-glass"
        }`}
      >
        <span
          aria-hidden="true"
          className={`absolute h-7 w-7 rounded-full transition-transform ${
            on ? "translate-x-8 bg-calm" : "translate-x-1.5 bg-fg-3"
          }`}
        />
      </button>
    </div>
  );
}
