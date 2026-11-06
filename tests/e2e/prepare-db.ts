import { existsSync } from "node:fs";
import pg from "pg";
import { applyMigrations } from "../../scripts/db-migrate";
import { normalizeSsl, schemaOf } from "../../src/lib/pg-url";

// Runs before the e2e dev server: makes sure the isolated schema exists and is migrated, and removes the
// leftovers integration tests keep in the same schema (a Credential row would override the e2e password).
if (existsSync(".env.test.local")) process.loadEnvFile(".env.test.local");
const url = process.env.DIRECT_URL_TEST;
if (!url) throw new Error("DIRECT_URL_TEST is not set");

async function main(connection: string) {
  const schema = schemaOf(connection);
  const applied = await applyMigrations(connection, schema);
  const client = new pg.Client({ connectionString: normalizeSsl(connection) });
  await client.connect();
  try {
    await client.query(`SET search_path TO "${schema}"`);
    await client.query('DELETE FROM "Credential"');
    await client.query('DELETE FROM "LoginAttempt"');
    await client.query('DELETE FROM "RateLimit"');
  } finally {
    await client.end();
  }
  console.log(applied.length ? `e2e db: applied ${applied.join(", ")}` : "e2e db: up to date");
}

main(url).catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
