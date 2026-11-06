import { existsSync } from "node:fs";
import { request, type FullConfig } from "@playwright/test";

export const STORAGE_STATE = "tests/e2e/.auth/owner.json";

/** Signs in once through the real API and stores the cookie; specs reuse it (login specs opt out). */
export default async function globalSetup(config: FullConfig) {
  if (existsSync(".env.test.local")) process.loadEnvFile(".env.test.local");
  const password = process.env.E2E_PASSWORD;
  if (!password) throw new Error("E2E_PASSWORD is not set (see .env.test.local)");
  const baseURL = config.projects[0]!.use.baseURL!;
  const ctx = await request.newContext({ baseURL });
  const res = await ctx.post("/api/auth/login", {
    data: { password },
    headers: { Origin: baseURL, "x-forwarded-for": "198.51.100.250" },
  });
  if (res.status() !== 204) throw new Error(`e2e login failed with HTTP ${res.status()}`);
  await ctx.storageState({ path: STORAGE_STATE });
  await ctx.dispose();
}
