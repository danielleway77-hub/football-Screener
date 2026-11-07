import { describe, expect, it } from "vitest";
import { bttsNo, evaluateMatch, under25 } from "@/server/domain/screening";
import { computeWindow } from "@/server/domain/window";

// Regression pins for the client's rule (docs/PROJECT_SCOPE.md FR1, FR2, FR3): strict thresholds,
// a 1-2 day window in Europe/London, and derived No/Under. Complements screening.test.ts and window.test.ts.
const inWindow = (w: { fromUtc: Date; toUtc: Date }, kickoffIso: string) => {
  const t = new Date(kickoffIso).getTime();
  return t >= w.fromUtc.getTime() && t < w.toUtc.getTime();
};

describe("strict thresholds with fractional form values", () => {
  const T = { high: 75, low: 35 };
  it("75.01 / 34.99 qualifies, 75.00 / 34.99 and 75.01 / 35.00 do not", () => {
    expect(evaluateMatch({ homeFormPct: 75.01, awayFormPct: 34.99 }, T).qualifies).toBe(true);
    expect(evaluateMatch({ homeFormPct: 75, awayFormPct: 34.99 }, T).qualifies).toBe(false);
    expect(evaluateMatch({ homeFormPct: 75.01, awayFormPct: 35 }, T).qualifies).toBe(false);
  });
  it("custom thresholds stay strict at their own boundary", () => {
    const custom = { high: 70, low: 40 };
    expect(evaluateMatch({ homeFormPct: 70, awayFormPct: 10 }, custom).qualifies).toBe(false);
    expect(evaluateMatch({ homeFormPct: 90, awayFormPct: 40 }, custom).qualifies).toBe(false);
    expect(evaluateMatch({ homeFormPct: 71, awayFormPct: 39 }, custom).qualifies).toBe(true);
  });
  it("0 and 100 extremes behave (0 is a real value, not missing)", () => {
    expect(evaluateMatch({ homeFormPct: 100, awayFormPct: 0 }, T)).toMatchObject({
      qualifies: true,
      strongSide: "HOME",
      formGap: 100,
    });
    expect(evaluateMatch({ homeFormPct: 0, awayFormPct: 100 }, T).strongSide).toBe("AWAY");
  });
  it("equal mid-range form does not qualify", () => {
    expect(evaluateMatch({ homeFormPct: 50, awayFormPct: 50 }, T).qualifies).toBe(false);
  });
});

describe("window membership is half-open in the owner's timezone", () => {
  const LONDON = "Europe/London";
  it("GMT: tomorrow starts at 00:00Z and today's late kickoff is excluded", () => {
    const w = computeWindow(new Date("2026-11-03T22:00:00Z"), LONDON, 1);
    expect(inWindow(w, "2026-11-03T23:59:59Z")).toBe(false);
    expect(inWindow(w, "2026-11-04T00:00:00Z")).toBe(true);
    expect(inWindow(w, "2026-11-04T23:59:59Z")).toBe(true);
    expect(inWindow(w, "2026-11-05T00:00:00Z")).toBe(false);
  });
  it("BST: 23:00Z is already London tomorrow; 22:59Z is not", () => {
    const w = computeWindow(new Date("2026-07-10T12:00:00Z"), LONDON, 1);
    expect(inWindow(w, "2026-07-10T22:59:59Z")).toBe(false);
    expect(inWindow(w, "2026-07-10T23:00:00Z")).toBe(true);
    expect(inWindow(w, "2026-07-11T22:59:59Z")).toBe(true);
    expect(inWindow(w, "2026-07-11T23:00:00Z")).toBe(false);
  });
  it("windowDays 2 adds exactly the day after, windowDays 1 does not", () => {
    const now = new Date("2026-11-03T12:00:00Z");
    const one = computeWindow(now, LONDON, 1);
    const two = computeWindow(now, LONDON, 2);
    expect(two.fromUtc.getTime()).toBe(one.fromUtc.getTime());
    expect(inWindow(one, "2026-11-05T12:00:00Z")).toBe(false);
    expect(inWindow(two, "2026-11-05T12:00:00Z")).toBe(true);
    expect(inWindow(two, "2026-11-06T00:00:00Z")).toBe(false);
  });
  it("the window follows the owner's date, not the server's (23:30Z in summer is London tomorrow)", () => {
    const w = computeWindow(new Date("2026-07-10T23:30:00Z"), LONDON, 1);
    expect(w.localDates).toEqual(["2026-07-12"]);
  });
});

describe("derived probabilities", () => {
  it("No/Under are exact complements for the whole 0-100 range, including 0 and 100", () => {
    for (const p of [0, 1, 33.3, 50, 99, 100]) {
      expect(bttsNo({ btts: p })).toBeCloseTo(100 - p, 10);
      expect(under25({ over25: p })).toBeCloseTo(100 - p, 10);
    }
  });
});
