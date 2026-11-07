"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccountsPanel } from "./AccountsPanel";
import { AllClearCard } from "./AllClearCard";
import { BottomNav, type CustomerTab } from "./BottomNav";
import { CatchUpWidget } from "./CatchUpWidget";
import { CustomerActivity } from "./CustomerActivity";
import { CustomerHeader } from "./CustomerHeader";
import { FocusOffer } from "./FocusOffer";
import { HelpPanel } from "./HelpPanel";
import { NudgeStack } from "./NudgeStack";
import { PhoneFrame } from "./PhoneFrame";
import { SafeToSpendCard } from "./SafeToSpendCard";
import { SuccessOverlay } from "./SuccessOverlay";
import { DemoDirector } from "@/components/system/DemoDirector";
import { JudgeOverlay } from "@/components/system/JudgeOverlay";
import { Button } from "@/components/ui/Button";
import { FOCUS_OFFER_THRESHOLD } from "@/lib/engines/signals";
import { money } from "@/lib/format";
import { reduce } from "@/lib/reducer";
import { useRealtimeSync } from "@/lib/realtime";
import { selectActiveNudges, selectSafeToSpend } from "@/lib/selectors";
import { useCognitiveMonitor } from "@/lib/useCognitiveMonitor";
import type { Action, AppState, Nudge } from "@/lib/types";

const TAB_LABEL: Record<CustomerTab, string> = {
  home: "Home",
  accounts: "Accounts",
  help: "Help",
};

export function CustomerApp() {
  const { state, dispatch, setView, agentOnline, hydrated, now } = useRealtimeSync();
  const [tab, setTab] = useState<CustomerTab>("home");
  const [celebration, setCelebration] = useState<{
    headline: string;
    body: string;
  } | null>(null);

  const mainRef = useRef<HTMLElement>(null);
  const focusMode = state.ui.focusMode;

  /* ------------------------------------------------ cognitive monitoring */
  const adaptive = state.ui.adaptiveEnabled;
  const { collector, strain: strainReading } = useCognitiveMonitor({
    rootRef: mainRef,
    daysSinceLastOpen: state.customer.daysSinceLastOpen,
    focusMode,
    view: TAB_LABEL[tab],
    enabled: adaptive,
  });

  // Read on this device only. It is never published to the agent console.
  const strain = strainReading?.score ?? 0;

  /*
    The offer is derived, not stored: it appears while strain is high and
    vanishes when it settles. Declining it writes `focusDeclined`, which is
    persisted — the app then never asks again, on this or any later session.
  */
  const showFocusOffer =
    adaptive &&
    !focusMode &&
    !state.ui.focusDeclined &&
    strain >= FOCUS_OFFER_THRESHOLD &&
    tab === "home";

  // Record the offer once, so the console can see it happened.
  const offerLoggedRef = useRef(false);
  useEffect(() => {
    if (!showFocusOffer || offerLoggedRef.current) return;
    offerLoggedRef.current = true;
    dispatch({ type: "OFFER_FOCUS" });
  }, [showFocusOffer, dispatch]);

  /* ----------------------------------------------------------- selectors */
  const safe = useMemo(() => selectSafeToSpend(state), [state]);

  /**
   * What Safe-to-Spend becomes if the minimum is paid right now. Derived by
   * running the real reducer against a copy of state, so the preview can
   * never drift from what actually happens on confirm.
   */
  const safeAfterPayment = useMemo(
    () =>
      selectSafeToSpend(
        reduce(state, { type: "PAY_CREDIT", amount: state.credit.minimumDue }),
      ).available,
    [state],
  );

  const activeNudges = useMemo(() => selectActiveNudges(state), [state]);
  const unseenNudges = activeNudges.filter((n) => !n.seen).length;

  /* The 14-day gap closes the moment this surface comes online. */
  useEffect(() => {
    if (!hydrated) return;
    dispatch({ type: "CUSTOMER_CAME_ONLINE" });
  }, [hydrated, dispatch]);

  useEffect(() => {
    setView(TAB_LABEL[tab]);
  }, [tab, setView]);

  useEffect(() => {
    if (unseenNudges === 0) return;
    const t = window.setTimeout(() => dispatch({ type: "MARK_NUDGES_SEEN" }), 1800);
    return () => window.clearTimeout(t);
  }, [unseenNudges, dispatch]);

  /**
   * Celebrate on the action that earned it, rather than by watching state for
   * a counter to move. `reduce` runs once as a preview so the wording can
   * describe the state the customer is about to land in.
   */
  const resolve = useCallback(
    (action: Action) => {
      const projected = reduce(state, action);
      dispatch(action);
      setCelebration(celebrationFor(projected));
      setTab("home");
    },
    [state, dispatch],
  );

  const handleNudgeAction = useCallback(
    (nudge: Nudge) => {
      switch (nudge.action) {
        case "accept_extension":
          resolve({ type: "ACCEPT_EXTENSION" });
          break;
        case "accept_split":
          resolve({ type: "ACCEPT_SPLIT_PLAN" });
          break;
        case "focus_catchup":
          setTab("home");
          break;
        default:
          break;
      }
      dispatch({ type: "DISMISS_NUDGE", id: nudge.id });
    },
    [dispatch, resolve],
  );

  const noteDisclosure = useCallback(() => {
    collector?.recordDisclosureToggle(Date.now());
  }, [collector]);

  const needsCatchUp = state.credit.status === "overdue";

  /* --------------------------------------------------------------- focus */

  const theOneThing = needsCatchUp ? (
    <CatchUpWidget
      state={state}
      safeNow={safe.available}
      safeAfterPayment={safeAfterPayment}
      focusMode={focusMode}
      onPay={(amount) => resolve({ type: "PAY_CREDIT", amount })}
      onAcceptExtension={() => resolve({ type: "ACCEPT_EXTENSION" })}
      onAcceptSplit={() => resolve({ type: "ACCEPT_SPLIT_PLAN" })}
      onAskForTime={() =>
        dispatch({
          type: "AGENT_NOTE",
          text: "Alex asked for more time from the app. Nobody has replied yet.",
        })
      }
      onDisclosureToggle={noteDisclosure}
    />
  ) : (
    <AllClearCard
      state={state}
      onEnableAutopay={() => resolve({ type: "ENABLE_AUTOPAY" })}
    />
  );

  return (
    <PhoneFrame>
      <a
        href="#customer-main"
        className="sr-only-focusable absolute top-2 left-2 z-50 rounded-lg bg-fg px-3 py-2 text-sm font-semibold text-void"
      >
        Skip to main content
      </a>

      <CustomerHeader
        state={state}
        agentOnline={agentOnline}
        unseenNudges={unseenNudges}
        compact={focusMode}
      />

      <main
        id="customer-main"
        ref={mainRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-1 pb-28"
      >
        {focusMode ? (
          /* ------------------------------------------------- Focus Mode -- */
          <motion.div
            key="focus"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-4"
          >
            <p className="tnum px-1 text-sm text-fg-3">
              Safe to spend:{" "}
              <strong className="font-semibold text-fg-2">
                {money(safe.available)}
              </strong>
            </p>

            {theOneThing}

            <Button
              variant="ghost"
              size="md"
              fullWidth
              onClick={() => dispatch({ type: "SET_FOCUS_MODE", on: false })}
            >
              Show me everything again
            </Button>

            <p className="px-1 text-xs text-fg-3">
              Focus Mode hides the rest of the app. Nothing has been changed or
              deleted, and your accounts are exactly as they were.
            </p>
          </motion.div>
        ) : (
          /* ----------------------------------------------- full surface -- */
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="space-y-3"
            >
              {tab === "home" ? (
                <>
                  <h2 className="sr-only">Home</h2>

                  <FocusOffer
                    open={showFocusOffer}
                    onAccept={() => dispatch({ type: "SET_FOCUS_MODE", on: true })}
                    onDecline={() => dispatch({ type: "DECLINE_FOCUS" })}
                  />

                  <SafeToSpendCard safe={safe} onDisclosureToggle={noteDisclosure} />
                  {theOneThing}
                  <CustomerActivity
                    events={state.timeline}
                    now={now}
                    hydrated={hydrated}
                  />

                  <p className="px-1 pt-1 text-xs text-fg-3">
                    Prototype for the “Make Credit Accessible” challenge. Open{" "}
                    <Link href="/bank" className="font-medium text-link underline">
                      the care console
                    </Link>{" "}
                    in a second window to see both sides sync.
                  </p>
                </>
              ) : null}

              {tab === "accounts" ? (
                <AccountsPanel state={state} onDisclosureToggle={noteDisclosure} />
              ) : null}

              {tab === "help" ? (
                <HelpPanel
                  state={state}
                  dispatch={dispatch}
                  agentOnline={agentOnline}
                  onMessageAgent={(text) =>
                    dispatch({
                      type: "AGENT_NOTE",
                      text: `Message from Alex: “${text}”`,
                    })
                  }
                />
              ) : null}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <NudgeStack
        nudges={activeNudges}
        onDismiss={(id) => dispatch({ type: "DISMISS_NUDGE", id })}
        onAction={handleNudgeAction}
      />

      {/* Focus Mode hides navigation: one screen, one decision. */}
      {!focusMode ? <BottomNav active={tab} onChange={setTab} /> : null}

      <SuccessOverlay
        open={celebration !== null && state.flags.winsCount > 0}
        headline={celebration?.headline ?? ""}
        body={celebration?.body ?? ""}
        winsCount={state.flags.winsCount}
        onClose={() => setCelebration(null)}
      />

      {/* Presentation chrome. Excluded from every measurement the app makes. */}
      <DemoDirector role="customer" />
      <JudgeOverlay role="customer" measureRoot="#customer-main" strain={strainReading} />

      {/* Spoken announcements. Polite, so nothing interrupts mid-sentence. */}
      <p aria-live="polite" className="sr-only">
        {hydrated
          ? `${focusMode ? "Focus Mode on. Showing one thing at a time. " : ""}Safe to spend: ${money(safe.available)}.`
          : ""}
      </p>
    </PhoneFrame>
  );
}

/** Celebration wording for the state an action lands the customer in. */
function celebrationFor(next: AppState): { headline: string; body: string } {
  if (next.flags.autopayEnabled && next.credit.status === "current") {
    return {
      headline: "Handled, for good.",
      body: "We'll pay the minimum for you every month. One less thing to hold in your head.",
    };
  }
  switch (next.credit.status) {
    case "current":
      return {
        headline: "That's sorted.",
        body: "Your card is up to date and nothing is past due. You did that in one tap.",
      };
    case "extended":
      return {
        headline: "You've got more time.",
        body: "Nothing is late, no fee, and we'll remind you gently before the new date.",
      };
    case "split_plan":
      return {
        headline: "First piece done.",
        body: "The next two are scheduled and will pay themselves. Nothing else to do.",
      };
    default:
      return { headline: "Nice work.", body: "That's one thing off your plate." };
  }
}
