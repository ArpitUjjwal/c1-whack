"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import {
  DIFFICULTY_LABEL,
  HELP_LABEL,
  NOT_SHARED,
  factsFor,
  toRequest,
  type AdvocateInputs,
} from "@/lib/advocate";
import { draftSupportRequest } from "@/lib/ai/client";
import { CHANNEL_LABEL } from "@/lib/contact";
import { profileConfig } from "@/lib/demo-data";
import { isoDaysFromToday, longDate, money, shortDate } from "@/lib/format";
import type { AppState, Difficulty, HelpWanted, SupportRequest } from "@/lib/types";

export interface AdvocateItem {
  label: string;
  amount: number;
  dueDate: string;
}

export interface AdvocateControl {
  /** Lets the Demo Director press Send without a pointer. */
  send: () => void;
}

type Step = "options" | "difficulty" | "help" | "details" | "drafting" | "review" | "help-info";

/**
 * "I can't manage this one right now."
 *
 * One choice per screen, then a review of exactly what will be shared, with
 * the "not shared" list beside it. Nothing leaves until the customer presses
 * Send. The Advocate prepares the administrative work; it never sends,
 * moves money, or asks for a concession on its own.
 *
 * `preset` (Demo Director) skips to the review with sensible answers, so the
 * audience sees the part that matters: what is, and isn't, shared.
 */
export function AdvocateSheet({
  state,
  item,
  preset = false,
  onClose,
  onSend,
  controlRef,
}: {
  state: AppState;
  item: AdvocateItem;
  preset?: boolean;
  onClose: () => void;
  onSend: (request: SupportRequest) => void;
  controlRef?: RefObject<AdvocateControl | null>;
}) {
  const prefs = state.customer.contactPreferences;
  const [step, setStep] = useState<Step>(preset ? "drafting" : "options");
  const [inputs, setInputs] = useState<AdvocateInputs>(() => ({
    item,
    // The Demo Director's preset answers differ by customer (see demo-data).
    difficulty: profileConfig(state.profileId).advocatePreset.difficulty,
    helpWanted: profileConfig(state.profileId).advocatePreset.helpWanted,
    canPay: null,
    contact: prefs.channel,
    keepRepliesShort: true,
  }));
  const [offerPart, setOfferPart] = useState(false);
  const [draft, setDraft] = useState<{ message: string; summary: string; source: "local" | "claude" } | null>(
    null,
  );

  const prepare = async (current: AdvocateInputs) => {
    setStep("drafting");
    const result = await draftSupportRequest(factsFor(state, current));
    setDraft(result);
    setStep("review");
  };

  /*
    A Send that arrives before the draft is ready (a presenter pressing → twice
    quickly) is remembered and honoured once the draft lands, rather than lost.
  */
  const pendingSend = useRef(false);

  // Preset: draft straight away. The state update happens after the await,
  // never synchronously in the effect body.
  useEffect(() => {
    if (!preset) return;
    let cancelled = false;
    draftSupportRequest(factsFor(state, inputs)).then((result) => {
      if (cancelled) return;
      if (pendingSend.current) {
        onSend(toRequest(inputs, result, result.source, state.credit.nickname));
        return;
      }
      setDraft(result);
      setStep("review");
    });
    return () => {
      cancelled = true;
    };
    // Runs once per mount; the sheet is re-keyed for every opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = () => {
    if (!draft) {
      pendingSend.current = true;
      return;
    }
    if (!draft.message.trim()) return;
    onSend(toRequest(inputs, draft, draft.source, state.credit.nickname));
  };

  useEffect(() => {
    if (!controlRef) return;
    controlRef.current = { send };
  });

  const payDates = [3, 7, 10, 14].map((d) => isoDaysFromToday(d));

  return (
    <Sheet
      open
      onClose={onClose}
      title={step === "review" ? "Check what you're sending" : "Let's sort this one out"}
      description={`${item.label} · ${money(item.amount)} · ${shortDate(item.dueDate)}`}
    >
      {step === "options" ? (
        <div className="space-y-2.5">
          <Button size="lg" variant="calm" fullWidth onClick={() => setStep("difficulty")}>
            Help me ask Capital One
          </Button>
          <Button size="md" variant="outline" fullWidth onClick={() => setStep("help-info")}>
            Show me free, independent help
          </Button>
          <p className="pt-1 text-sm text-fg-3">
            I&apos;ll prepare the request. You check it, and nothing is sent
            until you say so.
          </p>
        </div>
      ) : null}

      {step === "help-info" ? (
        <div className="space-y-3 text-[0.9375rem] text-fg-2">
          <p>
            <a className="font-semibold text-link underline" href="https://www.moneyhelper.org.uk" target="_blank" rel="noreferrer">
              MoneyHelper
            </a>{" "}
            — free, impartial guidance, backed by government.
          </p>
          <p>
            <a className="font-semibold text-link underline" href="https://www.stepchange.org" target="_blank" rel="noreferrer">
              StepChange
            </a>{" "}
            — free debt advice.
          </p>
          <Button size="md" variant="ghost" onClick={() => setStep("options")}>
            Back
          </Button>
        </div>
      ) : null}

      {step === "difficulty" ? (
        <Choice
          legend="What's getting in the way?"
          options={Object.entries(DIFFICULTY_LABEL) as [Difficulty, string][]}
          onPick={(difficulty) => {
            setInputs((i) => ({ ...i, difficulty }));
            setStep("help");
          }}
        />
      ) : null}

      {step === "help" ? (
        <Choice
          legend="What would help?"
          options={Object.entries(HELP_LABEL) as [HelpWanted, string][]}
          onPick={(helpWanted) => {
            setInputs((i) => ({ ...i, helpWanted }));
            setStep("details");
          }}
        />
      ) : null}

      {step === "details" ? (
        <div className="space-y-4">
          <label className="flex min-h-[44px] items-center gap-3 text-[0.9375rem] text-fg">
            <input
              type="checkbox"
              checked={offerPart}
              onChange={(e) => {
                setOfferPart(e.target.checked);
                setInputs((i) => ({
                  ...i,
                  canPay: e.target.checked ? { amount: 20, date: payDates[2] } : null,
                }));
              }}
              className="h-5 w-5 accent-[var(--color-calm)]"
            />
            I could pay some of it (optional)
          </label>
          {offerPart && inputs.canPay ? (
            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm text-fg-2">
                Amount (£)
                <input
                  type="number"
                  min={1}
                  max={item.amount}
                  value={inputs.canPay.amount}
                  onChange={(e) =>
                    setInputs((i) => ({
                      ...i,
                      canPay: { amount: Math.max(1, Number(e.target.value) || 1), date: i.canPay?.date ?? payDates[2] },
                    }))
                  }
                  className="tnum mt-1 min-h-[44px] w-full rounded-xl border border-edge bg-glass px-3 text-fg"
                />
              </label>
              <label className="text-sm text-fg-2">
                On
                <select
                  value={inputs.canPay.date}
                  onChange={(e) =>
                    setInputs((i) => ({
                      ...i,
                      canPay: { amount: i.canPay?.amount ?? 20, date: e.target.value },
                    }))
                  }
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-edge bg-glass px-3 text-fg"
                >
                  {payDates.map((d) => (
                    <option key={d} value={d}>
                      {shortDate(d)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          <p className="text-[0.9375rem] text-fg-2">
            Replies by <strong className="font-semibold text-fg">{CHANNEL_LABEL[inputs.contact].toLowerCase()}</strong>{" "}
            — from your contact rules.
          </p>
          <label className="flex min-h-[44px] items-center gap-3 text-[0.9375rem] text-fg">
            <input
              type="checkbox"
              checked={inputs.keepRepliesShort}
              onChange={(e) => setInputs((i) => ({ ...i, keepRepliesShort: e.target.checked }))}
              className="h-5 w-5 accent-[var(--color-calm)]"
            />
            Ask for short replies
          </label>

          <Button size="lg" variant="calm" fullWidth onClick={() => prepare(inputs)}>
            Prepare my request
          </Button>
        </div>
      ) : null}

      {step === "drafting" ? (
        <p aria-live="polite" className="py-6 text-center text-[0.9375rem] text-fg-2">
          Preparing your request…
        </p>
      ) : null}

      {step === "review" && draft ? (
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.12em] text-calm uppercase">
              This is exactly what Capital One will see
            </p>
            <label htmlFor="advocate-message" className="sr-only">
              Your message
            </label>
            <textarea
              id="advocate-message"
              value={draft.message}
              onChange={(e) => setDraft({ ...draft, message: e.target.value })}
              rows={5}
              className="mt-2 w-full resize-none rounded-xl border border-edge bg-glass p-3 text-[0.9375rem] leading-relaxed text-fg focus:border-link"
            />
            <dl className="mt-2 space-y-1 text-sm">
              <Row label="About" value={`${item.label} · ${money(item.amount)} · due ${longDate(item.dueDate)}`} />
              <Row label="Asking for" value={HELP_LABEL[inputs.helpWanted]} />
              <Row label="Reply by" value={`${CHANNEL_LABEL[inputs.contact]}${inputs.keepRepliesShort ? ", short" : ""}`} />
            </dl>
            <p className="mt-1.5 text-xs text-fg-3">
              Drafted by {draft.source === "claude" ? "Claude" : "the app"} from the
              answers you gave. Change anything you like.
            </p>
          </div>

          <div className="rounded-xl border border-edge p-3.5">
            <p className="text-xs font-semibold tracking-[0.12em] text-fg-3 uppercase">
              Not shared
            </p>
            <ul className="mt-1.5 space-y-1 text-sm text-fg-2">
              {NOT_SHARED.map((x) => (
                <li key={x}>— {x}</li>
              ))}
            </ul>
          </div>

          <p className="text-sm text-fg-3">
            Any change to your payment is decided by a person at Capital One,
            under its normal policies. Nothing changes until you agree to it.
          </p>

          <div className="space-y-2">
            <Button size="lg" variant="calm" fullWidth onClick={send} disabled={!draft.message.trim()}>
              Send to Capital One
            </Button>
            <Button size="md" variant="ghost" fullWidth onClick={onClose}>
              Not now
            </Button>
          </div>
        </div>
      ) : null}
    </Sheet>
  );
}

function Choice<T extends string>({
  legend,
  options,
  onPick,
}: {
  legend: string;
  options: [T, string][];
  onPick: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="text-[0.9375rem] font-semibold text-fg">{legend}</legend>
      <div className="mt-3 space-y-2">
        {options.map(([value, label]) => (
          <Button key={value} size="md" variant="outline" fullWidth onClick={() => onPick(value)}>
            {label}
          </Button>
        ))}
      </div>
    </fieldset>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-fg-3">{label}</dt>
      <dd className="text-right text-fg-2">{value}</dd>
    </div>
  );
}
