/**
 * `pnpm db:verify` — read-only check that a database holds the schema this app expects.
 * Uses DIRECT_URL (falls back to DATABASE_URL) from the process environment or .env.local. Prints table, index and
 * constraint names and row counts only — never connection strings or data. Exits 1 if anything is missing.
 */
import { existsSync } from "node:fs";
import pg from "pg";
import { normalizeSsl, schemaOf, stripPrismaParams } from "../src/lib/pg-url";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const TABLES = [
  "Setting",
  "Match",
  "ScreeningRun",
  "RunMatch",
  "IngestToken",
  "Credential",
  "LoginAttempt",
  "RateLimit",
  "_prisma_migrations",
];
const INDEXES = [
  "one_running_run",
  "Match_provider_providerMatchId_key",
  "IngestToken_tokenHash_key",
];
const CHECKS = [
  "Setting_thresholds_check",
  "Setting_windowDays_check",
  "Setting_runHourLocal_check",
  "Setting_staleAfterHrs_check",
];

async function main() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DIRECT_URL or DATABASE_URL must be set");
  const schema = schemaOf(url);
  const client = new pg.Client({ connectionString: normalizeSsl(stripPrismaParams(url)) });
  await client.connect();
  let failed = false;
  const check = (ok: boolean, label: string, detail = "") => {
    if (!ok) failed = true;
    process.stdout.write(`${ok ? "OK  " : "MISSING"} ${label}${detail ? `  ${detail}` : ""}\n`);
  };
  try {
    const q = async (sql: string, params: unknown[]) => (await client.query(sql, params)).rows;
    const tables = (
      await q(`SELECT table_name FROM information_schema.tables WHERE table_schema=$1`, [schema])
    ).map((r) => r.table_name as string);
    const indexes = (await q(`SELECT indexname FROM pg_indexes WHERE schemaname=$1`, [schema])).map(
      (r) => r.indexname as string,
    );
    const checks = (
      await q(
        `SELECT c.conname FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname=$1 AND c.contype='c'`,
        [schema],
      )
    ).map((r) => r.conname as string);
    process.stdout.write(`schema: ${schema}\n`);
    for (const t of TABLES) check(tables.includes(t), `table ${t}`);
    for (const i of INDEXES) check(indexes.includes(i), `index ${i}`);
    for (const c of CHECKS) check(checks.includes(c), `check ${c}`);
    const mig = await q(
      `SELECT count(*)::int AS n, count(finished_at)::int AS done FROM "${schema}"."_prisma_migrations"`,
      [],
    );
    check(
      mig[0].n >= 1 && mig[0].n === mig[0].done,
      "migrations all finished",
      `${mig[0].done}/${mig[0].n}`,
    );
    const counts: string[] = [];
    for (const t of ["Setting", "Match", "ScreeningRun"]) {
      const r = await q(`SELECT count(*)::int AS n FROM "${schema}"."${t}"`, []);
      counts.push(`${t}=${r[0].n}`);
    }
    process.stdout.write(`row counts: ${counts.join(" ")}\n`);
  } finally {
    await client.end();
  }
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  process.stderr.write(`db:verify failed: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
