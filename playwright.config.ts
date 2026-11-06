import { defineConfig, devices } from "@playwright/test";

import { existsSync } from "node:fs";
if (existsSync(".env.test.local")) process.loadEnvFile(".env.test.local");

const PORT = Number(process.env.PW_PORT ?? 3000);
const baseURL = `http://localhost:${PORT}`;
// PW_PROD=1 tests the production build (used for audits); otherwise the dev server.
const useProd = process.env.PW_PROD === "1";

const base = devices["Desktop Chrome"];

export default defineConfig({
  testDir: "./tests",
  testMatch: ["e2e/**/*.spec.ts", "ui/**/*.spec.ts"],
  fullyParallel: true,
  globalSetup: "./tests/e2e/global-setup.ts",
  // The dev server compiles routes on demand; under 4 parallel workers hydration can exceed 5 s.
  expect: { timeout: 15_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    storageState: "tests/e2e/.auth/owner.json",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "mobile",
      use: { ...base, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
    { name: "tablet", use: { ...base, viewport: { width: 768, height: 1024 }, hasTouch: true } },
    { name: "desktop", use: { ...base, viewport: { width: 1280, height: 800 } } },
    { name: "wide", use: { ...base, viewport: { width: 1920, height: 1080 } } },
  ],
  webServer: {
    command: useProd ? `pnpm build && pnpm start --port ${PORT}` : `pnpm dev --port ${PORT}`,
    // Dev server: poll a heavy route so it is compiled BEFORE the 4 parallel workers start
    // (cold-compile timeouts caused flaky first runs). Production: the home page.
    url: useProd ? baseURL : `${baseURL}/style-guide`,
    // PW_ISOLATED_DB=1: the dev server reads the isolated test schema so e2e can seed runs deterministically.
    env:
      process.env.PW_ISOLATED_DB === "1" && process.env.DIRECT_URL_TEST
        ? { DATABASE_URL: process.env.DIRECT_URL_TEST }
        : {},
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
