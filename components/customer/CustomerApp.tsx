"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccountsPanel } from "./AccountsPanel";
import { AdvocateSheet, type AdvocateControl, type AdvocateItem } from "./AdvocateSheet";
import { AllClearCard } from "./AllClearCard";
import { BottomNav, type CustomerTab } from "./BottomNav";
import { CatchUpWidget } from "./CatchUpWidget";
import { ComingUp } from "./ComingUp";
import { CustomerActivity } from "./CustomerActivity";
import { CustomerHeader } from "./CustomerHeader";
import { FocusOffer } from "./FocusOffer";
import { HelpPanel } from "./HelpPanel";
import { NudgeStack } from "./NudgeStack";
import { PhoneFrame } from "./PhoneFrame";
import { SafeToSpendCard } from "./SafeToSpendCard";
import { SuccessOverlay } from "./SuccessOverlay";
import { SupportStatusCard } from "./SupportStatusCard";
import { TimeMachine } from "./TimeMachine";
import { Tip } from "./Tip";
import { WelcomeBack } from "./WelcomeBack";
import { Onboarding, type OnboardingControl } from "./Onboarding";
import { DemoDirector } from "@/components/system/DemoDirector";
import { JudgeOverlay } from "@/components/system/JudgeOverlay";
import { Button } from "@/components/ui/Button";
import { CardTile } from "@/components/ui/CardTile";
import { remindersFor } from "@/lib/reminders";
import { IN_APP_TIPS } from "@/lib/insights-data";
import { profileConfig, startingDevicePrefs } from "@/lib/demo-data";
import { useDevicePrefs } from "@/lib/device";
import { FOCUS_OFFER_THRESHOLD } from "@/lib/engines/signals";
import { money } from "@/lib/format";
import { reduce } from "@/lib/reducer";
import { useRealtimeSync } from "@/lib/realtime";
import { selectActiveNudges, selectSafeToSpend } from "@/lib/selectors";
import { useCognitiveMonitor } from "@/lib/useCognitiveMonitor";
import type { Action, AppState, Nudge } from "@/lib/types";

/** The break length the Time Machine opens on. */
const DEFAULT_BREAK_DAYS = 7;

export function CustomerApp() {
  const { state, dispatch, setView, agentOnline, hydrated, now, onSignal } = useRealtimeSync();
  const [tab, setTab] = useState<CustomerTab>("home");
  const [celebration, setCelebration] = useState<{
    headline: string;
    body: string;
  } | null>(null);
  const [breakDays, setBreakDays] = useState(DEFAULT_BREAK_DAYS);
  const [showMessages, setShowMessages] = useState(false);
  const [advocate, setAdvocate] = useState<{
    item: AdvocateItem;
    preset: boolean;
    key: number;
  } | null>(null);
  const advocateControl = useRef<AdvocateControl | null>(null);

  /*
    Safe Mode, the welcome-back card and the adaptive switch are device-local.
    They never enter shared state, so the bank cannot see them.
  */
  const [prefs, updatePrefs] = useDevicePrefs(
    state.epoch,
    startingDevicePrefs(state.profileId),
  );
  const safeMode = prefs.safeMode;

  const mainRef = useRef<HTMLElement>(null);

  /* ------------------------------------------- on-device strain, offer only */
  const { collector, strain: strainReading } = useCognitiveMonitor({
    rootRef: mainRef,
    daysSinceLastOpen: state.customer.daysSinceLastOpen,
    enabled: prefs.adaptiveEnabled,
  });
  const strain = strainReading?.score ?? 0;

  /*
    What shows first, in order: the one-time setup, then the welcome-back
    summary (even if Safe Mode is on — it is calm and short), then Safe Mode
    or the full app.
  */
  const setupDone = prefs.onboarded;
  const welcomeBack =
    setupDone && !prefs.welcomeBackSeen && state.customer.daysSinceLastOpen >= 7;
  const onboardingControl = useRef<OnboardingControl | null>(null);

  /*
    The offer is derived, not stored: it appears while strain is high and
    vanishes when it settles. Declining it is remembered on this device and
    the app never asks again. Nothing about the offer is logged or shared.
  */
  const showFocusOffer =
    setupDone &&
    prefs.adaptiveEnabled &&
    !safeMode &&
    !welcomeBack &&
    !prefs.focusDeclined &&
    strain >= FOCUS_OFFER_THRESHOLD &&
    tab === "home";

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
  const reminders = useMemo(() => remindersFor(state), [state]);
  const openCase = useMemo(
    () => [...state.supportCases].reverse().find((c) => c.status !== "resolved") ?? null,
    [state.supportCases],
  );

  /* The 14-day gap closes the moment this surface comes online. */
  useEffect(() => {
    if (!hydrated) return;
    dispatch({ type: "CUSTOMER_CAME_ONLINE" });
  }, [hydrated, dispatch]);

  /*
    Presence says only "in the app". Which screen Alex is on — the Time
    Machine, Safe Mode — is not the bank's business, so it is never sent.
  */
  useEffect(() => {
    setView("In the app");
  }, [setView]);

  useEffect(() => {
    if (unseenNudges === 0 || safeMode || welcomeBack || !setupDone) return;
    const t = window.setTimeout(() => dispatch({ type: "MARK_NUDGES_SEEN" }), 1800);
    return () => window.clearTimeout(t);
  }, [unseenNudges, safeMode, welcomeBack, setupDone, dispatch]);

  const cardItem: AdvocateItem | null =
    state.credit.status === "overdue" && state.credit.minimumDue > 0
      ? { label: "Card minimum", amount: state.credit.minimumDue, dueDate: state.credit.dueDate }
      : null;

  const openAdvocate = useCallback((item: AdvocateItem, preset = false) => {
    setAdvocate({ item, preset, key: Date.now() });
  }, []);

  /*
    "Starting money tasks, or too much on screen" promises the app *opens* in
    Safe Mode. So on each fresh open (once per page load), Safe Mode comes back
    on while that choice is ticked — even if it was switched off last visit.
    Within a visit, "Show me everything again" is respected.
  */
  const openedInSafeMode = useRef(false);
  useEffect(() => {
    if (openedInSafeMode.current || !hydrated || !setupDone) return;
    openedInSafeMode.current = true;
    if (prefs.struggles.includes("overwhelmed") && !prefs.safeMode) {
      updatePrefs({ safeMode: true });
    }
  }, [hydrated, setupDone, prefs.struggles, prefs.safeMode, updatePrefs]);

  const enterSafeMode = useCallback(() => {
    updatePrefs({ safeMode: true, welcomeBackSeen: true });
    setTab("home");
  }, [updatePrefs]);

  /* Demo Director instructions. Handlers run from the listener, not render. */
  const latest = useRef({ cardItem, enterSafeMode, openAdvocate, profileId: state.profileId });
  useEffect(() => {
    latest.current = { cardItem, enterSafeMode, openAdvocate, profileId: state.profileId };
  });
  useEffect(
    () =>
      onSignal((signal) => {
        if (signal.type !== "demo_action") return;
        const l = latest.current;
        switch (signal.action) {
          case "enter_safe_mode":
            l.enterSafeMode();
            break;
          case "time_machine_week":
            setBreakDays(DEFAULT_BREAK_DAYS);
            break;
          case "advocate_open":
            if (l.cardItem) l.openAdvocate(l.cardItem, true);
            break;
          case "advocate_send":
            advocateControl.current?.send();
            break;
          case "setup_pick": {
            const demo = profileConfig(l.profileId).demoSetup;
            if (demo) onboardingControl.current?.pick(demo.struggles);
            break;
          }
          case "setup_open":
            onboardingControl.current?.open();
            break;
          case "setup_finish": {
            const demo = profileConfig(l.profileId).demoSetup;
            if (demo) onboardingControl.current?.finish(demo.share, demo.note);
            break;
          }
          default:
            break;
        }
      }),
    [onSignal],
  );

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

  /* ----------------------------------------------------- the one thing -- */

  const theOneThing = openCase ? (
    <SupportStatusCard
      state={state}
      supportCase={openCase}
      safeAfterPayment={safeAfterPayment}
      onPay={(amount) => resolve({ type: "PAY_CREDIT", amount })}
      onAcceptArrangement={() => resolve({ type: "ACCEPT_EXTENSION" })}
    />
  ) : cardItem ? (
    <CatchUpWidget
      state={state}
      safeNow={safe.available}
      safeAfterPayment={safeAfterPayment}
      focusMode={safeMode}
      onPay={(amount) => resolve({ type: "PAY_CREDIT", amount })}
      onAcceptExtension={() => resolve({ type: "ACCEPT_EXTENSION" })}
      onAcceptSplit={() => resolve({ type: "ACCEPT_SPLIT_PLAN" })}
      onNeedHelp={() => openAdvocate(cardItem)}
      onDisclosureToggle={noteDisclosure}
    />
  ) : (
    <AllClearCard
      state={state}
      onEnableAutopay={() => resolve({ type: "ENABLE_AUTOPAY" })}
    />
  );

  const timeMachine = (
    <TimeMachine
      state={state}
      days={breakDays}
      onDaysChange={setBreakDays}
      onCantManage={(item) =>
        openAdvocate({ label: item.label, amount: item.amount, dueDate: item.dueDate })
      }
    />
  );

  const quietNudges = safeMode || welcomeBack || !setupDone;

  /* Tips the Insights report recommends. Shown to everyone; closing one sticks. */
  const showTip = (id: string) => !prefs.dismissedTips.includes(id);
  const dismissTip = (id: string) =>
    updatePrefs({ dismissedTips: [...prefs.dismissedTips, id] });
  const reminderTip =
    !state.customer.contactPreferences.remindDaysBefore && showTip(IN_APP_TIPS.reminders.id) ? (
      <Tip
        text={IN_APP_TIPS.reminders.text}
        onDismiss={() => dismissTip(IN_APP_TIPS.reminders.id)}
      />
    ) : null;

  return (
    <PhoneFrame reading={prefs}>
      <a
        href="#customer-main"
        className="sr-only-focusable absolute top-2 left-2 z-50 rounded-lg bg-fg px-3 py-2 text-sm font-semibold text-void"
      >
        Skip to main content
      </a>

      <CustomerHeader
        state={state}
        agentOnline={agentOnline}
        unseenNudges={quietNudges ? 0 : unseenNudges}
        compact={safeMode || !setupDone}
      />

      <main
        id="customer-main"
        ref={mainRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-1 pb-28"
      >
        {!setupDone ? (
          /* ------------------------------------------ first-run setup -- */
          <Onboarding
            state={state}
            prefs={prefs}
            onPrefs={updatePrefs}
            dispatch={dispatch}
            controlRef={onboardingControl}
          />
        ) : safeMode && !welcomeBack ? (
          /* --------------------------------------------------- Safe Mode -- */
          <motion.div
            key="safe"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-4"
          >
            <div className="rounded-xl border border-calm/25 bg-calm-dim px-4 py-3">
              <p className="font-semibold text-fg">Safe Mode · just what matters</p>
              <p className="mt-0.5 text-sm text-fg-2">
                Everything else is paused, not gone. Only you can see this is on.
              </p>
            </div>

            <div aria-live="polite">{theOneThing}</div>
            <ComingUp reminders={reminders} />
            {timeMachine}

            {activeNudges.length > 0 ? (
              <div>
                <Button
                  variant="ghost"
                  size="md"
                  fullWidth
                  onClick={() => setShowMessages((v) => !v)}
                >
                  {showMessages
                    ? "Hide messages"
                    : `${activeNudges.length} message${activeNudges.length === 1 ? "" : "s"} — read when you like`}
                </Button>
              </div>
            ) : null}

            <Button
              variant="outline"
              size="md"
              fullWidth
              onClick={() => updatePrefs({ safeMode: false })}
            >
              Show me everything again
            </Button>
          </motion.div>
        ) : (
          /* ----------------------------------------------- full surface -- */
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={welcomeBack ? "welcome" : tab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="space-y-3"
            >
              {welcomeBack ? (
                <WelcomeBack
                  state={state}
                  onContinue={() => updatePrefs({ welcomeBackSeen: true })}
                  onSafeMode={enterSafeMode}
                />
              ) : null}

              {!welcomeBack && tab === "home" ? (
                <>
                  <h2 className="sr-only">At a glance</h2>

                  {/*
                    The card first, the way the real app opens — the object you
                    carry, with what is owed on it. Everything below is this
                    account explained; leading with the figure alone left the
                    screen starting mid-sentence.
                  */}
                  <CardTile
                    name={state.credit.nickname}
                    last4={state.credit.accountNumber.slice(-4)}
                    balance={money(state.credit.balance)}
                    caption="Current balance"
                  />

                  <Button variant="outline" size="md" fullWidth onClick={enterSafeMode}>
                    I can&apos;t handle banking today
                  </Button>

                  <FocusOffer
                    open={showFocusOffer}
                    onAccept={enterSafeMode}
                    onDecline={() => updatePrefs({ focusDeclined: true })}
                  />

                  <SafeToSpendCard safe={safe} onDisclosureToggle={noteDisclosure} />
                  {/* Announces when the one thing changes — e.g. the bank's reply arriving. */}
                  <div aria-live="polite">{theOneThing}</div>
                  <ComingUp reminders={reminders} />
                  <CustomerActivity
                    events={state.timeline}
                    now={now}
                    hydrated={hydrated}
                  />

                  <div className="px-1 pt-1 text-xs text-fg-3">
                    <p>Prototype of Capital One Adaptive Support.</p>
                    <Link
                      href="/bank"
                      className="inline-flex min-h-[44px] items-center font-medium text-link underline"
                    >
                      Open the Care Centre in a second window
                    </Link>
                  </div>
                </>
              ) : null}

              {!welcomeBack && tab === "ahead" ? (
                <>
                  {reminderTip}
                  {timeMachine}
                </>
              ) : null}

              {!welcomeBack && tab === "accounts" ? (
                <AccountsPanel state={state} onDisclosureToggle={noteDisclosure} />
              ) : null}

              {!welcomeBack && tab === "help" ? (
                <HelpPanel
                  state={state}
                  dispatch={dispatch}
                  agentOnline={agentOnline}
                  adaptiveEnabled={prefs.adaptiveEnabled}
                  onToggleAdaptive={(on) => updatePrefs({ adaptiveEnabled: on })}
                  prefs={prefs}
                  onChangePrefs={updatePrefs}
                  onMessageAgent={(text) =>
                    dispatch({
                      type: "AGENT_NOTE",
                      text: `Message from ${state.customer.firstName}: “${text}”`,
                    })
                  }
                />
              ) : null}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      {/* Non-essential messages wait in Safe Mode and on the welcome-back screen. */}
      {!quietNudges || showMessages ? (
        <NudgeStack
          nudges={activeNudges}
          onDismiss={(id) => dispatch({ type: "DISMISS_NUDGE", id })}
          onAction={handleNudgeAction}
        />
      ) : null}

      {/* Safe Mode hides navigation: one screen, one plan. */}
      {setupDone && !safeMode && !welcomeBack ? (
        <BottomNav active={tab} onChange={setTab} />
      ) : null}

      {advocate ? (
        <AdvocateSheet
          key={advocate.key}
          state={state}
          item={advocate.item}
          preset={advocate.preset}
          controlRef={advocateControl}
          onClose={() => setAdvocate(null)}
          onSend={(request) => {
            dispatch({ type: "REQUEST_SUPPORT", request });
            setAdvocate(null);
            setTab("home");
          }}
        />
      ) : null}

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
          ? `${safeMode ? "Safe Mode on. Showing just what matters. " : ""}Safe to spend: ${money(safe.available)}.`
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
