import { mkdirSync } from "node:fs";
import { test, type Page } from "@playwright/test";
import {
  baselineMatches,
  resetData,
  seedMatches,
  seedRun,
  setSettings,
} from "./helpers/dashboard-db";

// Step 14.1 visual evidence: key resilience states at 360/768/1280/1920 -> docs/reference/ui-review/14.1/.
// Run only on demand: PW_SHOTS=1 PW_PORT=3014 npx playwright test tests/e2e/resilience-shots.spec.ts --project=desktop --workers=1
test.skip(!process.env.PW_SHOTS, "screenshot capture is on demand");
test.setTimeout(180_000);
const OUT = "docs/reference/ui-review/14.1";
const WIDTHS = [360, 768, 1280, 1920];

async function shoot(page: Page, name: string) {
  mkdirSync(OUT, { recursive: true });
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: w < 768 ? 800 : 900 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/${name}-${w}.png` });
  }
}

test("capture states", async ({ page, context }) => {
  await resetData();
  await setSettings({ accessMode: "official_api", staleAfterHrs: 24, windowDays: 2 });
  await seedRun({ status: "PARTIAL", scanned: 42, failedCount: 4, finishedHoursAgo: 30 });
  await seedMatches(baselineMatches());

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await shoot(page, "stale-partial");

  await context.setOffline(true);
  await page.waitForSelector("text=You're offline");
  await shoot(page, "offline-dashboard");
  await context.setOffline(false);
  await page.waitForSelector("text=Back online.");
  await shoot(page, "back-online");

  await page.route("**/api/run", async (route) => {
    await new Promise((r) => setTimeout(r, 30_000));
    await route.abort().catch(() => undefined);
  });
  await page.getByTestId("run-status-panel").getByRole("button", { name: "Run now" }).click();
  await page.waitForSelector("text=Still working…", { timeout: 8000 });
  await shoot(page, "slow-run");
  await page.unroute("**/api/run");

  await page.goto("/runs?__error=1");
  await page.waitForSelector("[data-testid=error-state]");
  await shoot(page, "error-state");

  await page.goto("/matches/missing-id");
  await page.waitForSelector("[data-testid=not-found]");
  await shoot(page, "not-found");
});

test.describe("login 429", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test("capture", async ({ page }) => {
    await page.route("**/api/auth/login", (r) =>
      r.fulfill({ status: 429, headers: { "retry-after": "540" }, body: "" }),
    );
    await page.goto("/login");
    await page.waitForSelector("[data-hydrated=true]");
    await page.locator("#password").fill("whatever-123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForSelector("text=Try again in 9 minutes");
    await shoot(page, "login-429");
  });
});
