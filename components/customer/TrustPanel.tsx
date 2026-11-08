"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { CHANNEL_LABEL, hourLabel, quietHoursLabel } from "@/lib/contact";
import { shortDate, todayIso } from "@/lib/format";
import type { Action, AppState, ContactChannel, ContactPreferences } from "@/lib/types";

/**
 * The adaptive layer, explained to the person it adapts to — with the switch.
 *
 * Everything the product says about its own ethics in ACCESSIBILITY.md is
 * restated here in Alex's terms, on Alex's screen, because a guardrail the
 * customer cannot see is a promise they have to take on trust.
 */
export function TrustPanel({
  state,
  dispatch,
  adaptiveEnabled,
  onToggleAdaptive,
}: {
  state: AppState;
  dispatch: (action: Action) => void;
  /** Device-local: never part of shared state. */
  adaptiveEnabled: boolean;
  onToggleAdaptive: (on: boolean) => void;
}) {
  const on = adaptiveEnabled;

  return (
    <>
      <Panel as="article" className="p-5" aria-labelledby="trust-heading">
        <h3 id="trust-heading" className="font-semibold text-fg">
          What Adaptive Support notices
        </h3>
        <ul className="mt-3 space-y-2 text-[0.9375rem] text-fg-2">
          <li>How busy the screen you&apos;re on is.</li>
          <li>
            How you seem to be finding it — scrolling back and forth, taps that
            miss. <strong className="font-semibold text-fg">This stays on this phone.</strong>
          </li>
          <li>
            What you said you find hard, whether Safe Mode is on, and what you look
            at in the Time Machine. <strong className="font-semibold text-fg">Also only on this phone.</strong>
          </li>
        </ul>

        <h3 className="mt-5 font-semibold text-fg">What it never does</h3>
        <ul className="mt-3 space-y-2 text-[0.9375rem] text-fg-2">
          <li>Tell Capital One staff how you seem to be finding things, or that you use Safe Mode.</li>
          <li>Ask for a diagnosis, or a reason, before helping.</li>
          <li>Send anything to Capital One without you seeing it first.</li>
          <li>Feed into credit decisions, your limit, fees or collections.</li>
          <li>Move buttons you&apos;ve learned the place of.</li>
          <li>Ask again after you&apos;ve said no.</li>
        </ul>

        <div className="mt-5 flex items-center justify-between gap-4 border-t border-edge pt-4">
          <span>
            <span id="adaptive-label" className="block font-medium text-fg">
              Adaptive screen
            </span>
            <span className="block text-sm text-fg-3">
              {on
                ? "On. May offer to simplify the screen."
                : "Off. Nothing is measured on this phone."}
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-labelledby="adaptive-label"
            onClick={() => onToggleAdaptive(!on)}
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
      </Panel>

      <ContactPreferencesEditor
        prefs={state.customer.contactPreferences}
        onSave={(preferences) =>
          dispatch({ type: "SET_CONTACT_PREFERENCES", preferences })
        }
      />
    </>
  );
}

function ContactPreferencesEditor({
  prefs,
  onSave,
}: {
  prefs: ContactPreferences;
  onSave: (prefs: ContactPreferences) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(prefs);

  return (
    <Panel as="article" className="p-5" aria-labelledby="contact-heading">
      <h3 id="contact-heading" className="font-semibold text-fg">
        How we get in touch
      </h3>
      <p className="mt-1 text-sm text-fg-3">
        Your rules. Set them on a good day — your support team sees them on
        every message.
      </p>

      {!editing ? (
        <>
          <dl className="mt-3 space-y-2 text-[0.9375rem]">
            <Row label="Only by" value={CHANNEL_LABEL[prefs.channel]} />
            <Row label="At most" value={`${prefs.maxPerWeek} a week`} />
            <Row label="Never between" value={quietHoursLabel(prefs)} />
            <Row
              label="Reminders"
              value={
                prefs.remindDaysBefore
                  ? `${prefs.remindDaysBefore} day${prefs.remindDaysBefore === 1 ? "" : "s"} before, in the app`
                  : "Off"
              }
            />
          </dl>
          <p className="mt-2 text-xs text-fg-3">Set on {shortDate(prefs.setOn)}.</p>
          <Button
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={() => {
              setDraft(prefs);
              setEditing(true);
            }}
          >
            Change these
          </Button>
        </>
      ) : (
        <div className="mt-3 space-y-3">
          <fieldset>
            <legend className="text-sm font-medium text-fg">Only by</legend>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {(Object.keys(CHANNEL_LABEL) as ContactChannel[]).map((c) => (
                <label
                  key={c}
                  className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm ${
                    draft.channel === c ? "border-calm bg-calm-dim text-fg" : "border-edge text-fg-2"
                  }`}
                >
                  <input
                    type="radio"
                    name="contact-channel"
                    checked={draft.channel === c}
                    onChange={() => setDraft({ ...draft, channel: c })}
                    className="h-4 w-4 accent-[var(--color-calm)]"
                  />
                  {CHANNEL_LABEL[c]}
                </label>
              ))}
            </div>
          </fieldset>

          <Select
            id="contact-max"
            label="At most, per week"
            value={draft.maxPerWeek}
            options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: `${n}` }))}
            onChange={(n) => setDraft({ ...draft, maxPerWeek: n })}
          />
          <Select
            id="contact-remind"
            label="Remind me before payments I make myself"
            value={draft.remindDaysBefore}
            options={[
              { value: 0, label: "Off" },
              { value: 1, label: "1 day before" },
              { value: 2, label: "2 days before" },
              { value: 3, label: "3 days before" },
            ]}
            onChange={(n) => setDraft({ ...draft, remindDaysBefore: n as 0 | 1 | 2 | 3 })}
          />
          <div className="grid grid-cols-2 gap-2">
            <Select
              id="quiet-start"
              label="Quiet from"
              value={draft.quietHours.start}
              options={HOURS}
              onChange={(n) =>
                setDraft({ ...draft, quietHours: { ...draft.quietHours, start: n } })
              }
            />
            <Select
              id="quiet-end"
              label="Until"
              value={draft.quietHours.end}
              options={HOURS}
              onChange={(n) =>
                setDraft({ ...draft, quietHours: { ...draft.quietHours, end: n } })
              }
            />
          </div>

          <div className="flex gap-2">
            <Button
              size="md"
              variant="calm"
              onClick={() => {
                onSave({ ...draft, setOn: todayIso() });
                setEditing(false);
              }}
            >
              Save
            </Button>
            <Button size="md" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Panel>
  );
}

const HOURS = Array.from({ length: 24 }, (_, h) => ({ value: h, label: hourLabel(h) }));

function Select({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  options: { value: number; label: string }[];
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-fg">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 min-h-11 w-full rounded-xl border border-edge bg-glass px-3 text-[0.9375rem] text-fg"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-fg-3">{label}</dt>
      <dd className="font-medium text-fg">{value}</dd>
    </div>
  );
}
