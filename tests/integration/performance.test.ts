import pg from "pg";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/lib/db";
import { schemaOf } from "@/lib/pg-url";
import * as settingsRepo from "@/server/repositories/settings";
import * as runsRepo from "@/server/repositories/runs";
import {
  getDashboard,
  getDashboardSummary,
  getMatch,
  getRunStats,
} from "@/server/services/match-service";
import { setupTestDb } from "./helpers";

// Step 16.1 performance evidence: no N+1 on the read paths and the dashboard query uses its index.
setupTestDb();
afterEach(() => vi.restoreAllMocks());

const NOW = new Date("2026-11-03T12:00:00Z");

async function seed(n: number, qualifiesEvery = 1) {
  const schema = schemaOf(process.env.DATABASE_URL!);
  await getDb().$executeRawUnsafe(`DELETE FROM "${schema}"."Match"`);
  await getDb().$executeRawUnsafe(
    `INSERT INTO "${schema}"."Match"
       ("id","provider","providerMatchId","kickoffAt","league","country","homeName","awayName",
        "homeFormPct","awayFormPct","formScope","qualifies","strongSide","formGap","fetchedAt","updatedAt")
     SELECT 'm'||g, 'perf', 'm'||g, $1::timestamptz + (g % 72) * interval '1 hour', 'Liga '||(g % 20), 'Peru',
            'Home '||g, 'Away '||g, 80, 10, 'league', (g % ${qualifiesEvery} = 0), 'HOME', 70, now(), now()
     FROM generate_series(1, ${n}) g`,
    NOW.toISOString(),
  );
}

/** Counts the SQL statements node-postgres sends while `run` executes. */
async function countQueries(run: () => Promise<unknown>): Promise<number> {
  const spy = vi.spyOn(pg.Client.prototype, "query");
  await run();
  const n = spy.mock.calls.length;
  spy.mockRestore();
  return n;
}

async function dashboardLoad() {
  const settings = await settingsRepo.ensureSettings();
  await getDashboard({ tab: "upcoming" }, settings, NOW);
  await getDashboardSummary(settings, NOW);
  await getRunStats(settings, NOW);
}

describe("no N+1 on the read paths", () => {
  it("dashboard issues the same number of queries for 5 and 400 matches", async () => {
    await seed(5);
    await dashboardLoad(); // warm the pool so connection setup is not counted
    const small = await countQueries(dashboardLoad);
    await seed(400);
    const large = await countQueries(dashboardLoad);
    expect(large).toBe(small);
    expect(large).toBeLessThanOrEqual(12);
  });

  it("match detail issues a constant number of queries", async () => {
    await seed(5);
    const small = await countQueries(() => getMatch("m3", NOW));
    await seed(400);
    const large = await countQueries(() => getMatch("m3", NOW));
    expect(large).toBe(small);
    expect(large).toBeLessThanOrEqual(5);
  });

  it("the runs list is two queries (page + count) regardless of size or page size", async () => {
    await settingsRepo.ensureSettings();
    for (let i = 0; i < 30; i++) {
      await getDb().screeningRun.create({
        data: {
          trigger: "MANUAL",
          provider: "perf",
          status: "SUCCESS",
          startedAt: new Date(NOW.getTime() - i * 1000),
        },
      });
    }
    const five = await countQueries(() => runsRepo.list({ pageSize: 5, excludeSkipped: true }));
    const thirty = await countQueries(() => runsRepo.list({ pageSize: 30, excludeSkipped: true }));
    expect(thirty).toBe(five);
    expect(thirty).toBeLessThanOrEqual(3);
  });
});

describe("database indexes", () => {
  type Plan = { Plan: Record<string, unknown> };
  async function explain(sql: string, params: unknown[]): Promise<string> {
    const url = process.env.DIRECT_URL_TEST!;
    const schema = schemaOf(url);
    const client = new pg.Client({
      connectionString: url.replace(/[?&]schema=[^&]*/, "").replace(/\?$/, ""),
      options: `-c search_path=${schema}`,
    });
    await client.connect();
    try {
      await client.query("SET enable_seqscan = off"); // plan shape only: tiny tables always prefer a scan otherwise
      const res = await client.query(`EXPLAIN (FORMAT JSON) ${sql}`, params);
      return JSON.stringify((res.rows[0]["QUERY PLAN"] as Plan[])[0]!.Plan);
    } finally {
      await client.end();
    }
  }

  it("the dashboard query (qualifies, kickoffAt range, ORDER BY kickoffAt LIMIT 200) uses a Match index", async () => {
    await seed(3000, 10);
    const plan = await explain(
      `SELECT * FROM "Match" WHERE "qualifies" = true AND "kickoffAt" >= $1 AND "kickoffAt" < $2
       ORDER BY "kickoffAt" ASC, "formGap" DESC, "id" ASC LIMIT 200`,
      [NOW.toISOString(), new Date(NOW.getTime() + 72 * 3_600_000).toISOString()],
    );
    expect(plan).toMatch(/Index(?: Only)? Scan|Bitmap Index Scan/);
    expect(plan).toMatch(/Match_(qualifies_kickoffAt|kickoffAt)_idx/);
    expect(plan).not.toContain('"Seq Scan"');
  });

  it("the runs list (ORDER BY startedAt DESC) uses the startedAt index", async () => {
    await settingsRepo.ensureSettings();
    for (let i = 0; i < 5; i++) {
      await getDb().screeningRun.create({
        data: {
          trigger: "MANUAL",
          provider: "perf",
          status: "SUCCESS",
          startedAt: new Date(NOW.getTime() - i * 1000),
        },
      });
    }
    const plan = await explain(
      `SELECT * FROM "ScreeningRun" WHERE "status" <> 'SKIPPED' ORDER BY "startedAt" DESC, "id" DESC LIMIT 20`,
      [],
    );
    expect(plan).toMatch(/ScreeningRun_(startedAt|status_startedAt)_idx/);
  });
});
