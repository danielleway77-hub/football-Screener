/**
 * Runs the daily job against a running app: `pnpm run:daily` (BASE_URL defaults to http://localhost:3000,
 * CRON_SECRET comes from the environment or .env.local). Prints the JSON answer; exits 1 on any failure.
 */
import { existsSync } from "node:fs";

async function main(): Promise<number> {
  for (const file of [".env.local", ".env"]) if (existsSync(file)) process.loadEnvFile(file);
  const base = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("run:daily: CRON_SECRET is not set (put it in .env.local or the environment).");
    return 1;
  }
  let res: Response;
  try {
    res = await fetch(`${base}/api/cron/daily`, {
      headers: { authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(65_000),
    });
  } catch (error) {
    console.error(
      `run:daily: could not reach ${base} (${(error as Error).message}). Is the app running?`,
    );
    return 1;
  }
  const text = await res.text();
  try {
    console.log(JSON.stringify(JSON.parse(text), null, 2));
  } catch {
    console.log(text);
  }
  if (!res.ok) {
    console.error(`run:daily: failed with HTTP ${res.status}`);
    return 1;
  }
  return 0;
}

void main().then((code) => process.exit(code));
