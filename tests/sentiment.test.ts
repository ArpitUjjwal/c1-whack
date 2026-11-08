import { describe, expect, it } from "vitest";
import { analysePressure } from "@/lib/engines/pressure";
import { checkTone, hasAbuse, normaliseTextSpeak } from "@/lib/engines/sentiment";
import type { Tone } from "@/lib/types";

/** Run the tone check the way the composer does: with the live pressure band. */
function tone(text: string, picked: Tone, goodNews = false) {
  return checkTone(text, picked, goodNews, analysePressure(text).band);
}

const PLAIN = "There is £41 on your card. One button in the app sorts it.";

describe("Tone check", () => {
  it("blocks insults whatever tone is picked", () => {
    for (const picked of ["calm", "warm", "celebrate"] as const) {
      const c = tone("bitch u need to pay", picked);
      expect(c.abusive).toBe(true);
      expect(c.verdict).toBe("block");
    }
  });

  it("flags pressure under every tone — the reported 'neutral' bug", () => {
    for (const picked of ["calm", "warm", "celebrate"] as const) {
      const c = tone("no u need to get this done RIGHT NOW!", picked);
      expect(c.detected).toBe("pressuring");
      expect(c.verdict).toBe("warn");
    }
  });

  it("flags firm wording", () => {
    const c = tone("You need to pay the 41 pounds immediately.", "calm");
    expect(c.detected).toBe("firm");
    expect(c.verdict).toBe("warn");
  });

  it("depends on the tone picked: plain is Calm, not Warm", () => {
    expect(tone(PLAIN, "calm").verdict).toBe("match");
    const warm = tone(PLAIN, "warm");
    expect(warm.verdict).toBe("warn");
    expect(warm.advice).toMatch(/You picked Warm/);
  });

  it("accepts Warm when there is a greeting or kind word", () => {
    const c = tone("Hi Alex, I hope you're doing OK. There's one button in the app for it.", "warm");
    expect(c.detected).toBe("warm");
    expect(c.verdict).toBe("match");
  });

  it("only allows Celebrate with good news, and then it must sound like it", () => {
    expect(tone("Well done, your card is up to date!", "celebrate", false).verdict).toBe("warn");
    expect(tone(PLAIN, "celebrate", true).verdict).toBe("warn");
    const c = tone("Well done, your card is up to date!", "celebrate", true);
    expect(c.detected).toBe("celebratory");
    expect(c.verdict).toBe("match");
  });

  it("does not read ordinary banking words as hostile", () => {
    const c = tone("Your payment of £41 is due. Nothing is wrong, there's no fee to worry about.", "calm");
    expect(c.detected).not.toBe("hostile");
    expect(c.detected).not.toBe("negative");
  });
});

describe("Abuse and text-speak", () => {
  it("catches obfuscated insults", () => {
    expect(hasAbuse("you b1tch")).toBe(true);
    expect(hasAbuse("what the f*ck")).toBe(true);
    expect(hasAbuse("pay now or else")).toBe(true);
  });

  it("does not flag ordinary words", () => {
    expect(hasAbuse("Your Direct Debit didn't go through, nothing else changed.")).toBe(false);
  });

  it("expands text-speak for analysis", () => {
    expect(normaliseTextSpeak("u need to pay ur card pls")).toBe("you need to pay your card please");
  });
});
