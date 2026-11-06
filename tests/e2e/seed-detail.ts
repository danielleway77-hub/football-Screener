import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import pg from "pg";
import { normalizeSsl, schemaOf } from "../../src/lib/pg-url";

/** A short-lived pg client on the isolated schema (Prisma's generated client is ESM-only and cannot load in Playwright). */
export async function withE2eDb<T>(fn: (c: pg.Client) => Promise<T>): Promise<T> {
  if (existsSync(".env.test.local")) process.loadEnvFile(".env.test.local");
  const url = process.env.DIRECT_URL_TEST ?? "";
  const client = new pg.Client({ connectionString: normalizeSsl(url) });
  await client.connect();
  try {
    await client.query(`SET search_path TO "${schemaOf(url)}"`);
    return await fn(client);
  } finally {
    await client.end();
  }
}

/**
 * Deterministic matches for the detail-page specs, written to the ISOLATED e2e schema (test_<name>) that the
 * dev server reads (see playwright.config.ts). Kickoffs are relative to "now" so the pager (upcoming only) works.
 * Ids are stored in tests/e2e/.auth/detail-ids.json for the specs.
 */
export const DETAIL_IDS_FILE = "tests/e2e/.auth/detail-ids.json";
export const XSS_NAME = "<script>window.__xss=1</script> Rovers";
export const LONG_NAME =
  "Associazione Sportiva Dilettantistica Unione Calcio Real Sociedad Atletico";

const HOUR = 3_600_000;
const base = {
  formScope: "league" as const,
  homeLogoUrl: null,
  awayLogoUrl: null,
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
  sourceUrl: null,
  league: "Test League",
  country: null,
  lastRunId: null,
};

export default async function seedDetail() {
  if (existsSync(".env.test.local")) process.loadEnvFile(".env.test.local");
  const url = process.env.DIRECT_URL_TEST ?? "";
  if (!/[?&]schema=test(_[a-z0-9]+)?(&|$)/.test(url)) return; // no isolated schema configured
  const now = Date.now();
  const at = (h: number) => new Date(now + h * HOUR);
  const rows = [
    {
      key: "away-strong",
      homeName: "Home Weak FC",
      awayName: "Away Strong United",
      homeFormPct: 30,
      awayFormPct: 82,
      kickoffAt: at(20),
      qualifies: true,
      strongSide: "AWAY" as const,
    },
    {
      key: "golden",
      homeName: "Sporting Cristal",
      awayName: "FC Cajamarca",
      homeFormPct: 80,
      awayFormPct: 7,
      kickoffAt: at(30),
      qualifies: true,
      strongSide: "HOME" as const,
      country: "Peru",
      league: "Liga 1",
      sourceUrl: "https://example.com/predigoal/match/golden",
      homeLastResults: "WWWDW",
      awayLastResults: "LLLDL",
      pHomeWin: 76,
      pDraw: 16,
      pAwayWin: 8,
      pBtts: 54,
      pOver25: 70,
      predHomeGoals: 3,
      predAwayGoals: 1,
      confidence: "HIGH" as const,
    },
    {
      key: "xss",
      homeName: XSS_NAME,
      awayName: LONG_NAME,
      homeFormPct: 90,
      awayFormPct: 10,
      kickoffAt: at(40),
      qualifies: true,
      strongSide: "HOME" as const,
      sourceUrl: "javascript:alert(1)",
    },
    {
      // Stored as qualifying, but 60/40 does not meet the rule: the "no longer qualifies" note must show.
      key: "stale-flag",
      homeName: "Middle Town",
      awayName: "Centre City",
      homeFormPct: 60,
      awayFormPct: 40,
      kickoffAt: at(25),
      qualifies: true,
      strongSide: "HOME" as const,
    },
    {
      // Used by the threshold-change spec (desktop project only): 78 > 75 qualifies, 78 < 79 does not.
      key: "threshold",
      homeName: "Marginal United",
      awayName: "Low Rovers",
      homeFormPct: 78,
      awayFormPct: 10,
      kickoffAt: at(26),
      qualifies: true,
      strongSide: "HOME" as const,
    },
  ];
  await withE2eDb(async (db) => {
    await db.query(
      `INSERT INTO "Setting" ("id","updatedAt") VALUES (1, now())
       ON CONFLICT ("id") DO UPDATE SET "highThreshold" = 75, "lowThreshold" = 35`,
    );
    await db.query('DELETE FROM "RunMatch"');
    await db.query('DELETE FROM "Match"'); // isolated schema: start from a known set (integration tests leave rows)
    const ids: Record<string, string> = {};
    for (const { key, ...r } of rows) {
      const row = { ...base, ...r };
      const id = `e2e_${key.replace(/-/g, "_")}`;
      await db.query(
        `INSERT INTO "Match" ("id","provider","providerMatchId","sourceUrl","kickoffAt","league","country","homeName","awayName",
          "homeLogoUrl","awayLogoUrl","homeFormPct","awayFormPct","formScope","homeLastResults","awayLastResults","pHomeWin","pDraw",
          "pAwayWin","pBtts","pOver25","predHomeGoals","predAwayGoals","confidence","qualifies","strongSide","formGap","lastRunId",
          "fetchedAt","updatedAt")
         VALUES ($1,'e2e-detail',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28, now())`,
        [
          id,
          key,
          row.sourceUrl,
          row.kickoffAt,
          row.league,
          row.country,
          row.homeName,
          row.awayName,
          row.homeLogoUrl,
          row.awayLogoUrl,
          row.homeFormPct,
          row.awayFormPct,
          row.formScope,
          row.homeLastResults,
          row.awayLastResults,
          row.pHomeWin,
          row.pDraw,
          row.pAwayWin,
          row.pBtts,
          row.pOver25,
          row.predHomeGoals,
          row.predAwayGoals,
          row.confidence,
          row.qualifies,
          row.strongSide,
          Math.abs(row.homeFormPct - row.awayFormPct),
          row.lastRunId,
          new Date(now - 2 * HOUR),
        ],
      );
      ids[key] = id;
    }
    mkdirSync("tests/e2e/.auth", { recursive: true });
    writeFileSync(DETAIL_IDS_FILE, JSON.stringify(ids));
  });
}
