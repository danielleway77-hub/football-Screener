/**
 * Applies prisma/migrations/*\/migration.sql with `pg`, recording each one in `_prisma_migrations`
 * exactly like `prisma migrate deploy` does (so the Prisma CLI stays compatible).
 *
 * WHY this exists: on this Windows machine Prisma's Rust schema engine reports P1001 for Neon while
 * Node's `pg` connects fine (see docs/PROJECT_STATE.md). Production deploys can still use
 * `prisma migrate deploy`. Usage: `pnpm db:migrate` (dev) · `PRISMA_ENV=test pnpm db:migrate` (test schema).
 */
import { createHash, randomUUID } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { normalizeSsl } from "../src/lib/pg-url";

export async function applyMigrations(connectionString: string, schema: string) {
  const client = new pg.Client({ connectionString: normalizeSsl(connectionString) });
  await client.connect();
  const applied: string[] = [];
  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    await client.query(`CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      id VARCHAR(36) PRIMARY KEY NOT NULL, checksum VARCHAR(64) NOT NULL, finished_at TIMESTAMPTZ,
      migration_name VARCHAR(255) NOT NULL, logs TEXT, rolled_back_at TIMESTAMPTZ,
      started_at TIMESTAMPTZ NOT NULL DEFAULT now(), applied_steps_count INTEGER NOT NULL DEFAULT 0)`);
    const done = new Set(
      (
        await client.query(
          `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`,
        )
      ).rows.map((r: { migration_name: string }) => r.migration_name),
    );
    const dir = path.join(process.cwd(), "prisma", "migrations");
    const names = readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    for (const name of names) {
      if (done.has(name)) continue;
      const file = path.join(dir, name, "migration.sql");
      const sql = readFileSync(file, "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO "_prisma_migrations" (id, checksum, migration_name, finished_at, applied_steps_count) VALUES ($1,$2,$3,now(),1)`,
          [randomUUID(), checksum, name],
        );
        await client.query("COMMIT");
        applied.push(name);
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      }
    }
  } finally {
    await client.end();
  }
  return applied;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const isTest = process.env.PRISMA_ENV === "test";
  for (const f of isTest ? [".env.test.local"] : [".env.local", ".env"]) {
    if (existsSync(f)) process.loadEnvFile(f);
  }
  const url = isTest ? process.env.DIRECT_URL_TEST : process.env.DIRECT_URL;
  if (!url) throw new Error("DIRECT_URL (or DIRECT_URL_TEST) is not set");
  const schema = isTest ? "test" : "public";
  applyMigrations(url, schema).then(
    (a) => console.log(a.length ? `Applied: ${a.join(", ")}` : "No pending migrations."),
    (e) => {
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    },
  );
}
