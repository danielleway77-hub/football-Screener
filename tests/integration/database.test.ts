import { describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import { schemaOf } from "@/lib/pg-url";
import * as credentials from "@/server/repositories/credentials";
import * as loginAttempts from "@/server/repositories/login-attempts";
import * as matches from "@/server/repositories/matches";
import * as rateLimits from "@/server/repositories/rate-limits";
import * as runs from "@/server/repositories/runs";
import * as settings from "@/server/repositories/settings";
import * as tokens from "@/server/repositories/tokens";
import { FIXTURE_NOW, loadFixtureMatches } from "../fixtures/load";
import { assertTestDatabase, setupTestDb } from "./helpers";

setupTestDb();

describe("test guard", () => {
  it("refuses to run against a non-test database", () => {
    expect(() => assertTestDatabase("postgresql://u:p@host/neondb?sslmode=require")).toThrow(
      /schema=test/,
    );
    expect(() => assertTestDatabase("postgresql://u:p@host/neondb?schema=public")).toThrow(
      /schema=test/,
    );
    expect(() => assertTestDatabase(undefined)).toThrow(/not set/);
    expect(() => assertTestDatabase("postgresql://u:p@host/neondb?schema=test")).not.toThrow();
  });

  it("the live connection really uses the test schema", async () => {
    const rows = await getDb().$queryRaw<{ s: string }[]>`SELECT current_schema() AS s`;
    expect(rows[0]?.s).toBe(schemaOf(process.env.DIRECT_URL_TEST!)); // test, or test_<name> for a parallel session
    expect(rows[0]?.s).toMatch(/^test(_[a-z0-9]+)?$/);
  });
});

describe("matches", () => {
  it("unique (provider, providerMatchId) prevents duplicates", async () => {
    const [first] = loadFixtureMatches();
    await matches.upsertMany([first!], null);
    await expect(
      getDb().match.create({ data: { ...first!, firstRunId: null } }),
    ).rejects.toMatchObject({ code: "P2002" });
    expect(await getDb().match.count()).toBe(1);
  });

  it("upsertMany is idempotent", async () => {
    const input = loadFixtureMatches();
    await matches.upsertMany(input, null);
    const before = await getDb().match.count();
    await matches.upsertMany(input, null);
    await matches.upsertMany(input, null);
    expect(await getDb().match.count()).toBe(before);
    expect(before).toBe(input.length);
  });

  it("stores the golden fixture exactly", async () => {
    await matches.upsertMany(loadFixtureMatches(), null);
    const m = await getDb().match.findFirstOrThrow({ where: { homeName: "Sporting Cristal" } });
    expect([m.homeFormPct, m.awayFormPct]).toEqual([80, 7]);
    expect([m.pHomeWin, m.pDraw, m.pAwayWin]).toEqual([76, 16, 8]);
    expect([m.pBtts, m.pOver25]).toEqual([54, 70]);
    expect([m.predHomeGoals, m.predAwayGoals]).toEqual([3, 1]);
    expect(m.kickoffAt.toISOString()).toBe("2026-11-04T00:30:00.000Z");
    expect(m.fetchedAt.toISOString()).toBe(FIXTURE_NOW.toISOString());
  });

  it("missing probabilities are stored as null, not 0", async () => {
    await matches.upsertMany(loadFixtureMatches(), null);
    const m = await getDb().match.findFirstOrThrow({ where: { homeName: "No Probs Home" } });
    expect(m.pHomeWin).toBeNull();
    expect(m.pBtts).toBeNull();
    expect(m.predHomeGoals).toBeNull();
  });

  it("firstRunId stays on update; lastRunId moves", async () => {
    const a = await runs.createRunning({ trigger: "MANUAL", provider: "t" });
    await runs.finish(a.run.id, { status: "SUCCESS", finishedAt: FIXTURE_NOW });
    const second = await runs.createRunning({ trigger: "MANUAL", provider: "t" });
    const input = [loadFixtureMatches()[0]!];
    await matches.upsertMany(input, a.run.id);
    const [updated] = await matches.upsertMany(input, second.run.id);
    expect(updated!.firstRunId).toBe(a.run.id);
    expect(updated!.lastRunId).toBe(second.run.id);
  });

  it("findQualifyingUpcoming filters by window, qualifies and league, sorted by kickoff", async () => {
    await matches.upsertMany(loadFixtureMatches(), null);
    const from = new Date("2026-11-04T00:00:00Z");
    const to = new Date("2026-11-05T00:00:00Z");
    const found = await matches.findQualifyingUpcoming({ from, to });
    expect(found.map((m) => m.homeName)).toEqual(["Sporting Cristal", "Home Weak FC", "Edge In A"]);
    const byGap = await matches.findQualifyingUpcoming({ from, to, sort: "gap" });
    expect(byGap[0]!.homeName).toBe("Sporting Cristal"); // gap 73 is the largest
    const league = await matches.findQualifyingUpcoming({ from, to, league: "Test League" });
    expect(league).toHaveLength(2);
  });

  it("findNeighbors returns previous and next qualifying matches", async () => {
    await matches.upsertMany(loadFixtureMatches(), null);
    const mid = await getDb().match.findFirstOrThrow({ where: { homeName: "Home Weak FC" } });
    const { previous, next } = await matches.findNeighbors(mid.id);
    expect(previous?.homeName).toBe("Sporting Cristal");
    expect(next?.homeName).toBe("Edge In A");
  });

  it("deleteOlderThan removes only matches that kicked off before the date", async () => {
    await matches.upsertMany(loadFixtureMatches(), null);
    const removed = await matches.deleteOlderThan(new Date("2026-11-05T00:00:00Z"));
    expect(removed).toBe(5);
    expect(await getDb().match.count()).toBe(4);
  });

  it("cascade delete removes RunMatch rows", async () => {
    const { run } = await runs.createRunning({ trigger: "MANUAL", provider: "t" });
    const [m] = await matches.upsertMany([loadFixtureMatches()[0]!], run.id);
    await matches.linkToRun(run.id, [{ matchId: m!.id, qualifiedAtRun: true }]);
    expect(await matches.countByRun(run.id)).toBe(1);
    await getDb().match.delete({ where: { id: m!.id } });
    expect(await matches.countByRun(run.id)).toBe(0);
    // and the other direction: deleting a run removes its links
    const [m2] = await matches.upsertMany([loadFixtureMatches()[1]!], run.id);
    await matches.linkToRun(run.id, [{ matchId: m2!.id, qualifiedAtRun: true }]);
    await getDb().screeningRun.delete({ where: { id: run.id } });
    expect(await getDb().runMatch.count()).toBe(0);
  });
});

describe("runs", () => {
  it("createRunning returns the existing run when one is RUNNING", async () => {
    const first = await runs.createRunning({ trigger: "CRON", provider: "t" });
    const second = await runs.createRunning({ trigger: "MANUAL", provider: "t" });
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.run.id).toBe(first.run.id);
  });

  it("two parallel createRunning calls produce exactly one RUNNING run", async () => {
    const [a, b] = await Promise.all([
      runs.createRunning({ trigger: "MANUAL", provider: "t" }),
      runs.createRunning({ trigger: "MANUAL", provider: "t" }),
    ]);
    expect(a.run.id).toBe(b.run.id);
    expect([a.created, b.created].filter(Boolean)).toHaveLength(1);
    expect(await getDb().screeningRun.count({ where: { status: "RUNNING" } })).toBe(1);
  });

  it("a finished run frees the slot for a new one", async () => {
    const first = await runs.createRunning({ trigger: "CRON", provider: "t" });
    await runs.finish(first.run.id, { status: "SUCCESS", finishedAt: FIXTURE_NOW, scanned: 9 });
    const next = await runs.createRunning({ trigger: "CRON", provider: "t" });
    expect(next.created).toBe(true);
    expect(next.run.id).not.toBe(first.run.id);
  });

  it("expireAbandoned marks runs older than 10 min FAILED (and only those)", async () => {
    const old = await getDb().screeningRun.create({
      data: {
        trigger: "CRON",
        provider: "t",
        status: "RUNNING",
        startedAt: new Date(FIXTURE_NOW.getTime() - 11 * 60_000),
      },
    });
    expect(await runs.expireAbandoned(10, FIXTURE_NOW)).toBe(1);
    const row = await runs.getById(old.id);
    expect(row?.status).toBe("FAILED");
    expect(row?.finishedAt?.toISOString()).toBe(FIXTURE_NOW.toISOString());

    const fresh = await getDb().screeningRun.create({
      data: {
        trigger: "CRON",
        provider: "t",
        status: "RUNNING",
        startedAt: new Date(FIXTURE_NOW.getTime() - 9 * 60_000),
      },
    });
    expect(await runs.expireAbandoned(10, FIXTURE_NOW)).toBe(0);
    expect((await runs.getById(fresh.id))?.status).toBe("RUNNING");
  });

  it("getLatestUsable ignores FAILED and RUNNING, prefers the newest SUCCESS/PARTIAL", async () => {
    const mk = (status: "SUCCESS" | "PARTIAL" | "FAILED", minutesAgo: number) =>
      getDb().screeningRun.create({
        data: {
          trigger: "CRON",
          provider: "t",
          status,
          startedAt: new Date(FIXTURE_NOW.getTime() - minutesAgo * 60_000),
        },
      });
    await mk("SUCCESS", 300);
    const partial = await mk("PARTIAL", 200);
    await mk("FAILED", 100);
    expect((await runs.getLatestUsable())?.id).toBe(partial.id);
  });

  it("list paginates newest first", async () => {
    for (let i = 0; i < 5; i++) {
      await getDb().screeningRun.create({
        data: {
          trigger: "CRON",
          provider: "t",
          status: "SUCCESS",
          startedAt: new Date(FIXTURE_NOW.getTime() - i * 60_000),
        },
      });
    }
    const page1 = await runs.list({ page: 1, pageSize: 2 });
    const page3 = await runs.list({ page: 3, pageSize: 2 });
    expect(page1.total).toBe(5);
    expect(page1.items).toHaveLength(2);
    expect(page3.items).toHaveLength(1);
    expect(page1.items[0]!.startedAt.getTime()).toBeGreaterThan(
      page1.items[1]!.startedAt.getTime(),
    );
  });
});

describe("review fixes", () => {
  it("finish refuses to overwrite a run that was already expired (returns null)", async () => {
    const old = await getDb().screeningRun.create({
      data: {
        trigger: "CRON",
        provider: "t",
        status: "RUNNING",
        startedAt: new Date(FIXTURE_NOW.getTime() - 11 * 60_000),
      },
    });
    await runs.expireAbandoned(10, FIXTURE_NOW);
    const result = await runs.finish(old.id, { status: "SUCCESS", finishedAt: FIXTURE_NOW });
    expect(result).toBeNull();
    expect((await runs.getById(old.id))?.status).toBe("FAILED");
    expect(await runs.getLatestUsable()).toBeNull();
  });

  it("findNeighbors reaches every match in a group sharing one kickoff time", async () => {
    const base = loadFixtureMatches()[0]!;
    const same = ["a", "b", "c"].map((k) => ({
      ...base,
      providerMatchId: "tie-" + k,
      homeName: "Tie " + k,
      kickoffAt: new Date("2026-11-04T15:00:00Z"),
    }));
    const saved = await matches.upsertMany(same, null);
    const order = [...saved].sort((x, y) => x.id.localeCompare(y.id));
    const walked: string[] = [order[0]!.id];
    let cursor = order[0]!.id;
    for (let i = 0; i < 5; i++) {
      const { next } = await matches.findNeighbors(cursor);
      if (!next) break;
      walked.push(next.id);
      cursor = next.id;
    }
    expect(walked).toEqual(order.map((m) => m.id));
    expect((await matches.findNeighbors(order[1]!.id)).previous?.id).toBe(order[0]!.id);
  });

  it("revoking twice keeps the original revokedAt; unknown id gives null", async () => {
    const t = await tokens.create("helper", "d".repeat(64));
    await tokens.revoke(t.id, new Date("2026-11-03T12:00:00Z"));
    const again = await tokens.revoke(t.id, new Date("2026-11-09T12:00:00Z"));
    expect(again?.revokedAt?.toISOString()).toBe("2026-11-03T12:00:00.000Z");
    expect(await tokens.revoke("missing", FIXTURE_NOW)).toBeNull();
  });

  it("getSettings reads without writing (updatedAt unchanged)", async () => {
    const created = await settings.ensureSettings();
    const read = await settings.getSettings();
    expect(read.updatedAt.getTime()).toBe(created.updatedAt.getTime());
  });
});

describe("settings", () => {
  it("ensureSettings creates the singleton with defaults and is idempotent", async () => {
    const a = await settings.ensureSettings();
    const b = await settings.ensureSettings();
    expect(a).toMatchObject({ id: 1, highThreshold: 75, lowThreshold: 35, windowDays: 2 });
    expect(a.timezone).toBe("Europe/London");
    expect(b.id).toBe(1);
    expect(await getDb().setting.count()).toBe(1);
  });

  it("updateSettings changes only the given fields", async () => {
    const s = await settings.updateSettings({ highThreshold: 70, lowThreshold: 40 });
    expect(s).toMatchObject({ highThreshold: 70, lowThreshold: 40, windowDays: 2 });
  });

  it("bumpSessionVersion increments", async () => {
    const before = await settings.ensureSettings();
    const after = await settings.bumpSessionVersion();
    expect(after.sessionVersion).toBe(before.sessionVersion + 1);
  });

  it("CHECK rejects lowThreshold >= highThreshold", async () => {
    await settings.ensureSettings();
    await expect(
      settings.updateSettings({ lowThreshold: 80, highThreshold: 70 }),
    ).rejects.toThrow();
    await expect(
      settings.updateSettings({ lowThreshold: 70, highThreshold: 70 }),
    ).rejects.toThrow();
  });

  it("CHECK rejects windowDays 3, hour 24, stale 0 and threshold > 100", async () => {
    await settings.ensureSettings();
    await expect(settings.updateSettings({ windowDays: 3 })).rejects.toThrow();
    await expect(settings.updateSettings({ runHourLocal: 24 })).rejects.toThrow();
    await expect(settings.updateSettings({ staleAfterHrs: 0 })).rejects.toThrow();
    await expect(settings.updateSettings({ highThreshold: 101 })).rejects.toThrow();
    await expect(settings.updateSettings({ lowThreshold: -1 })).rejects.toThrow();
    // a valid change still works afterwards
    expect((await settings.updateSettings({ windowDays: 1 })).windowDays).toBe(1);
  });
});

describe("tokens, credentials, attempts, rate limits", () => {
  it("token hash is unique and only the hash is stored", async () => {
    const t = await tokens.create("helper", "a".repeat(64));
    await expect(tokens.create("other", "a".repeat(64))).rejects.toMatchObject({ code: "P2002" });
    expect((await tokens.findByHash("a".repeat(64)))?.id).toBe(t.id);
    expect(await tokens.findByHash("b".repeat(64))).toBeNull();
    const raw = await getDb().ingestToken.findUniqueOrThrow({ where: { id: t.id } });
    expect(raw.tokenHash).toBe("a".repeat(64));
    expect(raw.tokenHash).toHaveLength(64);
  });

  it("touch and revoke update the token", async () => {
    const t = await tokens.create("helper", "c".repeat(64));
    await tokens.touch(t.id, FIXTURE_NOW);
    const revoked = await tokens.revoke(t.id, FIXTURE_NOW);
    expect(revoked?.revokedAt?.toISOString()).toBe(FIXTURE_NOW.toISOString());
    expect((await tokens.list())[0]!.lastUsedAt?.toISOString()).toBe(FIXTURE_NOW.toISOString());
  });

  it("rate-limit counter increments within a window and windows are independent", async () => {
    const w = new Date("2026-11-03T14:00:00Z");
    expect(await rateLimits.increment("ingest:t1:2026-11-03T14", w)).toBe(1);
    expect(await rateLimits.increment("ingest:t1:2026-11-03T14", w)).toBe(2);
    expect(
      await rateLimits.increment("ingest:t1:2026-11-03T15", new Date("2026-11-03T15:00:00Z")),
    ).toBe(1);
    expect(await rateLimits.purgeOlderThan(new Date("2026-11-03T15:00:00Z"))).toBe(1);
  });

  it("concurrent rate-limit increments do not lose updates", async () => {
    const w = new Date("2026-11-03T14:00:00Z");
    await Promise.all(Array.from({ length: 10 }, () => rateLimits.increment("k", w)));
    expect(await getDb().rateLimit.findUniqueOrThrow({ where: { key: "k" } })).toMatchObject({
      count: 10,
    });
  });

  it("login attempts: counts only recent failures for the same ip; purge removes old", async () => {
    const at = (m: number) => new Date(FIXTURE_NOW.getTime() - m * 60_000);
    await loginAttempts.record("1.1.1.1", false, at(5));
    await loginAttempts.record("1.1.1.1", false, at(20));
    await loginAttempts.record("1.1.1.1", true, at(1));
    await loginAttempts.record("2.2.2.2", false, at(1));
    expect(await loginAttempts.countRecentFailures("1.1.1.1", at(15))).toBe(1);
    expect(await loginAttempts.countRecentFailures("1.1.1.1", at(30))).toBe(2);
    expect(await loginAttempts.purge(at(10))).toBe(1);
  });

  it("credentials: null until set, then replaced", async () => {
    expect(await credentials.getPasswordHash()).toBeNull();
    await credentials.setPasswordHash("hash-1");
    await credentials.setPasswordHash("hash-2");
    expect(await credentials.getPasswordHash()).toBe("hash-2");
    expect(await getDb().credential.count()).toBe(1);
  });
});
