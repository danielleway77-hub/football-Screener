import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/lib/db";
import type { MatchProvider } from "@/server/providers";
import * as loginAttempts from "@/server/repositories/login-attempts";
import * as matches from "@/server/repositories/matches";
import * as rateLimits from "@/server/repositories/rate-limits";
import * as runs from "@/server/repositories/runs";
import * as settingsRepo from "@/server/repositories/settings";
import { loadFixtureMatches } from "../fixtures/load";
import { setupTestDb } from "./helpers";

const SECRET = "c".repeat(40);
const DAY = 86_400_000;

// A controllable provider: official_api resolves to it, push modes keep the real (non-pulling) ones.
let fetchWindow: NonNullable<MatchProvider["fetchWindow"]>;
vi.mock("@/server/providers", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/server/providers")>();
  return {
    ...real,
    getProvider: (mode: string) =>
      mode === "official_api"
        ? {
            key: "official_api",
            canPull: true,
            fetchWindow: (...a: Parameters<typeof fetchWindow>) => fetchWindow(...a),
          }
        : real.getProvider(mode as Parameters<typeof real.getProvider>[0]),
  };
});

setupTestDb();

const call = async (authorization?: string) =>
  (await import("@/app/api/cron/daily/route")).GET(
    new Request("http://localhost:3000/api/cron/daily", {
      method: "GET",
      headers: authorization ? { authorization } : {},
    }),
  );
const authed = () => call(`Bearer ${SECRET}`);

const raw = (id: string, home = 80, away = 7) => ({
  provider: "predigoal",
  providerMatchId: id,
  kickoffAt: new Date(Date.now() + DAY),
  league: "L",
  home: { name: `H${id}`, formPct: home },
  away: { name: `A${id}`, formPct: away },
  formScope: "league" as const,
  probabilities: { homeWin: 76, draw: 16, awayWin: 8, btts: 54, over25: 70 },
});

async function seedMatch(id: string, kickoffAt: Date) {
  const base = loadFixtureMatches()[0]!;
  await matches.upsertMany([{ ...base, providerMatchId: id, kickoffAt }], null);
}
const count = () => getDb().match.count();

beforeEach(async () => {
  vi.stubEnv("CRON_SECRET", SECRET);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  fetchWindow = async () => [];
  await settingsRepo.ensureSettings();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const setMode = (accessMode: "official_api" | "manual_import" | "assisted_ingest") =>
  getDb().setting.updateMany({ data: { accessMode } });

describe("GET /api/cron/daily - authentication", () => {
  it("cron rejects missing and wrong secret, and does nothing", async () => {
    await setMode("official_api");
    const bad = [
      undefined,
      "Bearer wrong",
      `Bearer ${SECRET}x`,
      `Bearer ${SECRET.slice(0, -1)}`,
      SECRET,
      `bearer ${SECRET}`,
    ];
    for (const header of bad) {
      const res = await call(header);
      expect(res.status).toBe(401);
      expect(JSON.stringify(await res.json())).not.toContain(SECRET);
    }
    expect(await getDb().screeningRun.count()).toBe(0);
  });

  it("rejects everything when CRON_SECRET is not configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await call("Bearer ")).status).toBe(401);
  });

  it("the correct secret is accepted", async () => {
    const res = await authed();
    expect(res.status).toBe(200);
  });
});

describe("GET /api/cron/daily - pull mode", () => {
  beforeEach(() => setMode("official_api"));

  it("pull mode success with a fake provider", async () => {
    fetchWindow = async () => [raw("1"), raw("2", 50, 50)];
    const res = await authed();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("SUCCESS");
    expect(body.cleaned).toEqual({ matches: 0, runs: 0, attempts: 0, rateLimits: 0 });
    const run = await runs.getById(body.runId);
    expect(run).toMatchObject({
      trigger: "CRON",
      provider: "official_api",
      scanned: 2,
      qualified: 1,
    });
    expect(await count()).toBe(2);
  });

  it("cron is idempotent within 30 min and runs again after", async () => {
    fetchWindow = async () => [raw("1")];
    const first = await (await authed()).json();
    const second = await authed();
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ skipped: "recent", runId: first.runId });
    expect(await getDb().screeningRun.count()).toBe(1);

    // 31 minutes later the same endpoint runs again.
    vi.useFakeTimers({ toFake: ["Date"], now: Date.now() + 31 * 60_000 });
    const third = await (await authed()).json();
    expect(third.skipped).toBeUndefined();
    expect(third.runId).not.toBe(first.runId);
  });

  it("provider failure → FAILED run, data intact", async () => {
    fetchWindow = async () => [raw("1")];
    await authed();
    const before = await getDb().match.findMany({ orderBy: { providerMatchId: "asc" } });

    // A later run (31 min on) whose provider throws a plain error.
    vi.useFakeTimers({ toFake: ["Date"], now: Date.now() + 31 * 60_000 });
    fetchWindow = async () => {
      throw new Error("socket hang up secret-detail");
    };
    const res = await authed();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.status).toBe("FAILED");
    expect(JSON.stringify(body)).not.toContain("secret-detail");
    const run = await runs.getById(body.runId);
    expect(run?.status).toBe("FAILED");
    expect(run?.error).toBeTruthy();
    expect(await getDb().match.findMany({ orderBy: { providerMatchId: "asc" } })).toEqual(before);
    // Cleanup still ran and reports numbers.
    expect(body.cleaned).toEqual({ matches: 0, runs: 0, attempts: 0, rateLimits: 0 });
  });

  it("a known provider error (not configured) becomes a FAILED run with its readable message", async () => {
    fetchWindow = async () => {
      const { AppError } = await import("@/server/errors");
      throw new AppError("PROVIDER_NOT_CONFIGURED", "The data provider is not set up yet.");
    };
    const res = await authed();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toMatchObject({ status: "FAILED", error: "The data provider is not set up yet." });
    expect((await runs.getById(body.runId))?.error).toBe("The data provider is not set up yet.");
  });

  it("abandoned run expired first (and does not block the cron)", async () => {
    const old = await getDb().screeningRun.create({
      data: {
        trigger: "MANUAL",
        provider: "official_api",
        status: "RUNNING",
        startedAt: new Date(Date.now() - 11 * 60_000),
      },
    });
    fetchWindow = async () => [raw("1")];
    const body = await (await authed()).json();
    expect(body.status).toBe("SUCCESS");
    expect((await runs.getById(old.id))?.status).toBe("FAILED");
  });

  it("DST day: the window passed to the provider is 23 h on 2026-03-29 (Europe/London) and 25 h on 2026-10-25", async () => {
    await getDb().setting.updateMany({ data: { windowDays: 1 } });
    const seen: { from: Date; to: Date }[] = [];
    fetchWindow = async (range) => {
      seen.push(range);
      return [];
    };
    // 06:00 UTC the day before the spring-forward day, then before the fall-back day.
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-03-28T06:00:00Z") });
    const spring = await (await authed()).json();
    vi.setSystemTime(new Date("2026-10-24T06:00:00Z"));
    const fall = await (await authed()).json();

    expect(seen[0]!.from.toISOString()).toBe("2026-03-29T00:00:00.000Z");
    expect(seen[0]!.to.toISOString()).toBe("2026-03-29T23:00:00.000Z");
    expect(seen[1]!.from.toISOString()).toBe("2026-10-24T23:00:00.000Z");
    expect(seen[1]!.to.toISOString()).toBe("2026-10-26T00:00:00.000Z");
    const hours = (r: { from: Date; to: Date }) => (r.to.getTime() - r.from.getTime()) / 3_600_000;
    expect([hours(seen[0]!), hours(seen[1]!)]).toEqual([24 - 1, 25]);
    const run = await runs.getById(spring.runId);
    expect(run?.windowFrom?.toISOString()).toBe("2026-03-29T00:00:00.000Z");
    expect(run?.windowTo?.toISOString()).toBe("2026-03-29T23:00:00.000Z");
    expect(fall.status).toBe("SUCCESS");
  });
});

describe("GET /api/cron/daily - push modes", () => {
  it.each(["manual_import", "assisted_ingest"] as const)(
    "%s → one SKIPPED run, no data change, once per owner day",
    async (mode) => {
      await setMode(mode);
      await seedMatch("keep", new Date(Date.now() + DAY));
      const res = await authed();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("SKIPPED");
      const run = await runs.getById(body.runId);
      expect(run).toMatchObject({ status: "SKIPPED", trigger: "CRON", scanned: 0 });
      expect(run?.error).toMatch(/push mode/);
      expect(await count()).toBe(1);

      // Later the same day: recent-skip is over, but no second SKIPPED row is created.
      vi.useFakeTimers({ toFake: ["Date"], now: Date.now() + 31 * 60_000 });
      const again = await (await authed()).json();
      expect(again.status).toBe("SKIPPED");
      expect(again.runId).toBeUndefined();
      expect(await getDb().screeningRun.count()).toBe(1);
    },
  );

  it("does not add a SKIPPED row when another run already happened today", async () => {
    await setMode("manual_import");
    await getDb().screeningRun.create({
      data: {
        trigger: "IMPORT",
        provider: "manual_import",
        status: "SUCCESS",
        finishedAt: new Date(),
      },
    });
    const body = await (await authed()).json();
    expect(body.status).toBe("SKIPPED");
    expect(await getDb().screeningRun.count()).toBe(1);
  });

  it("SKIPPED runs can be hidden from the list", async () => {
    await setMode("manual_import");
    await authed();
    await getDb().screeningRun.create({
      data: {
        trigger: "IMPORT",
        provider: "manual_import",
        status: "SUCCESS",
        finishedAt: new Date(),
      },
    });
    const all = await runs.list();
    const visible = await runs.list({ excludeSkipped: true });
    expect(all.total).toBe(2);
    expect(visible.total).toBe(1);
    expect(visible.items.map((r) => r.status)).toEqual(["SUCCESS"]);
  });
});

describe("GET /api/cron/daily - cleanup", () => {
  it("cleanup keeps upcoming matches and deletes only rows with kickoff older than 90 days", async () => {
    await setMode("manual_import");
    const now = Date.now();
    await seedMatch("old", new Date(now - 91 * DAY));
    await seedMatch("edge", new Date(now - 89 * DAY));
    await seedMatch("yesterday", new Date(now - DAY));
    await seedMatch("upcoming", new Date(now + DAY));
    await seedMatch("far", new Date(now + 400 * DAY));
    await loginAttempts.record("1.1.1.1", false, new Date(now - 31 * DAY));
    await loginAttempts.record("1.1.1.1", false, new Date(now - 29 * DAY));
    await rateLimits.increment("k-old", new Date(now - 3 * DAY));
    await rateLimits.increment("k-new", new Date(now - DAY));

    const body = await (await authed()).json();
    expect(body.cleaned).toEqual({ matches: 1, runs: 0, attempts: 1, rateLimits: 1 });
    const left = (await getDb().match.findMany()).map((m) => m.providerMatchId).sort();
    expect(left).toEqual(["edge", "far", "upcoming", "yesterday"]);
    expect(await getDb().loginAttempt.count()).toBe(1);
    expect(await getDb().rateLimit.count()).toBe(1);
  });

  it("the recent-run shortcut answers without running anything else (no cleanup)", async () => {
    await setMode("official_api");
    fetchWindow = async () => [];
    await authed();
    await seedMatch("old", new Date(Date.now() - 100 * DAY));
    const second = await (await authed()).json();
    expect(second.skipped).toBe("recent");
    expect(await count()).toBe(1);
  });
});

describe("review fixes (9.1)", () => {
  beforeEach(() => setMode("official_api"));

  it("a FAILED run does not block a retry: the next call runs again and can succeed", async () => {
    fetchWindow = async () => {
      throw new Error("provider down");
    };
    const failed = await authed();
    expect(failed.status).toBe(500);
    fetchWindow = async () => [raw("retry-1")];
    const retry = await authed();
    expect(retry.status).toBe(200);
    const body = await retry.json();
    expect(body.skipped).toBeUndefined();
    expect(body.status).toBe("SUCCESS");
    expect(await count()).toBe(1);
  });

  it("while another run is in progress the cron reports skipped:running (200), not a success", async () => {
    const { run } = await runs.createRunning({ trigger: "MANUAL", provider: "t" });
    const res = await authed();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      skipped: "running",
      runId: run.id,
      status: "RUNNING",
    });
    expect(await count()).toBe(0);
  });

  it("the failure lookup only ever returns a FAILED run (never another run that is still RUNNING)", async () => {
    const running = await runs.createRunning({ trigger: "CRON", provider: "t" });
    const since = new Date(Date.now() - 60_000);
    expect(await runs.findStartedSince("CRON", since)).toBeNull();
    await getDb().screeningRun.update({
      where: { id: running.run.id },
      data: { status: "FAILED" },
    });
    expect((await runs.findStartedSince("CRON", since))?.id).toBe(running.run.id);
  });

  it("isValidCronAuth: unset or empty secret never authenticates; prefix and case variants fail", async () => {
    const { isValidCronAuth } = await import("@/server/services/cron-service");
    expect(isValidCronAuth(`Bearer ${SECRET}`, undefined)).toBe(false);
    expect(isValidCronAuth("Bearer ", "")).toBe(false);
    expect(isValidCronAuth(null, SECRET)).toBe(false);
    expect(isValidCronAuth(`Bearer ${SECRET}`, SECRET)).toBe(true);
    expect(isValidCronAuth(`Bearer ${SECRET.slice(0, -1)}`, SECRET)).toBe(false);
    expect(isValidCronAuth(`Bearer ${SECRET}x`, SECRET)).toBe(false);
    expect(isValidCronAuth(`bearer ${SECRET}`, SECRET)).toBe(false);
  });
});
