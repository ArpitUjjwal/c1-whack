import type { Action, Actor, AppState, SupportCase, TimelineEvent } from "./types";
import { createInitialState } from "./demo-data";
import { isoDaysFromToday, longDate, money, shortDate } from "./format";

/** First reference number handed out. Shown on both screens. */
const FIRST_CASE_REF = 1042;

/** The newest case still waiting on the bank or the customer. */
function openCase(state: AppState, id?: string): SupportCase | null {
  if (id) return state.supportCases.find((c) => c.id === id) ?? null;
  for (let i = state.supportCases.length - 1; i >= 0; i -= 1) {
    if (state.supportCases[i].status !== "resolved") return state.supportCases[i];
  }
  return null;
}

function patchCase(
  state: AppState,
  id: string,
  patch: (c: SupportCase) => SupportCase,
): SupportCase[] {
  return state.supportCases.map((c) => (c.id === id ? patch(c) : c));
}

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
          `${state.customer.firstName} opened the app`,
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
        supportCases: clearedOverdue
          ? state.supportCases.map((c) =>
              c.status === "resolved" ? c : { ...c, status: "resolved" },
            )
          : state.supportCases,
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
          `New due date proposed: ${longDate(action.newDueDate)}. Waiting on ${state.customer.firstName} to accept.`,
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
        supportCases: state.supportCases.map((c) =>
          c.status === "arrangement_offered" ? { ...c, status: "resolved" } : c,
        ),
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
          `Smaller amounts are easier to start. Waiting on ${state.customer.firstName}.`,
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
      if (
        state.credit.lateFeeRefunded ||
        state.credit.lateFeeWaivedByGrace ||
        state.credit.status !== "current"
      ) {
        return state;
      }
      return next({
        credit: { ...state.credit, lateFeeRefunded: true },
        timeline: log(
          state,
          "agent",
          `Refunded the ${money(state.credit.lateFee)} late fee`,
          `Once-a-year goodwill refund, applied after ${state.customer.firstName} paid.`,
        ),
      });
    }

    case "SET_SHARED_PREFERENCES": {
      const sharing = action.preferences.length > 0 || action.note.trim().length > 0;
      const was = state.customer.cognitiveProfile.length > 0 || state.customer.supportNote.length > 0;
      if (!sharing && !was) return state;
      return next({
        customer: {
          ...state.customer,
          cognitiveProfile: [...action.preferences],
          supportNote: action.note.trim(),
        },
        timeline: log(
          state,
          "customer",
          !sharing
            ? `${state.customer.firstName} stopped sharing their preferences`
            : was
              ? `${state.customer.firstName} updated what they share`
              : `${state.customer.firstName} shared their banking preferences`,
          sharing
            ? "Chosen in the app. Only these labels are shared, never the reasons."
            : "Support no longer sees them. Plain language is the default for everyone.",
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
          `${state.customer.firstName}'s own rules for how and when we get in touch.`,
        ),
      });
    }


    case "AGENT_NOTE": {
      return next({
        timeline: log(state, "agent", "Agent note", action.text),
      });
    }




    case "REQUEST_SUPPORT": {
      const ref = FIRST_CASE_REF + state.supportCases.length;
      const created: SupportCase = {
        ...action.request,
        id: uid("case"),
        ref,
        createdAt: Date.now(),
        status: "review_needed",
        pathway: null,
        replyBy: null,
        accessLog: [],
      };
      return next({
        supportCases: [...state.supportCases, created],
        timeline: log(
          state,
          "customer",
          `${state.customer.firstName} sent support request #${ref}`,
          `${action.request.summary} Reviewed by ${state.customer.firstName} before sending.`,
          true,
        ),
      });
    }

    case "OPEN_CASE": {
      const c = openCase(state, action.id);
      if (!c) return state;
      // One entry per person: the log is "who has seen this", not a click count.
      if (c.accessLog.some((e) => e.who === action.who && e.what === "Opened the case")) {
        return state;
      }
      return next({
        supportCases: patchCase(state, c.id, (x) => ({
          ...x,
          accessLog: [...x.accessLog, { who: action.who, what: "Opened the case", at: Date.now() }],
        })),
      });
    }

    case "OFFER_GUIDED_PAYMENT": {
      const c = openCase(state, action.id);
      if (!c || c.status === "resolved") return state;
      return next({
        supportCases: patchCase(state, c.id, (x) => ({
          ...x,
          status: "guided_offered",
          pathway: "guided",
          accessLog: [
            ...x.accessLog,
            { who: state.agentName, what: "Offered guided payment support", at: Date.now() },
          ],
        })),
        // An update on a request Alex sent is an answer, not outreach, so it
        // doesn't count toward Alex's weekly contact limit.
        timeline: log(
          state,
          "agent",
          `Offered guided payment support on #${c.ref}`,
          `A step-by-step way to pay appears in ${state.customer.firstName}'s app. No change to terms.`,
        ),
      });
    }

    case "REFER_SPECIALIST": {
      const c = openCase(state, action.id);
      if (!c || c.status === "resolved") return state;
      return next({
        supportCases: patchCase(state, c.id, (x) => ({
          ...x,
          status: "specialist_review",
          pathway: "specialist",
          replyBy: action.replyBy,
          accessLog: [
            ...x.accessLog,
            { who: state.agentName, what: "Referred for specialist review", at: Date.now() },
          ],
        })),
        // An update on a request Alex sent is an answer, not outreach, so it
        // doesn't count toward Alex's weekly contact limit.
        timeline: log(
          state,
          "agent",
          `Referred #${c.ref} for specialist review`,
          `An adviser will reply by ${shortDate(action.replyBy)}. No extension or fee waiver is assumed.`,
        ),
      });
    }

    case "APPROVE_ARRANGEMENT": {
      const c = openCase(state, action.id);
      if (!c || c.status === "resolved" || state.credit.status !== "overdue") return state;
      return next({
        supportCases: patchCase(state, c.id, (x) => ({
          ...x,
          status: "arrangement_offered",
          accessLog: [
            ...x.accessLog,
            {
              who: action.approver,
              what: `Approved an arrangement after the eligibility check (second approver)`,
              at: Date.now(),
            },
          ],
        })),
        credit: { ...state.credit, extendedDueDate: action.newDueDate },
        flags: { ...state.flags, extensionOffered: true },
        timeline: log(
          state,
          "agent",
          `Arrangement approved on #${c.ref}`,
          `Eligibility checked and second approval by ${action.approver}. Offered: pay on ${longDate(
            action.newDueDate,
          )} instead.`,
        ),
      });
    }

    case "DEMO_SET_BEAT": {
      // Director position is shared state so both windows show the same beat.
      // It is deliberately not logged \u2014 it is presentation, not account history.
      return next({ demo: { beat: action.beat, active: action.active } });
    }

    case "RESET_DEMO": {
      return { ...createInitialState(action.profile ?? state.profileId), rev: state.rev + 1 };
    }

    default:
      return state;
  }
}
