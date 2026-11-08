"use client";

import { useState } from "react";
import { StruggleChecklist } from "./StruggleChecklist";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { StatusPill } from "@/components/ui/StatusPill";
import { DEVICE_DEFAULTS, type DevicePrefs } from "@/lib/device";
import { labelsFor, toggleStruggle, type StruggleId } from "@/lib/struggles";
import type { Action, AppState } from "@/lib/types";

type Patch = Partial<Omit<DevicePrefs, "epoch">>;

/**
 * Accessibility settings: change the first-run choices any time.
 *
 * Uses exactly the same toggle logic as the setup (lib/struggles.ts), so
 * ticking applies an option's settings and unticking puts back only what it
 * changed — never anything adjusted by hand since. Everything stays as set
 * until the customer changes it here.
 *
 * Sharing is its own switch. When it's on, the labels support sees follow the
 * ticks; when it's off, nothing is shared and changing ticks shares nothing.
 */
export function StrugglesSettings({
  state,
  prefs,
  onPrefs,
  dispatch,
}: {
  state: AppState;
  prefs: DevicePrefs;
  onPrefs: (patch: Patch) => void;
  dispatch: (action: Action) => void;
}) {
  const [note, setNote] = useState(state.customer.supportNote);
  const sharing = prefs.sharePreferences;
  const labels = labelsFor(prefs.struggles);

  const toggle = (id: StruggleId) => {
    const change = toggleStruggle(id, prefs, state.customer.contactPreferences, DEVICE_DEFAULTS);
    onPrefs(change.device);
    if (change.contact) {
      dispatch({
        type: "SET_CONTACT_PREFERENCES",
        preferences: { ...state.customer.contactPreferences, ...change.contact },
      });
    }
    // Keep what support sees in step with the ticks — only while sharing.
    if (sharing) {
      dispatch({ type: "SET_SHARED_PREFERENCES", preferences: change.labels, note: state.customer.supportNote });
    }
  };

  const setSharing = (on: boolean) => {
    onPrefs({ sharePreferences: on });
    dispatch({
      type: "SET_SHARED_PREFERENCES",
      preferences: on ? labels : [],
      note: on ? note : "",
    });
  };

  return (
    <Panel as="article" className="p-5" aria-labelledby="struggles-heading">
      <h3 id="struggles-heading" className="font-semibold text-fg">
        What you find hard
      </h3>
      <p className="mt-1 text-sm text-fg-3">
        The app adapts to what you tick. Stored on this phone — never shared.
      </p>
      <div className="mt-3">
        <StruggleChecklist selected={prefs.struggles} onToggle={toggle} />
      </div>

      <div className="mt-4 border-t border-edge pt-4">
        <div className="flex items-center justify-between gap-4">
          <span>
            <span id="share-label" className="block font-medium text-fg">
              Share my preferences with support
            </span>
            <span className="block text-sm text-fg-3">
              {sharing ? "On. They see the labels below." : "Off. Support sees nothing."}
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={sharing}
            aria-labelledby="share-label"
            disabled={!labels.length && !sharing}
            onClick={() => setSharing(!sharing)}
            className={`relative inline-flex h-[44px] w-[4.25rem] shrink-0 items-center rounded-full border transition-colors disabled:opacity-50 ${
              sharing ? "border-calm bg-calm-dim" : "border-edge bg-glass"
            }`}
          >
            <span
              aria-hidden="true"
              className={`absolute h-7 w-7 rounded-full transition-transform ${
                sharing ? "translate-x-8 bg-calm" : "translate-x-1.5 bg-fg-3"
              }`}
            />
          </button>
        </div>

        {sharing ? (
          <>
            <ul className="mt-3 flex flex-wrap gap-2">
              {labels.map((l) => (
                <li key={l}>
                  <StatusPill tone="calm">{l}</StatusPill>
                </li>
              ))}
            </ul>
            <label htmlFor="settings-note" className="mt-3 block text-sm font-medium text-fg">
              Note for your support team (optional)
            </label>
            <textarea
              id="settings-note"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 200))}
              rows={2}
              className="mt-1.5 w-full resize-none rounded-xl border border-edge bg-glass p-3 text-[0.9375rem] text-fg"
            />
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              disabled={note.trim() === state.customer.supportNote}
              onClick={() =>
                dispatch({ type: "SET_SHARED_PREFERENCES", preferences: labels, note })
              }
            >
              Save note
            </Button>
          </>
        ) : null}
        <p className="mt-3 text-xs text-fg-3">
          Never shared: what you tick above, or your reading and screen settings.
        </p>
      </div>
    </Panel>
  );
}
