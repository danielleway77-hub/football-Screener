import { defineConfig, devices } from "@playwright/test";

import { existsSync } from "node:fs";

// Isolated e2e database: when .env.test.local points at a private schema (test_<name>), the dev server
// reads THAT schema (direct connection) so specs can seed deterministic matches without touching shared data.
if (existsSync(".env.test.local")) process.loadEnvFile(".env.test.local");
const testUrl = process.env.DIRECT_URL_TEST ?? "";
const isolated = /[?&]schema=test_[a-z0-9]+(&|$)/.test(testUrl);

const PORT = Number(process.env.PW_PORT ?? 3000);
const baseURL = `http://localhost:${PORT}`;
// PW_PROD=1 tests the production build (used for audits); otherwise the dev server.
const useProd = process.env.PW_PROD === "1";

const base = devices["Desktop Chrome"];

export default defineConfig({
  testDir: "./tests",
  testMatch: ["e2e/**/*.spec.ts", "ui/**/*.spec.ts"],
  fullyParallel: true,
  globalSetup: ["./tests/e2e/global-setup.ts", "./tests/e2e/seed-detail.ts"],
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
    command: useProd
      ? `pnpm build && pnpm start --port ${PORT}`
      : `${isolated ? "pnpm exec tsx tests/e2e/prepare-db.ts && " : ""}pnpm dev --port ${PORT}`,
    ...(isolated ? { env: { DATABASE_URL: testUrl } } : {}),
    // Dev server: poll a heavy route so it is compiled BEFORE the 4 parallel workers start
    // (cold-compile timeouts caused flaky first runs). Production: the home page.
    url: useProd ? baseURL : `${baseURL}/style-guide`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
