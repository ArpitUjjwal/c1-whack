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
      const amount = Math.min(action.amount, state.current.balance);
      const newCreditBalance = Math.max(0, state.credit.balance - amount);
      const clearedOverdue = amount >= state.credit.minimumDue;

      return next({
        current: {
          ...state.current,
          balance: Math.round((state.current.balance - amount) * 100) / 100,
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
          "Set up a Direct Debit for the minimum",
          "Removes the need to remember the payment date at all.",
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
        contactLog: [
          ...state.contactLog,
          { channel: "in_app", at: Date.now(), by: "agent" },
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
          "New payment date agreed. No extra fee for the extra time.",
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
        current: {
          ...state.current,
          balance: Math.round((state.current.balance - first) * 100) / 100,
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

    case "REFUND_LATE_FEE": {
      // Goodwill follows action, never silence: only once the card is paid.
      if (state.credit.lateFeeRefunded || state.credit.status !== "current") return state;
      return next({
        credit: { ...state.credit, lateFeeRefunded: true },
        timeline: log(
          state,
          "agent",
          `Refunded the ${money(state.credit.lateFee)} late fee`,
          "Once-a-year goodwill refund, applied after Alex paid.",
        ),
      });
    }

    case "SET_CONTACT_PREFERENCES": {
      return next({
        customer: { ...state.customer, contactPreferences: action.preferences },
        timeline: log(
          state,
          "customer",
          "Updated contact preferences",
          "Alex's own rules for how and when we get in touch.",
        ),
      });
    }

    case "SET_ADAPTIVE": {
      if (state.ui.adaptiveEnabled === action.on) return state;
      return next({
        ui: {
          ...state.ui,
          adaptiveEnabled: action.on,
          // Turning the layer off also undoes anything it did.
          focusMode: action.on ? state.ui.focusMode : false,
        },
        timeline: log(
          state,
          "customer",
          action.on ? "Turned the adaptive screen on" : "Turned the adaptive screen off",
          action.on
            ? "The app may offer a simpler screen again."
            : "Nothing is measured on Alex's phone. Focus Mode will not be offered.",
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
          "The app offered a simpler screen. Alex decides.",
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
