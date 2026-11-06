/**
 * `pnpm token:create "label"` — ops/dev helper: creates an ingest token and prints the plaintext ONCE.
 * (Step 13.1 adds the Settings UI.) Only the sha256 hash is stored in the database.
 */
import { existsSync } from "node:fs";
import { disconnectDb } from "../src/lib/db";
import { createToken } from "../src/server/services/token-service";

for (const f of [".env.local", ".env"]) {
  if (existsSync(f)) process.loadEnvFile(f);
}

async function main() {
  const label = process.argv[2] ?? "dev";
  const created = await createToken(label);
  process.stdout.write(
    `Token "${created.label}" (${created.id}) — copy it now, it is shown only once:\n${created.token}\n`,
  );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => disconnectDb());
