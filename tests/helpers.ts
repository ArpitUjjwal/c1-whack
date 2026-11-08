import { afterEach, beforeEach, vi } from "vitest";
import { createInitialState } from "@/lib/demo-data";
import { reduce } from "@/lib/reducer";
import type { Action, AppState, ProfileId, SupportRequest } from "@/lib/types";

/**
 * A fixed clock: Sunday 8 November 2026, 14:00 local — outside every demo
 * customer's quiet hours (21:00–08:00 / 22:00–07:00). Everything date-based
 * in the app reads the clock, so tests pin it to stay repeatable.
 */
export const NOW = new Date(2026, 10, 8, 14, 0, 0);

export function fixClock(at: Date = NOW) {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(at);
  });
  afterEach(() => {
    vi.useRealTimers();
  });
}

export function fresh(profile: ProfileId = "alex"): AppState {
  return createInitialState(profile);
}

/** Apply actions in order through the real reducer. */
export function apply(state: AppState, ...actions: Action[]): AppState {
  return actions.reduce(reduce, state);
}

/** A support request as the Advocate would send it. */
export function request(overrides: Partial<SupportRequest> = {}): SupportRequest {
  return {
    task: "Card minimum — Classic card",
    amount: 41,
    dueDate: "2026-11-02",
    difficulty: "cant_face_it",
    helpWanted: "simpler",
    canPay: null,
    contact: "in_app",
    keepRepliesShort: true,
    message: "Hi, I need some help with my card minimum.",
    summary: "Needs a simpler way to deal with it: £41.00, card minimum.",
    draftedBy: "local",
    ...overrides,
  };
}
