import { existsSync } from "node:fs";
import { afterAll, beforeAll, beforeEach } from "vitest";
import { applyMigrations } from "../../scripts/db-migrate";
import { disconnectDb, getDb } from "@/lib/db";
import { schemaOf } from "@/lib/pg-url";

/** Refuses anything that is not the isolated `test` schema (never touch dev/prod data). */
export function assertTestDatabase(url: string | undefined): asserts url is string {
  if (!url) throw new Error("DATABASE_URL_TEST is not set (see .env.test.local)");
  if (schemaOf(url) !== "test") {
    throw new Error("Refusing to run: the test database URL must contain schema=test");
  }
}

const TABLES = [
  "RunMatch",
  "Match",
  "ScreeningRun",
  "IngestToken",
  "LoginAttempt",
  "RateLimit",
  "Credential",
  "Setting",
];

/** Call once at the top of an integration test file: migrate the test schema, reset before each test. */
export function setupTestDb() {
  beforeAll(async () => {
    if (existsSync(".env.test.local")) process.loadEnvFile(".env.test.local");
    assertTestDatabase(process.env.DATABASE_URL_TEST);
    assertTestDatabase(process.env.DIRECT_URL_TEST);
    // DIRECT connection: the pooler (PgBouncer) does not keep `SET search_path` between queries, so the
    // isolated schema would silently fall back to `public`.
    process.env.DATABASE_URL = process.env.DIRECT_URL_TEST;
    await applyMigrations(process.env.DIRECT_URL_TEST, "test");
  });

  beforeEach(async () => {
    const [row] = await getDb().$queryRaw<{ s: string }[]>`SELECT current_schema() AS s`;
    if (row?.s !== "test") throw new Error(`Refusing to TRUNCATE: current schema is ${row?.s}`);
    await getDb().$executeRawUnsafe(
      `TRUNCATE ${TABLES.map((t) => `"test"."${t}"`).join(", ")} RESTART IDENTITY CASCADE`,
    );
  });

  afterAll(async () => {
    await disconnectDb();
  });
}
