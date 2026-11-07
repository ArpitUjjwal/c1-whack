import type { Action, Actor, AppState, TimelineEvent } from "./types";
import { createInitialState } from "./demo-data";
import { isoDaysFromToday, longDate, money } from "./format";

let counter = 0;
/** Collision-resistant enough for a demo, and stable across both tabs. */
function uid(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

function log(
  state: AppState,
  actor: Actor,
  title: string,
  detail?: string,
  highlight = false,
): TimelineEvent[] {
  const event: TimelineEvent = {
    id: uid("tl"),
    actor,
    title,
    detail,
    at: Date.now(),
    highlight,
  };
  // Newest last; the console reverses for display.
  return [...state.timeline, event];
}

/**
 * The single reducer both surfaces dispatch into. It is pure, so applying the
 * same action in either tab produces the same state — which is what makes
 * full-state broadcast safe.
 */
export function reduce(state: AppState, action: Action): AppState {
  const next = (patch: Partial<AppState>): AppState => ({
    ...state,
    ...patch,
    rev: state.rev + 1,
  });

  switch (action.type) {
    case "CUSTOMER_CAME_ONLINE": {
      if (state.customer.openedAppToday) return state;
      return next({
        customer: { ...state.customer, openedAppToday: true },
        timeline: log(
          state,
          "customer",
          "Alex opened the app",
          `First session in ${state.customer.daysSinceLastOpen} days.`,
          true,
        ),
      });
    }

    case "CUSTOMER_VIEWED": {
      return next({
        timeline: log(state, "customer", `Opened ${action.view}`),
      });
    }

    case "PAY_CREDIT": {
      const amount = Math.min(action.amount, state.checking.balance);
      const newCreditBalance = Math.max(0, state.credit.balance - amount);
      const clearedOverdue = amount >= state.credit.minimumDue;

      return next({
        checking: {
          ...state.checking,
          balance: Math.round((state.checking.balance - amount) * 100) / 100,
        },
        credit: {
          ...state.credit,
          balance: Math.round(newCreditBalance * 100) / 100,
          status: clearedOverdue ? "current" : state.credit.status,
          daysOverdue: clearedOverdue ? 0 : state.credit.daysOverdue,
          minimumDue: clearedOverdue ? 0 : state.credit.minimumDue - amount,
        },
        flags: {
          ...state.flags,
          caughtUp: clearedOverdue ? true : state.flags.caughtUp,
          winsCount: state.flags.winsCount + 1,
        },
        timeline: log(
          state,
          "customer",
          `Paid ${money(amount)} to the credit card`,
          clearedOverdue
            ? "Account is no longer past due. Resolved by the customer, unassisted."
            : "Partial payment received.",
        ),
      });
    }

    case "ENABLE_AUTOPAY": {
      if (state.flags.autopayEnabled) return state;
      return next({
        flags: {
          ...state.flags,
          autopayEnabled: true,
          winsCount: state.flags.winsCount + 1,
        },
        timeline: log(
          state,
          "customer",
          "Turned on automatic minimum payments",
          "Removes the need to remember the due date at all.",
        ),
      });
    }

    case "SEND_NUDGE": {
      return next({
        nudges: [
          ...state.nudges,
          {
            ...action.nudge,
            id: uid("nudge"),
            createdAt: Date.now(),
            seen: false,
            dismissed: false,
          },
        ],
        timeline: log(
          state,
          "agent",
          `Sent a gentle message: "${action.nudge.title}"`,
          action.nudge.body,
        ),
      });
    }

    case "MARK_NUDGES_SEEN": {
      if (state.nudges.every((n) => n.seen)) return state;
      return next({
        nudges: state.nudges.map((n) => ({ ...n, seen: true })),
      });
    }

    case "DISMISS_NUDGE": {
      return next({
        nudges: state.nudges.map((n) =>
          n.id === action.id ? { ...n, dismissed: true, seen: true } : n,
        ),
      });
    }

    case "OFFER_EXTENSION": {
      return next({
        credit: { ...state.credit, extendedDueDate: action.newDueDate },
        flags: { ...state.flags, extensionOffered: true },
        timeline: log(
          state,
          "agent",
          "Offered a payment extension",
          `New due date proposed: ${longDate(action.newDueDate)}. Waiting on Alex to accept.`,
        ),
      });
    }

    case "ACCEPT_EXTENSION": {
      return next({
        credit: {
          ...state.credit,
          status: "extended",
          dueDate: state.credit.extendedDueDate ?? isoDaysFromToday(14),
          daysOverdue: 0,
        },
        flags: {
          ...state.flags,
          extensionAccepted: true,
          winsCount: state.flags.winsCount + 1,
        },
        timeline: log(
          state,
          "customer",
          "Accepted the payment extension",
          "No longer reported as past due. Pressure removed.",
        ),
      });
    }

    case "OFFER_SPLIT_PLAN": {
      return next({
        flags: { ...state.flags, splitPlanOffered: true },
        timeline: log(
          state,
          "agent",
          "Offered to split the payment into 3 smaller pieces",
          "Smaller amounts are easier to start. Waiting on Alex.",
        ),
      });
    }

    case "ACCEPT_SPLIT_PLAN": {
      const first = Math.round((state.credit.minimumDue / 3) * 100) / 100;
      return next({
        checking: {
          ...state.checking,
          balance: Math.round((state.checking.balance - first) * 100) / 100,
        },
        credit: {
          ...state.credit,
          status: "split_plan",
          daysOverdue: 0,
          balance: Math.round((state.credit.balance - first) * 100) / 100,
        },
        flags: {
          ...state.flags,
          splitPlanAccepted: true,
          winsCount: state.flags.winsCount + 1,
        },
        timeline: log(
          state,
          "customer",
          "Started the 3-part payment plan",
          `First piece of ${money(first)} paid now. Two more scheduled.`,
        ),
      });
    }

    case "WAIVE_LATE_FEE": {
      if (state.credit.lateFeeWaived) return state;
      return next({
        credit: { ...state.credit, lateFeeWaived: true },
        timeline: log(
          state,
          "agent",
          `Waived the ${money(state.credit.lateFee)} late fee`,
          "One-time courtesy applied to the account.",
        ),
      });
    }

    case "AGENT_NOTE": {
      return next({
        timeline: log(state, "agent", "Agent note", action.text),
      });
    }

    case "OFFER_FOCUS": {
      return next({
        ui: { ...state.ui, focusOffers: state.ui.focusOffers + 1 },
        timeline: log(
          state,
          "system",
          "Offered Focus Mode",
          "Interaction strain crossed the threshold. The offer is advisory \u2014 Alex decides.",
        ),
      });
    }

    case "SET_FOCUS_MODE": {
      if (state.ui.focusMode === action.on) return state;
      return next({
        ui: { ...state.ui, focusMode: action.on },
        timeline: log(
          state,
          "customer",
          action.on ? "Turned on Focus Mode" : "Turned off Focus Mode",
          action.on
            ? "Screen reduced to one decision. Everything else is still one tap away."
            : "Back to the full screen, by choice.",
        ),
      });
    }

    case "DECLINE_FOCUS": {
      if (state.ui.focusDeclined) return state;
      return next({
        ui: { ...state.ui, focusDeclined: true },
        timeline: log(
          state,
          "customer",
          "Declined Focus Mode",
          "The app will not offer it again. The customer's preference wins over the model.",
        ),
      });
    }

    case "DEMO_SET_BEAT": {
      // Director position is shared state so both windows show the same beat.
      // It is deliberately not logged \u2014 it is presentation, not account history.
      return next({ demo: { beat: action.beat, active: action.active } });
    }

    case "RESET_DEMO": {
      return { ...createInitialState(), rev: state.rev + 1 };
    }

    default:
      return state;
  }
}
