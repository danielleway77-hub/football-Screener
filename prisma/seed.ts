/**
 * Idempotent seed. Always ensures the Setting singleton. In development ONLY (NODE_ENV !== "production")
 * it also loads tests/fixtures/matches.json so the dashboard has data. Production seeds Setting only.
 * Run twice: counts stay the same. No secrets here.
 */
import { existsSync } from "node:fs";
import { disconnectDb, getDb } from "../src/lib/db";
import { upsertMany } from "../src/server/repositories/matches";
import { ensureSettings } from "../src/server/repositories/settings";
import { loadFixtureMatches } from "../tests/fixtures/load";

for (const f of [".env.local", ".env"]) {
  if (existsSync(f)) process.loadEnvFile(f);
}

async function main() {
  await ensureSettings();
  let matches = 0;
  // Fixtures need an explicit opt-in AND a non-production NODE_ENV (.env.local may point at a real database).
  if (process.env.NODE_ENV !== "production" && process.env.SEED_FIXTURES === "1") {
    matches = (await upsertMany(loadFixtureMatches(), null)).length;
  }
  const db = getDb();
  const [settings, total] = await Promise.all([db.setting.count(), db.match.count()]);
  process.stdout.write(
    `Seed done: Setting rows=${settings}, Match rows=${total} (fixtures upserted: ${matches})
`,
  );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => disconnectDb());
