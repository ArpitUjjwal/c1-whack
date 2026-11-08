import { describe, expect, it } from "vitest";
import { profileConfig, startingDevicePrefs } from "@/lib/demo-data";
import { DEVICE_DEFAULTS, type DevicePrefs } from "@/lib/device";
import { nextAction, statusChips } from "@/lib/next-action";
import { deviceRevertFor, labelsFor, STRUGGLES, toggleStruggle } from "@/lib/struggles";
import { apply, fresh, NOW, request, fixClock } from "./helpers";

fixClock();

const T = NOW.getTime();
const at = (hour: number) => new Date(2026, 10, 8, hour, 0, 0).getTime();
const NUDGE = {
  type: "SEND_NUDGE" as const,
  nudge: { title: "Hi", body: "One button in the app.", tone: "calm" as const, fromAgent: "Jordan P." },
};

describe("Three customers", () => {
  it("starts Alex as a first-time user with nothing shared", () => {
    const s = fresh("alex");
    expect(s.customer.cognitiveProfile).toEqual([]);
    expect(s.customer.supportNote).toBe("");
    expect(startingDevicePrefs("alex").onboarded).toBe(false);
    expect(s.credit.lateFeeWaivedByGrace).toBe(false);
  });

  it("derives Priya's and Sam's shared labels and phone settings from their setup choices", () => {
    for (const id of ["priya", "sam"] as const) {
      const p = profileConfig(id);
      expect(fresh(id).customer.cognitiveProfile).toEqual(labelsFor(p.setup.struggles));
      expect(startingDevicePrefs(id).struggles).toEqual(p.setup.struggles);
      expect(startingDevicePrefs(id).onboarded).toBe(true);
    }
    expect(startingDevicePrefs("priya").font).toBe("lexend");
    expect(startingDevicePrefs("sam").font).toBe("atkinson");
  });

  it("waives Sam's fee under the grace rule and records his bounced Direct Debit", () => {
    const s = fresh("sam");
    expect(s.credit.lateFeeWaivedByGrace).toBe(true);
    expect(s.credit.ddReturnedOn).not.toBeNull();
    expect(s.timeline.some((e) => e.title === "Late fee waived — grace rule")).toBe(true);
    expect(fresh("priya").credit.lateFeeWaivedByGrace).toBe(false);
  });

  it("has no listening option left anywhere", () => {
    expect(STRUGGLES.map((s) => s.id)).not.toContain("listening");
    expect(labelsFor(STRUGGLES.map((s) => s.id))).not.toContain("Read it to me");
  });
});

describe("Reducer", () => {
  it("files a request as #1042, logged on the timeline", () => {
    const s = apply(fresh(), { type: "REQUEST_SUPPORT", request: request() });
    expect(s.supportCases[0]).toMatchObject({ ref: 1042, status: "review_needed", pathway: null });
    expect(s.timeline.at(-1)?.title).toBe("Alex sent support request #1042");
  });

  it("logs each person opening a case once", () => {
    const s = apply(
      fresh(),
      { type: "REQUEST_SUPPORT", request: request() },
      { type: "OPEN_CASE", who: "Jordan P." },
      { type: "OPEN_CASE", who: "Jordan P." },
    );
    expect(s.supportCases[0].accessLog).toHaveLength(1);
  });

  it("does not count an answer to the customer's own request as outreach", () => {
    const s = apply(fresh(), { type: "REQUEST_SUPPORT", request: request() }, { type: "OFFER_GUIDED_PAYMENT" });
    expect(s.supportCases[0].status).toBe("guided_offered");
    expect(s.contactLog).toHaveLength(fresh().contactLog.length);
  });

  it("does count a message the bank starts", () => {
    expect(apply(fresh(), NUDGE).contactLog).toHaveLength(fresh().contactLog.length + 1);
  });

  it("resolves open requests when the card is paid", () => {
    const s = apply(
      fresh(),
      { type: "REQUEST_SUPPORT", request: request() },
      { type: "OFFER_GUIDED_PAYMENT" },
      { type: "PAY_CREDIT", amount: 41 },
    );
    expect(s.credit.status).toBe("current");
    expect(s.supportCases[0].status).toBe("resolved");
  });

  it("only refunds the fee after payment, and never when grace already waived it", () => {
    expect(apply(fresh(), { type: "REFUND_LATE_FEE" }).credit.lateFeeRefunded).toBe(false);
    expect(apply(fresh(), { type: "PAY_CREDIT", amount: 41 }, { type: "REFUND_LATE_FEE" }).credit.lateFeeRefunded).toBe(true);
    expect(apply(fresh("sam"), { type: "PAY_CREDIT", amount: 25 }, { type: "REFUND_LATE_FEE" }).credit.lateFeeRefunded).toBe(false);
  });

  it("only approves an arrangement while the payment is overdue", () => {
    const approve = { type: "APPROVE_ARRANGEMENT" as const, newDueDate: "2026-11-22", approver: "Sam K." };
    const open = apply(fresh(), { type: "REQUEST_SUPPORT", request: request() });
    expect(apply(open, approve).supportCases[0].status).toBe("arrangement_offered");
    expect(apply(open, { type: "PAY_CREDIT", amount: 41 }, approve).flags.extensionOffered).toBe(false);
  });

  it("shares, updates and stops sharing preferences — with honest timeline wording", () => {
    const shared = apply(fresh(), { type: "SET_SHARED_PREFERENCES", preferences: ["Plain language"], note: "Keep it short." });
    expect(shared.customer.cognitiveProfile).toEqual(["Plain language"]);
    expect(shared.timeline.at(-1)?.title).toBe("Alex shared their banking preferences");

    const updated = apply(shared, { type: "SET_SHARED_PREFERENCES", preferences: ["Plain language", "Large text"], note: "Keep it short." });
    expect(updated.timeline.at(-1)?.title).toBe("Alex updated what they share");

    const stopped = apply(updated, { type: "SET_SHARED_PREFERENCES", preferences: [], note: "" });
    expect(stopped.customer.cognitiveProfile).toEqual([]);
    expect(stopped.timeline.at(-1)?.title).toBe("Alex stopped sharing their preferences");
  });

  it("resets to a different customer", () => {
    const s = apply(fresh("alex"), { type: "RESET_DEMO", profile: "sam" });
    expect(s.profileId).toBe("sam");
    expect(s.customer.firstName).toBe("Sam");
  });
});

describe("First-run choices", () => {
  const base: DevicePrefs = { ...DEVICE_DEFAULTS, epoch: 1 };
  const contact = { remindDaysBefore: 0 as const };

  it("applies a choice's settings when ticked", () => {
    const c = toggleStruggle("reading", base, contact, DEVICE_DEFAULTS);
    expect(c.device).toMatchObject({ font: "lexend", wideSpacing: true, tint: "cream", textSize: "large", struggles: ["reading"] });
    expect(c.labels).toEqual(["Plain language", "Amounts and dates first"]);
  });

  it("puts settings back when unticked", () => {
    const on = { ...base, ...toggleStruggle("reading", base, contact, DEVICE_DEFAULTS).device } as DevicePrefs;
    const off = toggleStruggle("reading", on, contact, DEVICE_DEFAULTS);
    expect(off.device).toMatchObject({ font: "standard", wideSpacing: false, tint: "none", textSize: "standard", struggles: [] });
  });

  it("leaves alone anything changed by hand since", () => {
    const on = { ...base, ...toggleStruggle("reading", base, contact, DEVICE_DEFAULTS).device } as DevicePrefs;
    const handSet = { ...on, textSize: "xlarge" as const };
    expect(deviceRevertFor("reading", [], handSet, DEVICE_DEFAULTS)).not.toHaveProperty("textSize");
  });

  it("falls back to what another ticked choice still asks for", () => {
    // Both set text size; unticking "seeing" leaves "reading"'s large text.
    let p = { ...base, ...toggleStruggle("reading", base, contact, DEVICE_DEFAULTS).device } as DevicePrefs;
    p = { ...p, ...toggleStruggle("seeing", p, contact, DEVICE_DEFAULTS).device } as DevicePrefs;
    expect(p.textSize).toBe("xlarge");
    const off = toggleStruggle("seeing", p, contact, DEVICE_DEFAULTS);
    expect(off.device.textSize).toBe("large");
  });

  it("sets and clears reminders through the contact rules", () => {
    const on = toggleStruggle("remembering", base, contact, DEVICE_DEFAULTS);
    expect(on.contact).toEqual({ remindDaysBefore: 3 });
    const ticked = { ...base, struggles: ["remembering" as const] };
    expect(toggleStruggle("remembering", ticked, { remindDaysBefore: 3 }, DEVICE_DEFAULTS).contact).toEqual({ remindDaysBefore: 0 });
    // Changed by hand to 1 day: unticking leaves it.
    expect(toggleStruggle("remembering", ticked, { remindDaysBefore: 1 }, DEVICE_DEFAULTS).contact).toBeNull();
  });
});

describe("Next action", () => {
  it("suggests one calm message for fresh Alex, prefilled in the composer", () => {
    const a = nextAction(fresh(), T);
    expect(a.tone).toBe("act");
    expect(a.title).toBe("Send one calm message");
    expect(a.primary?.kind).toBe("compose");
  });

  it("holds during the customer's quiet hours", () => {
    const a = nextAction(fresh(), at(22));
    expect(a.tone).toBe("hold");
    expect(a.primary).toBeUndefined();
    expect(a.why).toMatch(/quiet hours/);
  });

  it("holds once the weekly limit is reached", () => {
    const a = nextAction(apply(fresh(), NUDGE), T);
    expect(a.tone).toBe("hold");
    expect(a.why).toMatch(/limit/);
  });

  it("offers guided payment for a new request, with a working action", () => {
    const s = apply(fresh(), { type: "REQUEST_SUPPORT", request: request() });
    const a = nextAction(s, T);
    expect(a.title).toBe("Offer guided payment on request #1042");
    expect(a.primary).toMatchObject({ kind: "dispatch", action: { type: "OFFER_GUIDED_PAYMENT" } });
    expect(a.secondary).toMatchObject({ kind: "dispatch", action: { type: "REFER_SPECIALIST" } });
    if (a.primary?.kind === "dispatch") {
      expect(apply(s, a.primary.action).supportCases[0].status).toBe("guided_offered");
    }
  });

  it("refers to a specialist when the customer can't pay the full amount", () => {
    const s = apply(fresh(), { type: "REQUEST_SUPPORT", request: request({ difficulty: "cant_pay_full" }) });
    const a = nextAction(s, T);
    expect(a.primary).toMatchObject({ action: { type: "REFER_SPECIALIST" } });
    expect(a.secondary).toBeUndefined();
  });

  it("says don't chase once guided payment is with the customer", () => {
    const s = apply(fresh(), { type: "REQUEST_SUPPORT", request: request() }, { type: "OFFER_GUIDED_PAYMENT" });
    expect(nextAction(s, T).tone).toBe("wait");
  });

  it("approves an arrangement only when every check passes", () => {
    const asked = apply(
      fresh(),
      { type: "REQUEST_SUPPORT", request: request({ helpWanted: "arrangement" }) },
      { type: "REFER_SPECIALIST", replyBy: "2026-11-10" },
    );
    expect(nextAction(asked, T).primary).toMatchObject({ action: { type: "APPROVE_ARRANGEMENT" } });

    const notAsked = apply(fresh(), { type: "REQUEST_SUPPORT", request: request() }, { type: "REFER_SPECIALIST", replyBy: "2026-11-10" });
    const a = nextAction(notAsked, T);
    expect(a.title).toMatch(/Reply to #1042 in writing/);
    expect(a.primary?.kind).toBe("compose");
  });

  it("offers the refund after payment, then the Direct Debit", () => {
    const paid = apply(fresh(), { type: "PAY_CREDIT", amount: 41 });
    expect(nextAction(paid, T).primary).toMatchObject({ action: { type: "REFUND_LATE_FEE" } });
    const refunded = apply(paid, { type: "REFUND_LATE_FEE" });
    expect(nextAction(refunded, T).title).toBe("Offer a Direct Debit, once");
  });

  it("never suggests a refund when grace already waived the fee", () => {
    const paid = apply(fresh("sam"), { type: "PAY_CREDIT", amount: 25 });
    expect(nextAction(paid, T).primary?.kind === "dispatch" && nextAction(paid, T).primary).not.toMatchObject({
      action: { type: "REFUND_LATE_FEE" },
    });
    // Sam already has a Direct Debit, so there is nothing left to do.
    expect(nextAction(paid, T).tone).toBe("done");
  });

  it("shows the facts at a glance", () => {
    const labels = statusChips(fresh(), T, true).map((c) => c.label);
    expect(labels).toEqual(
      expect.arrayContaining(["In the app now", "£41.00 · 6 days past due", "Messages this week 1/2"]),
    );
    expect(labels.some((l) => l.startsWith("Credit-file date"))).toBe(true);
    expect(statusChips(fresh("sam"), T, false).map((c) => c.label)).toContain("Fee waived · 6/6 on time");
    expect(statusChips(fresh(), at(22), true).map((c) => c.label)).toContain("Quiet hours now");
  });
});
