import { describe, expect, it } from "vitest";
import { creditFileLine } from "@/lib/compliance";
import { analysePressure, rewriteLocally } from "@/lib/engines/pressure";

const BAD =
  "You must pay the full balance immediately to avoid collections. Failure to do so will be reported to the credit reference agencies.";
const CTX = {
  amount: "£41.00",
  agentName: "Jordan P.",
  firstName: "Alex",
  payBy: "Monday 30 November",
};

const kinds = (text: string) => analysePressure(text).findings.map((f) => f.kind);

describe("Pressure Index — scoring", () => {
  it("scores the standard collections sentence as harmful", () => {
    const r = analysePressure(BAD);
    expect(r.score).toBe(100);
    expect(r.band).toBe("harmful");
    expect(kinds(BAD)).toEqual(expect.arrayContaining(["urgency", "threat"]));
  });

  it("catches text-speak urgency and shouting", () => {
    const text = "no u need to get this done RIGHT NOW!";
    const r = analysePressure(text);
    expect(r.band).toBe("pressuring");
    expect(r.score).toBeGreaterThanOrEqual(40);
    expect(kinds(text)).toEqual(expect.arrayContaining(["urgency", "shouting"]));
    // One underline per phrase: "RIGHT NOW" is both urgent and shouted, so it
    // shows the heavier finding (urgency) — while both are still scored.
    expect(r.spans.some((s) => /right now/i.test(s.text))).toBe(true);
    expect(r.findings.find((f) => f.kind === "shouting")?.weight).toBeGreaterThan(0);
  });

  it("does not treat acronyms or a celebratory '!' as shouting", () => {
    expect(kinds("Your APR is 34.9% and your UK sort code is on file.")).not.toContain("shouting");
    expect(kinds("Well done, your card is up to date!")).not.toContain("shouting");
  });

  it("makes any insult harmful, including obfuscated spellings", () => {
    for (const text of ["bitch u need to pay", "pay up you useless idiot", "this is f*cking late"]) {
      const r = analysePressure(text);
      expect(kinds(text)).toContain("abuse");
      expect(r.band).toBe("harmful");
    }
  });

  it("allows one real consequence stated calmly with a date", () => {
    const r = analysePressure(creditFileLine("Monday 30 November"));
    expect(r.score).toBe(0);
    expect(r.spans.some((s) => s.kind === "allowed")).toBe(true);
  });

  it("flags a consequence with no date", () => {
    expect(kinds("Paying soon keeps it off your credit file.")).toContain("consequence");
  });

  it("flags a consequence said twice", () => {
    const text =
      "Pay by 30 November to keep it off your credit file. Paying by 30 November protects your credit file.";
    expect(kinds(text)).toContain("consequence");
  });

  it("never penalises locked compliance wording", () => {
    const locked = creditFileLine("Monday 30 November");
    const r = analysePressure(`Hi Alex. ${locked}`, { locked: [locked] });
    expect(r.score).toBe(0);
    expect(r.spans.some((s) => s.kind === "locked")).toBe(true);
  });
});

describe("Pressure Index — rewriting", () => {
  it("removes threats but keeps the one real consequence, dated", () => {
    const r = rewriteLocally(BAD, { ...CTX, tone: "calm" });
    expect(r.report.score).toBe(0);
    expect(r.text).toContain("Monday 30 November");
    expect(r.text).toContain("credit file");
    expect(r.text).not.toMatch(/collections|must|immediately|reported to/i);
  });

  it("does not restate the consequence when locked wording already carries it", () => {
    const locked = [creditFileLine("Monday 30 November")];
    const r = rewriteLocally(BAD, { ...CTX, tone: "calm", locked });
    expect(r.text).not.toContain("credit file");
  });

  it("rebuilds a shouted draft from the facts in the chosen tone", () => {
    const shouted = "no u need to get this done RIGHT NOW!";
    const calm = rewriteLocally(shouted, { ...CTX, tone: "calm" });
    const warm = rewriteLocally(shouted, { ...CTX, tone: "warm" });

    for (const r of [calm, warm]) {
      expect(r.usedTemplate).toBe(true);
      expect(r.report.score).toBe(0);
      expect(r.text).toContain("£41.00");
      expect(r.text).not.toMatch(/RIGHT NOW|!/);
    }
    expect(warm.text).toMatch(/I hope you're doing OK/);
    expect(calm.text).not.toMatch(/I hope you're doing OK/);
    expect(warm.text).not.toBe(calm.text);
  });

  it("starts again from the facts when the draft contains an insult", () => {
    const r = rewriteLocally("bitch u need to pay", { ...CTX, tone: "calm" });
    expect(r.usedTemplate).toBe(true);
    expect(r.text).not.toMatch(/bitch/i);
    expect(r.report.score).toBe(0);
  });

  it("only celebrates when there is good news", () => {
    const noNews = rewriteLocally("Your card is paid up", { ...CTX, tone: "celebrate", goodNews: false });
    expect(noNews.text).not.toMatch(/Good news/);
    const news = rewriteLocally("Your card is paid up", { ...CTX, tone: "celebrate", goodNews: true });
    expect(news.text).toMatch(/^Good news, Alex!/);
  });

  it("warms a plain message without adding pressure", () => {
    const r = rewriteLocally(
      "You can pay the full balance. There is one button in the app for it, whenever suits you.",
      { ...CTX, tone: "warm" },
    );
    expect(r.text).toMatch(/^Hi Alex, /);
    expect(r.text).toMatch(/I'm here if you need anything\.$/);
    expect(r.report.score).toBeLessThan(20);
  });
});
