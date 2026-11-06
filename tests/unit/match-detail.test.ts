import { describe, expect, it } from "vitest";
import {
  explainQualification,
  formGapPts,
  isPlausibleMatchId,
  matchHref,
  safeBackHref,
  safeExternalUrl,
  strongSideOf,
} from "@/lib/match-detail";
import { buildMatchDetailModel } from "@/lib/match-detail-model";
import type { MatchRecord } from "@/server/repositories/types";

const sides = { homeName: "Sporting Cristal", awayName: "FC Cajamarca", low: 35, high: 75 };

describe("safeBackHref", () => {
  it("accepts the dashboard with a query string", () => {
    expect(safeBackHref("/?tab=today&league=Liga%201")).toBe("/?tab=today&league=Liga%201");
    expect(safeBackHref("?tab=today")).toBe("/?tab=today");
  });
  it.each([
    undefined,
    "",
    "//evil.example",
    "/\\evil",
    "https://evil.example",
    "/settings",
    "javascript:alert(1)",
    "/?a=\u0001",
  ])("falls back to / for %s", (v) => expect(safeBackHref(v)).toBe("/"));
  it("uses the first value of a repeated param", () => {
    expect(safeBackHref(["/?tab=today", "/x"])).toBe("/?tab=today");
  });
});

describe("matchHref / ids / urls", () => {
  it("keeps the dashboard context in pager links", () => {
    expect(matchHref("abc", "/")).toBe("/matches/abc");
    expect(matchHref("abc", "/?tab=today")).toBe("/matches/abc?from=%2F%3Ftab%3Dtoday");
  });
  it("rejects implausible ids", () => {
    expect(isPlausibleMatchId("cm0abc_-1")).toBe(true);
    expect(isPlausibleMatchId("a".repeat(65))).toBe(false);
    expect(isPlausibleMatchId("../x")).toBe(false);
    expect(isPlausibleMatchId("")).toBe(false);
  });
  it("only http(s) urls become links", () => {
    expect(safeExternalUrl("https://example.com/a")).toBe("https://example.com/a");
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(safeExternalUrl("data:text/html,x")).toBeNull();
    expect(safeExternalUrl("not a url")).toBeNull();
    expect(safeExternalUrl(null)).toBeNull();
  });
});

describe("qualification explanation", () => {
  it("names both teams and both percentages (home strong)", () => {
    const s = explainQualification({ ...sides, homePct: 80, awayPct: 7 });
    expect(s).toBe(
      "Sporting Cristal's form (80%) is above 75% and FC Cajamarca's (7%) is below 35%.",
    );
  });
  it("away strong", () => {
    const s = explainQualification({ ...sides, homePct: 30, awayPct: 82 });
    expect(s).toBe(
      "FC Cajamarca's form (82%) is above 75% and Sporting Cristal's (30%) is below 35%.",
    );
  });
  it("not qualifying", () => {
    const s = explainQualification({ ...sides, homePct: 60, awayPct: 40 });
    expect(s).toMatch(/^Neither team pair meets the rule/);
    for (const p of ["Sporting Cristal", "FC Cajamarca", "60%", "40%", "75%", "35%"]) {
      expect(s).toContain(p);
    }
  });
  it("is strict at the boundaries", () => {
    expect(strongSideOf({ ...sides, homePct: 75, awayPct: 35 })).toBeNull();
    expect(strongSideOf({ ...sides, homePct: 76, awayPct: 34 })).toBe("HOME");
    expect(strongSideOf({ ...sides, homePct: 74.9, awayPct: 35.1 })).toBeNull();
    expect(strongSideOf({ ...sides, homePct: 75, awayPct: 20 })).toBeNull();
    expect(strongSideOf({ ...sides, homePct: 90, awayPct: 35 })).toBeNull();
    expect(strongSideOf({ ...sides, homePct: 34, awayPct: 76 })).toBe("AWAY");
    expect(strongSideOf({ ...sides, homePct: 20, awayPct: 75 })).toBeNull();
  });
  it("computes the gap", () => expect(formGapPts(80, 7)).toBe(73));
});

const match = (over: Partial<MatchRecord> = {}): MatchRecord =>
  ({
    id: "m1",
    provider: "predigoal",
    providerMatchId: "1",
    sourceUrl: "javascript:x",
    kickoffAt: new Date("2026-11-04T19:45:00Z"),
    league: "Liga 1",
    country: "Peru",
    homeName: "Sporting Cristal",
    awayName: "FC Cajamarca",
    homeLogoUrl: null,
    awayLogoUrl: null,
    homeFormPct: 80,
    awayFormPct: 7,
    formScope: "league",
    homeLastResults: null,
    awayLastResults: null,
    pHomeWin: null,
    pDraw: null,
    pAwayWin: null,
    pBtts: null,
    pOver25: null,
    predHomeGoals: null,
    predAwayGoals: null,
    confidence: null,
    qualifies: true,
    strongSide: "HOME",
    formGap: 73,
    firstRunId: null,
    lastRunId: null,
    fetchedAt: new Date("2026-11-04T06:58:00Z"),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  }) as MatchRecord;

describe("buildMatchDetailModel", () => {
  const settings = { lowThreshold: 35, highThreshold: 75, timezone: "Europe/London" };
  const now = new Date("2026-11-03T19:45:00Z");
  it("formats in the owner timezone and recomputes the verdict from current thresholds", () => {
    const m = buildMatchDetailModel({ match: match(), previous: null, next: null, settings, now });
    expect(m.kickoff).toBe("Wed 4 Nov · 19:45");
    expect(m.relative).toBe("in 1 day");
    expect(m.fetched).toBe("Wed 4 Nov 06:58");
    expect(m.competition).toBe("Peru · Liga 1");
    expect(m.qualifies).toBe(true);
    expect(m.strongName).toBe("Sporting Cristal");
    expect(m.sourceUrl).toBeNull();
    const changed = buildMatchDetailModel({
      match: match(),
      previous: null,
      next: null,
      now,
      settings: { ...settings, highThreshold: 85 },
    });
    expect(changed.qualifies).toBe(false);
    expect(changed.strongName).toBeNull();
  });
  it("null league/country, pager targets keep `from`", () => {
    const m = buildMatchDetailModel({
      match: match({ league: null, country: null }),
      previous: match({ id: "p" }),
      next: null,
      settings,
      now,
      from: "/?tab=today",
    });
    expect(m.competition).toBeNull();
    expect(m.previous?.href).toBe("/matches/p?from=%2F%3Ftab%3Dtoday");
    expect(m.next).toBeNull();
    expect(m.backHref).toBe("/?tab=today");
  });
});
