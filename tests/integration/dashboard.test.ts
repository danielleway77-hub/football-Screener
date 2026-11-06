import { describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import * as matches from "@/server/repositories/matches";
import * as settingsRepo from "@/server/repositories/settings";
import type { MatchInput } from "@/server/repositories/types";
import { getDashboard, getDashboardSummary } from "@/server/services/match-service";
import { loadFixtureMatches } from "../fixtures/load";
import { setupTestDb } from "./helpers";

setupTestDb();

// Deterministic clock: Tue 3 Nov 2026 12:00 UTC (= 12:00 in Europe/London, winter time).
const NOW = new Date("2026-11-03T12:00:00Z");

function row(id: string, kickoffIso: string, over: Partial<MatchInput> = {}): MatchInput {
  const [base] = loadFixtureMatches();
  return {
    ...base!,
    provider: "dash",
    providerMatchId: id,
    homeName: `Home ${id}`,
    awayName: `Away ${id}`,
    league: "Liga 1",
    country: "Peru",
    homeFormPct: 80,
    awayFormPct: 10,
    formGap: 70,
    qualifies: true,
    strongSide: "HOME",
    kickoffAt: new Date(kickoffIso),
    ...over,
  };
}

async function seed(rows: MatchInput[]) {
  await matches.upsertMany(rows, null);
}

describe("getDashboard (10.2)", () => {
  it("returns only qualifying upcoming matches", async () => {
    await seed([
      row("q", "2026-11-04T10:00:00Z"),
      row("nq", "2026-11-04T11:00:00Z", { qualifies: false, strongSide: null }),
    ]);
    const s = await settingsRepo.getSettings();
    const list = await getDashboard({ tab: "upcoming" }, s, NOW);
    expect(list.map((m) => m.providerMatchId)).toEqual(["q"]);
  });

  it("past matches are hidden (kickoffAt >= now)", async () => {
    await seed([row("past", "2026-11-03T11:59:00Z"), row("later-today", "2026-11-03T12:01:00Z")]);
    const s = await settingsRepo.getSettings();
    for (const tab of ["upcoming", "today"] as const) {
      const list = await getDashboard({ tab }, s, NOW);
      expect(list.map((m) => m.providerMatchId)).toEqual(["later-today"]);
    }
  });

  it("tabs split today / tomorrow / dayafter in the owner timezone", async () => {
    const s = await settingsRepo.getSettings();
    // Pacific/Auckland is UTC+13 in November: it is already 4 Nov 01:00 there when NOW happens.
    await settingsRepo.updateSettings({ timezone: "Pacific/Auckland" });
    const nz = await settingsRepo.getSettings();
    await seed([
      row("t1", "2026-11-03T20:00:00Z"), // 4 Nov 09:00 NZ -> today
      row("t2", "2026-11-04T10:00:00Z"), // 4 Nov 23:00 NZ -> today
      row("t3", "2026-11-04T12:00:00Z"), // 5 Nov 01:00 NZ -> tomorrow
    ]);
    const ids = async (tab: "today" | "tomorrow" | "dayafter") =>
      (await getDashboard({ tab }, nz, NOW)).map((m) => m.providerMatchId);
    expect(await ids("today")).toEqual(["t1", "t2"]);
    expect(await ids("tomorrow")).toEqual(["t3"]);
    expect(await ids("dayafter")).toEqual([]);
    // The same instants in London: t1 -> 3 Nov 20:00 (today), t2/t3 -> tomorrow.
    await settingsRepo.updateSettings({ timezone: s.timezone });
    const london = await settingsRepo.getSettings();
    const londonIds = async (tab: "today" | "tomorrow" | "dayafter") =>
      (await getDashboard({ tab }, london, NOW)).map((m) => m.providerMatchId);
    expect(await londonIds("today")).toEqual(["t1"]);
    expect(await londonIds("tomorrow")).toEqual(["t2", "t3"]);
  });

  it("a match fetched yesterday as 'tomorrow' now appears under Today", async () => {
    await seed([row("y", "2026-11-03T18:00:00Z", { fetchedAt: new Date("2026-11-02T06:00:00Z") })]);
    const s = await settingsRepo.getSettings();
    expect((await getDashboard({ tab: "today" }, s, NOW)).map((m) => m.providerMatchId)).toEqual([
      "y",
    ]);
  });

  it("search filters by league (case-insensitive, partial) and by country", async () => {
    await seed([
      row("a", "2026-11-04T10:00:00Z", { league: "Premier League", country: "England" }),
      row("b", "2026-11-04T11:00:00Z", { league: "Liga 1", country: "Peru" }),
    ]);
    const s = await settingsRepo.getSettings();
    const find = async (league: string) =>
      (await getDashboard({ tab: "upcoming", league }, s, NOW)).map((m) => m.providerMatchId);
    expect(await find("premier")).toEqual(["a"]);
    expect(await find("LIGA")).toEqual(["b"]);
    expect(await find("peru")).toEqual(["b"]);
    expect(await find("zzz")).toEqual([]);
    expect(await find("  ")).toEqual(["a", "b"]);
  });

  it("sorts by kickoff (default) and by form gap", async () => {
    await seed([
      row("early-small", "2026-11-04T09:00:00Z", { formGap: 50 }),
      row("late-big", "2026-11-05T09:00:00Z", { formGap: 90 }),
      row("mid-mid", "2026-11-04T20:00:00Z", { formGap: 70 }),
    ]);
    const s = await settingsRepo.getSettings();
    const order = async (sort: "kickoff" | "gap") =>
      (await getDashboard({ tab: "upcoming", sort }, s, NOW)).map((m) => m.providerMatchId);
    expect(await order("kickoff")).toEqual(["early-small", "mid-mid", "late-big"]);
    expect(await order("gap")).toEqual(["late-big", "mid-mid", "early-small"]);
  });

  it("limit 200 is enforced even when more is requested", async () => {
    await getDb().match.createMany({
      data: Array.from({ length: 205 }, (_, i) => ({
        ...row(`bulk${i}`, "2026-11-04T10:00:00Z"),
        firstRunId: null,
      })),
    });
    const s = await settingsRepo.getSettings();
    expect(await getDashboard({ tab: "upcoming", limit: 5000 }, s, NOW)).toHaveLength(200);
    expect(await getDashboard({ tab: "upcoming", limit: 3 }, s, NOW)).toHaveLength(3);
  });
});

describe("getDashboardSummary (10.2)", () => {
  it("counts total, per day and the next kickoff", async () => {
    await seed([
      row("today", "2026-11-03T15:00:00Z"),
      row("tomorrow1", "2026-11-04T10:00:00Z"),
      row("tomorrow2", "2026-11-04T18:00:00Z"),
      row("dayafter", "2026-11-05T10:00:00Z"),
      row("past", "2026-11-03T08:00:00Z"),
      row("nq", "2026-11-04T12:00:00Z", { qualifies: false, strongSide: null }),
    ]);
    const s = await settingsRepo.getSettings();
    const summary = await getDashboardSummary(s, NOW);
    expect(summary.total).toBe(4);
    expect(summary.perDay).toEqual({ today: 1, tomorrow: 2, dayafter: 1 });
    expect(summary.nextKickoff?.toISOString()).toBe("2026-11-03T15:00:00.000Z");
  });

  it("is empty-safe", async () => {
    const s = await settingsRepo.getSettings();
    expect(await getDashboardSummary(s, NOW)).toEqual({
      total: 0,
      perDay: { today: 0, tomorrow: 0, dayafter: 0 },
      nextKickoff: null,
    });
  });
});
