import { describe, expect, it } from "vitest";
import {
  bttsNo,
  checkFormScope,
  evaluateMatch,
  under25,
  validateThresholds,
} from "@/server/domain/screening";

const T = { high: 75, low: 35 };
const run = (home: number, away: number) =>
  evaluateMatch({ homeFormPct: home, awayFormPct: away }, T);

describe("evaluateMatch", () => {
  it("qualifies when home 80 and away 7 (strong HOME)", () => {
    expect(run(80, 7)).toEqual({ qualifies: true, strongSide: "HOME", formGap: 73 });
  });
  it("qualifies when home 30 and away 82 (strong AWAY)", () => {
    expect(run(30, 82)).toEqual({ qualifies: true, strongSide: "AWAY", formGap: 52 });
  });
  it("qualifies at 76/34", () => {
    expect(run(76, 34).qualifies).toBe(true);
  });
  it("does not qualify at exactly 75/35", () => {
    expect(run(75, 35).qualifies).toBe(false);
  });
  it("does not qualify at 75/34 (home must be strictly above 75)", () => {
    expect(run(75, 34).qualifies).toBe(false);
  });
  it("does not qualify at 76/35 (away must be strictly below 35)", () => {
    expect(run(76, 35).qualifies).toBe(false);
  });
  it("does not qualify at 44/56", () => {
    expect(run(44, 56).qualifies).toBe(false);
  });
  it("does not qualify at 50/50", () => {
    expect(run(50, 50).qualifies).toBe(false);
  });
  it("does not qualify when both above 75", () => {
    expect(run(80, 90).qualifies).toBe(false);
  });
  it("does not qualify when both below 35", () => {
    expect(run(10, 20).qualifies).toBe(false);
  });
  it("qualifies at 100/0", () => {
    expect(run(100, 0)).toEqual({ qualifies: true, strongSide: "HOME", formGap: 100 });
  });
  it("floating point edge: 75.0000001 / 34.9999999 qualifies, 75.0 / 35.0 does not", () => {
    expect(run(75.0000001, 34.9999999).qualifies).toBe(true);
    expect(run(75.0, 35.0).qualifies).toBe(false);
  });
  it("formGap is computed even when not qualifying", () => {
    expect(run(44, 56)).toEqual({ qualifies: false, strongSide: null, formGap: 12 });
    expect(run(50, 50).formGap).toBe(0);
  });
  it("uses the thresholds it is given (70/40 changes the answer)", () => {
    const m = { homeFormPct: 72, awayFormPct: 38 };
    expect(evaluateMatch(m, T).qualifies).toBe(false);
    expect(evaluateMatch(m, { high: 70, low: 40 }).qualifies).toBe(true);
  });
});

describe("validateThresholds", () => {
  it("accepts 0 ≤ low < high ≤ 100 integers", () => {
    expect(validateThresholds({ low: 35, high: 75 })).toEqual({ ok: true });
    expect(validateThresholds({ low: 0, high: 1 })).toEqual({ ok: true });
    expect(validateThresholds({ low: 99, high: 100 })).toEqual({ ok: true });
  });
  it("rejects low >= high", () => {
    expect(validateThresholds({ low: 75, high: 75 }).ok).toBe(false);
    expect(validateThresholds({ low: 80, high: 70 }).ok).toBe(false);
  });
  it("rejects values below 0 or above 100", () => {
    expect(validateThresholds({ low: -1, high: 75 }).ok).toBe(false);
    expect(validateThresholds({ low: 35, high: 101 }).ok).toBe(false);
  });
  it("rejects non-integers", () => {
    expect(validateThresholds({ low: 35.5, high: 75 }).ok).toBe(false);
    expect(validateThresholds({ low: 35, high: Number.NaN }).ok).toBe(false);
  });
});

describe("derived probabilities and form scope", () => {
  it("No = 100 − Yes and Under = 100 − Over (client image #2: 54 → 46, 70 → 30)", () => {
    expect(bttsNo({ btts: 54 })).toBe(46);
    expect(under25({ over25: 70 })).toBe(30);
  });
  it("derived values are undefined when the source value is missing", () => {
    expect(bttsNo({})).toBeUndefined();
    expect(under25({})).toBeUndefined();
  });
  it("checkFormScope explains a mismatch and accepts a match", () => {
    expect(checkFormScope({ formScope: "league" }, "league")).toBeNull();
    expect(checkFormScope({ formScope: "overall" }, "league")).toBe(
      "form scope mismatch: expected league",
    );
  });
});
