import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PW_PORT ?? 3000);
const baseURL = `http://localhost:${PORT}`;
// PW_PROD=1 tests the production build (used for audits); otherwise the dev server.
const useProd = process.env.PW_PROD === "1";

const base = devices["Desktop Chrome"];

export default defineConfig({
  testDir: "./tests",
  testMatch: ["e2e/**/*.spec.ts", "ui/**/*.spec.ts"],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
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
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
