import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/server/errors";
import * as matches from "@/server/repositories/matches";
import * as runs from "@/server/repositories/runs";
import * as settingsRepo from "@/server/repositories/settings";
import type { SettingRecord } from "@/server/repositories/types";
import { getDb } from "@/lib/db";
import * as matchService from "@/server/services/match-service";
import * as runService from "@/server/services/run-service";
import * as settingsService from "@/server/services/settings-service";
import { FIXTURE_NOW } from "../fixtures/load";
import { setupTestDb } from "./helpers";

setupTestDb();

let settings: SettingRecord;
beforeEach(async () => {
  settings = await settingsRepo.ensureSettings();
});

const clock = { now: () => FIXTURE_NOW };

type Item = Record<string, unknown>;
function item(id: string, home: number, away: number, extra: Item = {}): Item {
  return {
    provider: "predigoal",
    providerMatchId: id,
    kickoffAt: "2026-11-04T15:00:00Z",
    league: "Test League",
    home: { name: `Home ${id}`, formPct: home },
    away: { name: `Away ${id}`, formPct: away },
    formScope: "league",
    probabilities: { homeWin: 76, draw: 16, awayWin: 8, btts: 54, over25: 70 },
    predictedScore: { home: 3, away: 1 },
    ...extra,
  };
}

const push = (payload: unknown, s = settings, now = clock.now) =>
  runService.processBatch({
    trigger: "INGEST",
    provider: "assisted_ingest",
    payload,
    settings: s,
    now,
  });

const count = () => getDb().match.count();

describe("processBatch", () => {
  it("stores matches, screens them with the current thresholds and links them to the run", async () => {
    const r = await push({ matches: [item("a", 80, 7), item("b", 44, 56), item("c", 30, 82)] });
    expect(r).toMatchObject({ status: "SUCCESS", scanned: 3, qualified: 2, failed: 0 });
    const rows = await getDb().match.findMany({ orderBy: { providerMatchId: "asc" } });
    expect(rows.map((m) => [m.providerMatchId, m.qualifies, m.strongSide, m.formGap])).toEqual([
      ["a", true, "HOME", 73],
      ["b", false, null, 12],
      ["c", true, "AWAY", 52],
    ]);
    expect(await matches.countByRun(r.runId)).toBe(3);
    const link = await getDb().runMatch.findMany({ where: { runId: r.runId } });
    expect(link.filter((l) => l.qualifiedAtRun)).toHaveLength(2);
  });

  it("stores the golden fixture's probabilities and predicted score exactly", async () => {
    await push({ matches: [item("g", 80, 7)] });
    const m = await getDb().match.findFirstOrThrow();
    expect([m.pHomeWin, m.pDraw, m.pAwayWin, m.pBtts, m.pOver25]).toEqual([76, 16, 8, 54, 70]);
    expect([m.predHomeGoals, m.predAwayGoals]).toEqual([3, 1]);
  });

  it("is idempotent: the same payload twice keeps one row per match and moves lastRunId", async () => {
    const payload = { matches: [item("a", 80, 7), item("b", 10, 20)] };
    const first = await push(payload);
    const second = await push(payload);
    expect(await count()).toBe(2);
    expect(second.runId).not.toBe(first.runId);
    const m = await getDb().match.findFirstOrThrow({ where: { providerMatchId: "a" } });
    expect(m.firstRunId).toBe(first.runId);
    expect(m.lastRunId).toBe(second.runId);
    expect(await matches.countByRun(second.runId)).toBe(2);
  });

  it("updates changed values on re-send (kickoff, probabilities, predicted score)", async () => {
    await push({ matches: [item("a", 80, 7)] });
    await push({
      matches: [
        item("a", 80, 7, {
          kickoffAt: "2026-11-04T18:00:00Z",
          probabilities: { homeWin: 60, draw: 25, awayWin: 15, btts: 40, over25: 55 },
          predictedScore: { home: 2, away: 0 },
        }),
      ],
    });
    const m = await getDb().match.findFirstOrThrow();
    expect(m.kickoffAt.toISOString()).toBe("2026-11-04T18:00:00.000Z");
    expect([m.pHomeWin, m.pBtts, m.predHomeGoals, m.predAwayGoals]).toEqual([60, 40, 2, 0]);
  });

  it("duplicates in one payload: last wins, counted once, scanned includes the dropped one", async () => {
    const r = await push({ matches: [item("a", 80, 7), item("a", 90, 5)] });
    expect(await count()).toBe(1);
    expect((await getDb().match.findFirstOrThrow()).homeFormPct).toBe(90);
    expect(r).toMatchObject({ status: "SUCCESS", scanned: 2, failed: 0 });
  });

  it("PARTIAL when one item is invalid: good items stored, reasons in details", async () => {
    const bad = item("bad", 80, 7, { home: { name: "X" } });
    const r = await push({ matches: [item("ok", 80, 7), bad] });
    expect(r).toMatchObject({ status: "PARTIAL", scanned: 2, failed: 1 });
    expect(await count()).toBe(1);
    const run = await runs.getById(r.runId);
    expect(run?.status).toBe("PARTIAL");
    expect(run?.details).toEqual([{ index: 1, id: "bad", reason: "home form is missing" }]);
    expect(run?.error).toBe("1 of 2 matches were skipped.");
  });

  it("FAILED and nothing stored when every item is invalid", async () => {
    await push({ matches: [item("keep", 80, 7)] });
    const r = await push({ matches: [{}, "x", item("bad", 120, 5)] });
    expect(r.status).toBe("FAILED");
    expect(r.failed).toBe(3);
    expect(await count()).toBe(1);
    expect((await runs.getById(r.runId))?.error).toBe(
      "None of the matches in this update could be used.",
    );
  });

  it("rejects an item whose form scope differs from the setting, with a reason and its index", async () => {
    const r = await push({
      matches: [item("a", 80, 7), item("o", 80, 7, { formScope: "overall" })],
    });
    expect(r).toMatchObject({ status: "PARTIAL", failed: 1 });
    const run = await runs.getById(r.runId);
    expect(run?.details).toEqual([
      { index: 1, id: "o", reason: "form scope mismatch: expected league" },
    ]);
    expect(await count()).toBe(1);
  });

  it("missing probabilities are stored as null, never 0", async () => {
    await push({
      matches: [item("a", 80, 7, { probabilities: undefined, predictedScore: undefined })],
    });
    const m = await getDb().match.findFirstOrThrow();
    expect([m.pHomeWin, m.pDraw, m.pAwayWin, m.pBtts, m.pOver25, m.predHomeGoals]).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
  });

  it("fetchedAt is the server clock, whatever the client sends", async () => {
    await push({ matches: [item("a", 80, 7, { fetchedAt: "1999-01-01T00:00:00Z" })] });
    expect((await getDb().match.findFirstOrThrow()).fetchedAt.toISOString()).toBe(
      FIXTURE_NOW.toISOString(),
    );
  });

  it("an unusable payload throws VALIDATION_FAILED and creates no run", async () => {
    await expect(push({ matches: [] })).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(push("nope")).rejects.toBeInstanceOf(AppError);
    expect(await getDb().screeningRun.count()).toBe(0);
  });

  it("accepts a bare array as the payload", async () => {
    expect((await push([item("a", 80, 7)])).status).toBe("SUCCESS");
  });
});

describe("transactions and failures", () => {
  it("storeBatch rolls the WHOLE batch back when one row fails; prior data stays intact", async () => {
    await push({ matches: [item("prior", 80, 7)] });
    const { run } = await runs.createRunning({ trigger: "MANUAL", provider: "t" });
    const base = {
      provider: "x",
      sourceUrl: null,
      kickoffAt: FIXTURE_NOW,
      league: null,
      country: null,
      homeLogoUrl: null,
      awayLogoUrl: null,
      homeFormPct: 80,
      awayFormPct: 7,
      formScope: "league" as const,
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
      strongSide: "HOME" as const,
      formGap: 73,
      lastRunId: null,
      fetchedAt: FIXTURE_NOW,
    };
    // 100 good rows fill chunk 1; the broken row lands in chunk 2, so only a real transaction can undo chunk 1.
    const goods = Array.from({ length: 100 }, (_, n) => ({
      input: { ...base, providerMatchId: `good-${n}`, homeName: "G", awayName: "G2" },
      qualifiedAtRun: true,
    }));
    const broken = {
      input: {
        ...base,
        providerMatchId: "broken",
        homeName: null as unknown as string,
        awayName: "B",
      },
      qualifiedAtRun: true,
    };
    await expect(matches.storeBatch([...goods, broken], run.id)).rejects.toThrow();
    expect(await count()).toBe(1);
    expect((await getDb().match.findFirstOrThrow()).providerMatchId).toBe("prior");
    expect(await getDb().runMatch.count({ where: { runId: run.id } })).toBe(0);
  });

  it("a storage error marks the run FAILED with a friendly message and keeps earlier data", async () => {
    await push({ matches: [item("prior", 80, 7)] });
    const spy = vi
      .spyOn(matches, "storeBatch")
      .mockRejectedValueOnce(new Error("connection reset"));
    const r = await push({ matches: [item("new", 80, 7)] });
    spy.mockRestore();
    expect(r.status).toBe("FAILED");
    expect(r.error).toBe("Something went wrong while saving. Try again.");
    expect((await runs.getById(r.runId))?.status).toBe("FAILED");
    expect(await count()).toBe(1);
  });

  it("if even the final status cannot be written the error is rethrown (never silently lost)", async () => {
    const spyStore = vi.spyOn(matches, "storeBatch").mockRejectedValueOnce(new Error("db down"));
    const spyFinish = vi.spyOn(runs, "finish").mockRejectedValue(new Error("db still down"));
    await expect(push({ matches: [item("a", 80, 7)] })).rejects.toThrow("db still down");
    spyStore.mockRestore();
    spyFinish.mockRestore();
  });

  it("a second processBatch while a run is RUNNING returns that run and stores nothing", async () => {
    const { run } = await runs.createRunning({ trigger: "CRON", provider: "t" });
    const r = await runService.processBatch({
      trigger: "INGEST",
      provider: "assisted_ingest",
      settings,
      payload: { matches: [item("a", 80, 7)] },
      now: () => new Date(Date.now()),
    });
    expect(r).toMatchObject({ runId: run.id, status: "RUNNING", alreadyRunning: true });
    expect(await count()).toBe(0);
  });

  it("an abandoned RUNNING run (11 min old) is expired when the next run starts", async () => {
    const old = await getDb().screeningRun.create({
      data: {
        trigger: "CRON",
        provider: "t",
        status: "RUNNING",
        startedAt: new Date(FIXTURE_NOW.getTime() - 11 * 60_000),
      },
    });
    const r = await push({ matches: [item("a", 80, 7)] });
    expect(r.status).toBe("SUCCESS");
    expect((await runs.getById(old.id))?.status).toBe("FAILED");
  });

  it("500 matches are stored in one batch quickly", async () => {
    const payload = {
      matches: Array.from({ length: 500 }, (_, n) =>
        item(`bulk-${n}`, 2 + (n % 98), 2 + ((n * 7) % 98)),
      ),
    };
    const started = performance.now();
    const r = await push(payload);
    const ms = performance.now() - started;
    expect(r).toMatchObject({ status: "SUCCESS", scanned: 500 });
    expect(await count()).toBe(500);
    console.warn(`500-match batch took ${Math.round(ms)} ms`);
    // The guide asks for < 2 s against a LOCAL database; this suite runs against remote Neon (~0.5-1 s per round trip),
    // so the bound here is about round trips (7 for 500 rows), not CPU. See docs/TEST_LOG.md.
    expect(ms).toBeLessThan(12_000);
  });
});

describe("pullAndProcess", () => {
  it("rejects push-only modes with MODE_NOT_SUPPORTED before starting a run", async () => {
    await expect(
      runService.pullAndProcess({ trigger: "MANUAL", settings, ...clock }),
    ).rejects.toMatchObject({
      code: "MODE_NOT_SUPPORTED",
    });
    expect(await getDb().screeningRun.count()).toBe(0);
  });

  it("the official-api provider fails cleanly (PROVIDER_NOT_CONFIGURED) and the run is recorded FAILED", async () => {
    vi.stubEnv("PROVIDER_API_BASE", "");
    vi.stubEnv("PROVIDER_API_KEY", "");
    const s = await settingsRepo.updateSettings({ accessMode: "official_api" });
    await expect(
      runService.pullAndProcess({ trigger: "CRON", settings: s, ...clock }),
    ).rejects.toMatchObject({
      code: "PROVIDER_NOT_CONFIGURED",
    });
    const run = (await runs.list()).items[0]!;
    expect(run.status).toBe("FAILED");
    expect(run.error).toMatch(/not set up/);
  });
});

describe("rescreenAll", () => {
  it("changes qualifies when thresholds move to 70/40, and reports counts", async () => {
    await push({ matches: [item("edge", 72, 38), item("strong", 90, 5), item("mid", 50, 50)] });
    expect(await getDb().match.count({ where: { qualifies: true } })).toBe(1);
    const s = await settingsRepo.updateSettings({ highThreshold: 70, lowThreshold: 40 });
    const r = await runService.rescreenAll(s);
    expect(r).toEqual({ changed: 1, qualifying: 2 });
    const edge = await getDb().match.findFirstOrThrow({ where: { providerMatchId: "edge" } });
    expect([edge.qualifies, edge.strongSide]).toEqual([true, "HOME"]);
    // back again
    const back = await settingsRepo.updateSettings({ highThreshold: 75, lowThreshold: 35 });
    expect(await runService.rescreenAll(back)).toEqual({ changed: 1, qualifying: 1 });
  });

  it("is atomic ACROSS chunks: a failure in the second chunk rolls back the first", async () => {
    await push({ matches: [item("a", 72, 38), item("b", 90, 5)] });
    const idOf = async (k: string) =>
      (await getDb().match.findFirstOrThrow({ where: { providerMatchId: k } })).id;
    const filler = Array.from({ length: 99 }, (_, n) => ({
      id: `missing-${n}`,
      qualifies: false,
      strongSide: null,
      formGap: 0,
    }));
    const updates: matches.ScreeningUpdate[] = [
      { id: await idOf("a"), qualifies: true, strongSide: "HOME", formGap: 34 }, // chunk 1 (valid)
      ...filler,
      { id: await idOf("b"), qualifies: true, strongSide: "SIDEWAYS" as "HOME", formGap: 85 }, // chunk 2 (bad enum)
    ];
    expect(updates).toHaveLength(101);
    await expect(matches.applyScreening(updates)).rejects.toThrow();
    const a = await getDb().match.findFirstOrThrow({ where: { providerMatchId: "a" } });
    expect(a.qualifies).toBe(false); // the first chunk's valid update was rolled back too
  });

  it("with nothing to change it writes nothing", async () => {
    await push({ matches: [item("a", 80, 7)] });
    expect(await runService.rescreenAll(settings)).toEqual({ changed: 0, qualifying: 1 });
  });
});

describe("cleanup", () => {
  it("removes matches 90 days after kickoff, old attempts and counters; keeps the rest", async () => {
    const day = 86_400_000;
    await push({
      matches: [
        item("old", 80, 7, { kickoffAt: new Date(FIXTURE_NOW.getTime() - 91 * day).toISOString() }),
        item("recent", 80, 7, {
          kickoffAt: new Date(FIXTURE_NOW.getTime() - 89 * day).toISOString(),
        }),
        item("future", 80, 7),
      ],
    });
    await getDb().loginAttempt.createMany({
      data: [
        { ip: "1.1.1.1", success: false, at: new Date(FIXTURE_NOW.getTime() - 31 * day) },
        { ip: "1.1.1.1", success: false, at: new Date(FIXTURE_NOW.getTime() - 1 * day) },
      ],
    });
    await getDb().rateLimit.createMany({
      data: [
        { key: "old", count: 1, windowStart: new Date(FIXTURE_NOW.getTime() - 3 * day) },
        { key: "new", count: 1, windowStart: new Date(FIXTURE_NOW.getTime() - 3_600_000) },
      ],
    });
    expect(await runService.cleanup(FIXTURE_NOW)).toEqual({ matches: 1, attempts: 1, limits: 1 });
    expect((await getDb().match.findMany()).map((m) => m.providerMatchId).sort()).toEqual([
      "future",
      "recent",
    ]);
  });
});

describe("match-service", () => {
  it("dashboard lists only qualifying, not-yet-started matches in the tab, sorted", async () => {
    await push({
      matches: [
        item("tomorrow-strong", 80, 7, { kickoffAt: "2026-11-04T15:00:00Z" }),
        item("tomorrow-early", 76, 30, { kickoffAt: "2026-11-04T10:00:00Z", league: "Other" }),
        item("not-qualifying", 50, 50, { kickoffAt: "2026-11-04T12:00:00Z" }),
        item("today-later", 90, 2, { kickoffAt: "2026-11-03T20:00:00Z" }),
        item("already-started", 90, 2, { kickoffAt: "2026-11-03T08:00:00Z" }),
        item("dayafter", 90, 2, { kickoffAt: "2026-11-05T12:00:00Z" }),
      ],
    });
    const ids = (ms: { providerMatchId: string }[]) => ms.map((m) => m.providerMatchId);
    expect(
      ids(await matchService.getDashboard({ tab: "tomorrow" }, settings, FIXTURE_NOW)),
    ).toEqual(["tomorrow-early", "tomorrow-strong"]);
    expect(
      ids(await matchService.getDashboard({ tab: "tomorrow", sort: "gap" }, settings, FIXTURE_NOW)),
    ).toEqual(["tomorrow-strong", "tomorrow-early"]);
    expect(ids(await matchService.getDashboard({ tab: "today" }, settings, FIXTURE_NOW))).toEqual([
      "today-later",
    ]);
    expect(
      ids(await matchService.getDashboard({ tab: "dayafter" }, settings, FIXTURE_NOW)),
    ).toEqual(["dayafter"]);
    expect(
      ids(await matchService.getDashboard({ tab: "upcoming" }, settings, FIXTURE_NOW)),
    ).toHaveLength(4);
    expect(
      ids(
        await matchService.getDashboard(
          { tab: "tomorrow", league: "Other" },
          settings,
          FIXTURE_NOW,
        ),
      ),
    ).toEqual(["tomorrow-early"]);
  });

  it("getMatch returns prev/next qualifying neighbours, or null for an unknown id", async () => {
    await push({
      matches: [
        item("m1", 80, 7, { kickoffAt: "2026-11-04T10:00:00Z" }),
        item("m2", 80, 7, { kickoffAt: "2026-11-04T12:00:00Z" }),
        item("m3", 80, 7, { kickoffAt: "2026-11-04T14:00:00Z" }),
      ],
    });
    const mid = await getDb().match.findFirstOrThrow({ where: { providerMatchId: "m2" } });
    const r = await matchService.getMatch(mid.id);
    expect([r?.previous?.providerMatchId, r?.next?.providerMatchId]).toEqual(["m1", "m3"]);
    expect(await matchService.getMatch("nope")).toBeNull();
  });

  it("run stats: fresh after a run, stale after staleAfterHrs, stale with no run", async () => {
    expect((await matchService.getRunStats(settings, FIXTURE_NOW)).stale).toBe(true);
    await push({ matches: [item("a", 80, 7), item("b", 10, 20)] });
    const fresh = await matchService.getRunStats(
      settings,
      new Date(FIXTURE_NOW.getTime() + 3_600_000),
    );
    expect(fresh).toMatchObject({ scanned: 2, qualified: 1, stale: false });
    expect(fresh.lastRun?.status).toBe("SUCCESS");
    const later = await matchService.getRunStats(settings, new Date(Date.now() + 100 * 3_600_000));
    expect(later.stale).toBe(true);
  });
});

describe("settings-service", () => {
  it("updates and reports whether thresholds / window changed", async () => {
    const r = await settingsService.updateSettings({ highThreshold: 70, lowThreshold: 40 });
    expect(r).toMatchObject({ thresholdsChanged: true, windowChanged: false });
    const r2 = await settingsService.updateSettings({ windowDays: 1 });
    expect(r2).toMatchObject({ thresholdsChanged: false, windowChanged: true });
    expect((await settingsService.getSettings()).windowDays).toBe(1);
  });

  it("rejects invalid values with field errors", async () => {
    for (const bad of [
      { lowThreshold: 80, highThreshold: 70 },
      { highThreshold: 101 },
      { windowDays: 3 },
      { timezone: "Mars/Olympus" },
      { staleAfterHrs: 0 },
      { runHourLocal: 24 },
      { sessionVersion: 99 },
      { accessMode: "telepathy" },
    ]) {
      await expect(settingsService.updateSettings(bad), JSON.stringify(bad)).rejects.toMatchObject({
        code: "VALIDATION_FAILED",
      });
    }
  });

  it("validates the MERGED thresholds (changing only low above the stored high is refused)", async () => {
    await expect(settingsService.updateSettings({ lowThreshold: 80 })).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      fieldErrors: { lowThreshold: expect.any(String) },
    });
  });
});
