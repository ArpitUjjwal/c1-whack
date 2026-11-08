import { describe, expect, it } from "vitest";
import { draftLocally, factsFor, NOT_SHARED } from "@/lib/advocate";
import { creditFileLine, payByIso } from "@/lib/compliance";
import { checkContact, isQuietHour, ordinal } from "@/lib/contact";
import { checkGrace, GRACE_STREAK, onTimeStreak } from "@/lib/engines/grace";
import { arrangementEligibility } from "@/lib/engines/rescue-sim";
import { projectBreak } from "@/lib/engines/time-machine";
import { buildInsights, MIN_GROUP } from "@/lib/insights-data";
import { apply, fresh, NOW, request, fixClock } from "./helpers";

fixClock();

const history = (...onTime: boolean[]) =>
  onTime.map((t, i) => ({ month: `M${i}`, onTime: t }));

describe("Grace rule: 6 of 6 on time forgives one late fee", () => {
  it("needs six on-time payments in a row", () => {
    expect(GRACE_STREAK).toBe(6);
    const six = { paymentHistory: history(true, true, true, true, true, true), graceUsedOn: null };
    expect(checkGrace(six, "2026-11-01").eligible).toBe(true);
  });

  it("is not earned by five, or by six with a late one in between", () => {
    const five = { paymentHistory: history(false, true, true, true, true, true), graceUsedOn: null };
    expect(onTimeStreak(five)).toBe(5);
    expect(checkGrace(five, "2026-11-01").eligible).toBe(false);
    expect(checkGrace(five, "2026-11-01").reason).toMatch(/6 of 6/);
  });

  it("can be used once a year", () => {
    const six = history(true, true, true, true, true, true);
    expect(checkGrace({ paymentHistory: six, graceUsedOn: "2026-03-01" }, "2026-11-01").eligible).toBe(false);
    expect(checkGrace({ paymentHistory: six, graceUsedOn: "2025-10-01" }, "2026-11-01").eligible).toBe(true);
  });
});

describe("Contact rules", () => {
  const prefs = { channel: "in_app" as const, maxPerWeek: 2, quietHours: { start: 21, end: 8 }, setOn: "", remindDaysBefore: 2 as const };

  it("handles quiet hours that wrap past midnight", () => {
    expect(isQuietHour(prefs, 22)).toBe(true);
    expect(isQuietHour(prefs, 3)).toBe(true);
    expect(isQuietHour(prefs, 8)).toBe(false);
    expect(isQuietHour(prefs, 14)).toBe(false);
  });

  it("counts only the last seven days", () => {
    // Alex's emails were 13, 9 and 5 days ago: one falls inside the week.
    const c = checkContact(fresh("alex"), NOW.getTime(), 14);
    expect(c.sentThisWeek).toBe(1);
    expect(c.nextOrdinal).toBe(2);
    expect(c.breaches).toEqual([]);
  });

  it("warns past the weekly limit, in quiet hours, and on the wrong channel", () => {
    const s = apply(fresh("alex"), {
      type: "SEND_NUDGE",
      nudge: { title: "Hi", body: "One button in the app.", tone: "calm", fromAgent: "Jordan P." },
    });
    const c = checkContact(s, Date.now(), 22, "email");
    expect(c.overLimit).toBe(true);
    expect(c.breaches.join(" ")).toMatch(/3rd message/);
    expect(c.breaches.join(" ")).toMatch(/quiet hours/);
    expect(c.breaches.join(" ")).toMatch(/in-app messages only/i);
  });

  it("writes ordinals correctly", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal)).toEqual([
      "1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd",
    ]);
  });
});

describe("Compliance wording", () => {
  it("gives the pay-by date two days before the 30-day reporting point", () => {
    expect(payByIso({ dueDate: "2026-11-02" })).toBe("2026-11-30");
  });

  it("is cautious", () => {
    expect(creditFileLine("Monday 30 November")).toBe(
      "Paying it by Monday 30 November should keep it off your credit file.",
    );
  });
});

describe("Financial Time Machine", () => {
  it("sorts a week's payments for Alex and projects the balance", () => {
    const r = projectBreak(fresh("alex"), 7);
    expect(r.during.map((o) => [o.label, o.bucket])).toEqual([
      ["Card minimum", "needs_you"],
      ["Rent", "needs_you"],
      ["Phone", "pays_itself"],
    ]);
    expect(r.projected).toBe(468.6);
    expect(r.shortfall).toBeNull();
    expect(r.plan).toMatch(/^3 payments fall in the next 7 days\. Start with card minimum/);
  });

  it("names the payment Sam's balance won't cover", () => {
    const r = projectBreak(fresh("sam"), 7);
    expect(r.projected).toBeLessThan(0);
    expect(r.shortfall?.label).toBe("Rent");
    expect(r.plan).toMatch(/may not cover rent/);
  });

  it("clamps the break to 1–14 days", () => {
    expect(projectBreak(fresh("alex"), 99).days).toBe(14);
    expect(projectBreak(fresh("alex"), 0).days).toBe(1);
  });
});

describe("Advocate", () => {
  it("drafts from the facts the customer chose, never anything else", () => {
    const facts = factsFor(fresh("alex"), {
      item: { label: "Card minimum", amount: 41, dueDate: "2026-11-02" },
      difficulty: "cant_face_it",
      helpWanted: "simpler",
      canPay: null,
      contact: "in_app",
      keepRepliesShort: true,
    });
    const d = draftLocally(facts);
    expect(d.message).toContain("£41.00");
    expect(d.message).toContain("keep it short");
    expect(d.summary).toMatch(/^Needs a simpler way to deal with it/);
  });

  it("lists setup choices among the things never shared", () => {
    expect(NOT_SHARED).toContain("What you ticked as hard in setup");
  });
});

describe("Arrangement eligibility", () => {
  it("does not offer an arrangement nobody asked for", () => {
    const s = apply(fresh("alex"), { type: "REQUEST_SUPPORT", request: request() });
    const checks = arrangementEligibility(s.supportCases[0], s);
    expect(checks.find((c) => /asked for/.test(c.label))?.pass).toBe(false);
  });

  it("passes when the customer asked and nothing's in place", () => {
    const s = apply(fresh("alex"), {
      type: "REQUEST_SUPPORT",
      request: request({ helpWanted: "arrangement" }),
    });
    expect(arrangementEligibility(s.supportCases[0], s).every((c) => c.pass)).toBe(true);
  });
});

describe("Accessibility Insights", () => {
  it("hides any group smaller than ten people", () => {
    const r = buildInsights([]);
    expect(r.barriers.every((b) => b.count >= MIN_GROUP)).toBe(true);
    expect(r.suppressedGroups).toBe(1);
  });

  it("adds this session's requests on top, live", () => {
    const s = apply(fresh("alex"), { type: "REQUEST_SUPPORT", request: request() });
    const before = buildInsights([]).barriers.find((b) => b.id === "cant_face_it")!;
    const after = buildInsights(s.supportCases).barriers.find((b) => b.id === "cant_face_it")!;
    expect(after.count).toBe(before.count + 1);
    expect(after.live).toBe(1);
  });

  it("makes recommendations from the figures, with no read-aloud tip left", () => {
    const r = buildInsights([]);
    expect(r.recommendations.length).toBeGreaterThanOrEqual(3);
    expect(r.recommendations.some((x) => /listen/i.test(x.title))).toBe(false);
  });
});
