"use client";

import { useEffect, useRef, useState } from "react";
import { money } from "@/lib/format";
import type { AgentScript } from "@/lib/scripts";
import type { AppState } from "@/lib/types";

/**
 * Try for a written script; keep the template one until it arrives.
 *
 * The template script from `buildAgentScript` is rendered immediately and is
 * never replaced by a spinner — an agent mid-call needs words on screen now,
 * not in two seconds. If a written script comes back and passes the server's
 * pressure check, it takes over; if anything at all goes wrong, the template
 * simply stays, and the agent never learns a request was made.
 *
 * Re-requested when the account state that the script is *about* changes, not
 * on every render of the console.
 */
export function useAgentScript(
  state: AppState,
  local: AgentScript,
): { script: AgentScript; source: "local" | "claude" } {
  const [written, setWritten] = useState<AgentScript | null>(null);

  /*
    The identity of the situation. Two renders with the same key describe the
    same call, so the script does not need rewriting — without this the
    console would re-request on every tick of the clock.
  */
  const key = [
    state.profileId,
    state.credit.status,
    state.credit.minimumDue,
    state.credit.daysOverdue,
    state.credit.lateFee,
    state.credit.lateFeeRefunded,
    state.credit.extendedDueDate ?? "",
    state.customer.cognitiveProfile.join("|"),
    local.situation,
  ].join("::");

  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (lastKey.current === key) return;
    lastKey.current = key;
    setWritten(null);

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/script", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            situation: local.situation,
            firstName: state.customer.firstName,
            preferences: state.customer.cognitiveProfile,
            facts: [
              { label: "Minimum payment", value: money(state.credit.minimumDue) },
              { label: "Balance", value: money(state.credit.balance) },
              { label: "Days past due", value: String(state.credit.daysOverdue) },
              { label: "Account status", value: state.credit.status },
              {
                label: "Late fee",
                value: state.credit.lateFeeRefunded
                  ? `${money(state.credit.lateFee)}, already refunded`
                  : money(state.credit.lateFee),
              },
            ],
          }),
        });
        if (!res.ok) return; // 503, 502 or 422 — the template stays.
        const body = (await res.json()) as { script?: AgentScript };
        if (body.script) setWritten(body.script);
      } catch {
        /* aborted, offline, malformed — the template stays. */
      }
    }, 400);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [key, local.situation, state.credit, state.customer, state.profileId]);

  return written
    ? { script: written, source: "claude" }
    : { script: local, source: "local" };
}
