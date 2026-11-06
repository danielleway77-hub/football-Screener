import { existsSync } from "node:fs";
import { applyMigrations } from "../../scripts/db-migrate";
import { schemaOf } from "../../src/lib/pg-url";

// Runs before the e2e dev server: makes sure the isolated schema exists and is migrated.
if (existsSync(".env.test.local")) process.loadEnvFile(".env.test.local");
const url = process.env.DIRECT_URL_TEST;
if (!url) throw new Error("DIRECT_URL_TEST is not set");
applyMigrations(url, schemaOf(url)).then(
  (a) => console.log(a.length ? `e2e db: applied ${a.join(", ")}` : "e2e db: up to date"),
  (e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  },
);
