import { describe, expect, it } from "vitest";
import { derivePanelState } from "@/lib/dashboard-state";
import { formatCountdown } from "@/lib/format";
import { dashboardHref, parseDashboardParams } from "@/lib/schemas/dashboard";
import type { RunRecord } from "@/server/repositories/types";
import type { RunStats } from "@/server/services/match-service";

describe("parseDashboardParams", () => {
  it("defaults when empty", () => {
    expect(parseDashboardParams({}, 2)).toEqual({ day: "upcoming", q: "", sort: "kickoff" });
  });
  it("accepts valid values and uses the first of repeated params", () => {
    expect(parseDashboardParams({ day: ["today", "tomorrow"], q: "peru", sort: "gap" }, 2)).toEqual(
      { day: "today", q: "peru", sort: "gap" },
    );
  });
  it("falls back to defaults for invalid values instead of throwing", () => {
    expect(parseDashboardParams({ day: "yesterday", sort: "random" }, 2)).toEqual({
      day: "upcoming",
      q: "",
      sort: "kickoff",
    });
  });
  it("trims and caps the league search at 60 characters", () => {
    expect(parseDashboardParams({ q: "  liga  " }, 2).q).toBe("liga");
    expect(parseDashboardParams({ q: "x".repeat(100) }, 2).q).toHaveLength(60);
  });
  it("dayafter only exists when the window is 2 days", () => {
    expect(parseDashboardParams({ day: "dayafter" }, 2).day).toBe("dayafter");
    expect(parseDashboardParams({ day: "dayafter" }, 1).day).toBe("upcoming");
  });
});

describe("dashboardHref", () => {
  it("omits defaults so the default URL stays /", () => {
    expect(dashboardHref({ day: "upcoming", q: "", sort: "kickoff" })).toBe("/");
  });
  it("encodes non-default values", () => {
    expect(dashboardHref({ day: "tomorrow", q: "la liga", sort: "gap" })).toBe(
      "/?day=tomorrow&q=la+liga&sort=gap",
    );
  });
});

describe("formatCountdown", () => {
  it("formats minutes, hours and days", () => {
    expect(formatCountdown(30_000)).toBe("now");
    expect(formatCountdown(12 * 60_000)).toBe("in 12 m");
    expect(formatCountdown((5 * 60 + 12) * 60_000)).toBe("in 5 h 12 m");
    expect(formatCountdown((2 * 24 + 3) * 3_600_000)).toBe("in 2 d 3 h");
    expect(formatCountdown(24 * 3_600_000)).toBe("in 1 d");
    expect(formatCountdown(-5)).toBe("now");
  });
});

const run = (status: RunRecord["status"]) => ({ status }) as RunRecord;
const stats = (over: Partial<RunStats>): RunStats => ({
  lastRun: null,
  lastUpdate: null,
  usable: null,
  scanned: 0,
  qualified: 0,
  stale: true,
  ...over,
});

describe("derivePanelState", () => {
  it("never when nothing usable exists", () => {
    expect(derivePanelState(stats({}))).toBe("never");
    expect(derivePanelState(stats({ lastRun: run("SKIPPED") }))).toBe("never");
  });
  it("running and failed come from the latest run", () => {
    expect(derivePanelState(stats({ lastRun: run("RUNNING") }))).toBe("running");
    expect(derivePanelState(stats({ lastRun: run("FAILED"), usable: run("SUCCESS") }))).toBe(
      "failed",
    );
  });
  it("success, partial and stale follow the usable run and the stale flag", () => {
    const usable = run("SUCCESS");
    expect(derivePanelState(stats({ usable, stale: false }))).toBe("success");
    expect(derivePanelState(stats({ usable: run("PARTIAL"), stale: false }))).toBe("partial");
    expect(derivePanelState(stats({ usable, stale: true }))).toBe("stale");
  });
});
