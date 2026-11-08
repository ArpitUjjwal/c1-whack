"use client";

import { useEffect, useState, type RefObject } from "react";
import { StruggleChecklist } from "./StruggleChecklist";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { StatusPill } from "@/components/ui/StatusPill";
import { DEVICE_DEFAULTS, type DevicePrefs } from "@/lib/device";
import { STRUGGLES, labelsFor, toggleStruggle, type StruggleId } from "@/lib/struggles";
import type { Action, AppState } from "@/lib/types";

type Patch = Partial<Omit<DevicePrefs, "epoch">>;

export interface OnboardingControl {
  /** Demo Director: tick these choices, as if the customer had. */
  pick: (ids: StruggleId[]) => void;
  /** Demo Director: share (or not), add a note, and finish. */
  finish: (share: boolean, note: string) => void;
  /** Demo Director: press "Open my app". */
  open: () => void;
}

type Step = "welcome" | "pick" | "share" | "done";

/**
 * First-run setup: "What do you find hard?"
 *
 * Shown once, before anything else, the first time someone opens the app.
 * Ticking an option changes the app straight away, so the customer sees the
 * effect before committing. Nothing is asked about why, nothing they tick is
 * ever shared, and sharing the resulting preference labels with support is a
 * separate, explicit choice that starts switched off.
 *
 * The setup is itself accessible from the first screen: "Read this to me" and
 * "Make the text bigger" are offered before anything else is asked.
 */
export function Onboarding({
  state,
  prefs,
  onPrefs,
  dispatch,
  controlRef,
}: {
  state: AppState;
  prefs: DevicePrefs;
  onPrefs: (patch: Patch) => void;
  dispatch: (action: Action) => void;
  controlRef?: RefObject<OnboardingControl | null>;
}) {
  const [step, setStep] = useState<Step>("welcome");
  const [share, setShare] = useState(false);
  const [note, setNote] = useState("");
  const name = state.customer.firstName;
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
  };

  /** Writes the consent choice and closes the setup for good. */
  const complete = (sharing: boolean, sharedNote: string) => {
    if (sharing) {
      dispatch({
        type: "SET_SHARED_PREFERENCES",
        preferences: labelsFor(prefs.struggles),
        note: sharedNote,
      });
    }
    onPrefs({ onboarded: true, sharePreferences: sharing });
  };

  // Demo Director hooks. Assigned in an effect, never during render.
  useEffect(() => {
    if (!controlRef) return;
    controlRef.current = {
      pick: (ids) => {
        let current = prefs;
        let contact = state.customer.contactPreferences;
        const patch: Patch = {};
        for (const id of ids) {
          if (current.struggles.includes(id)) continue;
          const change = toggleStruggle(id, current, contact, DEVICE_DEFAULTS);
          Object.assign(patch, change.device);
          current = { ...current, ...change.device };
          if (change.contact) contact = { ...contact, ...change.contact };
        }
        onPrefs(patch);
        if (contact !== state.customer.contactPreferences) {
          dispatch({ type: "SET_CONTACT_PREFERENCES", preferences: contact });
        }
        setStep("pick");
      },
      finish: (sharing, sharedNote) => {
        setShare(sharing);
        setNote(sharedNote);
        setStep("done");
        if (sharing) {
          dispatch({
            type: "SET_SHARED_PREFERENCES",
            preferences: labelsFor(prefs.struggles),
            note: sharedNote,
          });
        }
        onPrefs({ sharePreferences: sharing });
      },
      open: () => onPrefs({ onboarded: true }),
    };
  });

  const changes = STRUGGLES.filter((s) => prefs.struggles.includes(s.id));

  return (
    <Panel bloom="calm" className="p-5" aria-labelledby="setup-heading" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <StatusPill tone="calm">New in the app</StatusPill>
        <span className="text-xs text-fg-3">
          {step === "welcome" ? "1" : step === "pick" ? "2" : step === "share" ? "3" : "4"} of 4
        </span>
      </div>

      {step === "welcome" ? (
        <>
          <h2 id="setup-heading" className="mt-3 text-2xl font-semibold text-fg">
            Hi {name}. Let&apos;s set the app up the way that works for you.
          </h2>
          <p className="mt-2 text-[0.9375rem] text-fg-2">
            You&apos;ll tick anything you find hard, and the app changes to suit
            you. No reasons, no diagnosis, nothing you tick is shared. It takes a
            minute, and you can change it any time in Settings.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                onPrefs({ textSize: prefs.textSize === "xlarge" ? "standard" : "xlarge" })
              }
            >
              {prefs.textSize === "xlarge" ? "Make the text smaller" : "Make the text bigger"}
            </Button>
          </div>
          <div className="mt-5 space-y-2">
            <Button size="lg" variant="calm" fullWidth onClick={() => setStep("pick")}>
              Let&apos;s start
            </Button>
            <Button size="md" variant="ghost" fullWidth onClick={() => complete(false, "")}>
              Skip — I&apos;ll use it as it is
            </Button>
          </div>
        </>
      ) : null}

      {step === "pick" ? (
        <>
          <h2 id="setup-heading" className="mt-3 text-xl font-semibold text-fg">
            What do you find hard? Pick any, or none.
          </h2>
          <p className="mt-1 text-sm text-fg-3">
            The app changes as you tick. Untick to undo.
          </p>
          <div className="mt-3">
            <StruggleChecklist selected={prefs.struggles} onToggle={toggle} />
          </div>
          <div className="mt-4 flex gap-2">
            <Button size="md" variant="ghost" onClick={() => setStep("welcome")}>
              Back
            </Button>
            <Button size="md" variant="calm" className="flex-1" onClick={() => setStep("share")}>
              {prefs.struggles.length ? "Next" : "None of these — next"}
            </Button>
          </div>
        </>
      ) : null}

      {step === "share" ? (
        <>
          <h2 id="setup-heading" className="mt-3 text-xl font-semibold text-fg">
            Share your preferences with your support team?
          </h2>
          {labels.length ? (
            <>
              <p className="mt-1 text-sm text-fg-3">
                If you do, this is exactly what they&apos;ll see:
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {labels.map((l) => (
                  <li key={l}>
                    <StatusPill tone="calm">{l}</StatusPill>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-1 text-sm text-fg-3">
              You didn&apos;t tick anything, so there are no preferences to share.
            </p>
          )}

          <label className="mt-4 flex min-h-11 items-center gap-3 text-[0.9375rem] font-medium text-fg">
            <input
              type="checkbox"
              checked={share}
              disabled={!labels.length}
              onChange={(e) => setShare(e.target.checked)}
              className="h-5 w-5 accent-[var(--color-calm)]"
            />
            Yes, share these with my support team
          </label>

          {share ? (
            <div className="mt-2">
              <label htmlFor="setup-note" className="block text-sm font-medium text-fg">
                Anything else they should know? (optional)
              </label>
              <textarea
                id="setup-note"
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 200))}
                rows={2}
                placeholder="e.g. Keep it short and tell me the one thing to do."
                className="mt-1.5 w-full resize-none rounded-xl border border-edge bg-glass p-3 text-[0.9375rem] text-fg placeholder:text-fg-3"
              />
            </div>
          ) : null}

          <div className="mt-3 rounded-xl border border-edge p-3 text-sm text-fg-2">
            <p>
              <strong className="font-semibold text-fg">Never shared:</strong> what
              you ticked as hard, and your reading and screen settings.
            </p>
            <p className="mt-1">
              <strong className="font-semibold text-fg">Always visible to support:</strong>{" "}
              your contact rules (like reminders), so they can follow them.
            </p>
          </div>

          <div className="mt-4 flex gap-2">
            <Button size="md" variant="ghost" onClick={() => setStep("pick")}>
              Back
            </Button>
            <Button
              size="md"
              variant="calm"
              className="flex-1"
              onClick={() => {
                if (share) {
                  dispatch({
                    type: "SET_SHARED_PREFERENCES",
                    preferences: labels,
                    note,
                  });
                }
                onPrefs({ sharePreferences: share });
                setStep("done");
              }}
            >
              {share ? "Share and continue" : "Don't share — continue"}
            </Button>
          </div>
        </>
      ) : null}

      {step === "done" ? (
        <>
          <h2 id="setup-heading" className="mt-3 text-xl font-semibold text-fg">
            All set.
          </h2>
          {changes.length ? (
            <ul className="mt-2 space-y-1.5 text-[0.9375rem] text-fg-2">
              {changes.map((s) => (
                <li key={s.id} className="flex gap-2">
                  <span aria-hidden="true" className="text-pos">
                    ✓
                  </span>
                  {s.effect}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[0.9375rem] text-fg-2">The app stays as it is.</p>
          )}
          <p className="mt-2 text-sm text-fg-3">
            {share
              ? "Your support team can see your preferences."
              : "Nothing was shared with your support team."}{" "}
            Change any of this in Settings &amp; help.
          </p>
          <Button
            size="lg"
            variant="calm"
            fullWidth
            className="mt-4"
            onClick={() => onPrefs({ onboarded: true })}
          >
            Open my app
          </Button>
        </>
      ) : null}
    </Panel>
  );
}
