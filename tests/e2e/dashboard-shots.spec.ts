import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { resetData, seedBaseline, seedRun, setSettings } from "./helpers/dashboard-db";

// Dashboard UI-elevation screenshots. Skipped unless SHOTS_DIR is set:
//   SHOTS_DIR=docs/reference/ui-dashboard/after PW_PORT=3022 npx playwright test tests/e2e/dashboard-shots.spec.ts --project=desktop --workers=1
const dir = process.env.SHOTS_DIR;
test.skip(!dir, "set SHOTS_DIR to capture review screenshots");
test.setTimeout(300_000);

const SIZES = [360, 768, 1280, 1920];
const HEIGHT: Record<number, number> = { 360: 800, 768: 1024, 1280: 800, 1920: 1080 };

async function shoot(page: Page, name: string, url: string, sizes = SIZES) {
  for (const w of sizes) {
    await page.setViewportSize({ width: w, height: HEIGHT[w] ?? 800 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(url);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${dir}/${name}-${w}.png`, fullPage: w <= 768 });
  }
}

test("capture dashboard states", async ({ page }) => {
  mkdirSync(dir!, { recursive: true });
  await seedBaseline();
  await shoot(page, "baseline", "/");
  await shoot(page, "filtered-out", "/?q=zzzz", [360, 1280]);
  await shoot(page, "error", "/?__error=results", [360, 1280]);
  await seedBaseline();
  await resetData();
  await setSettings({ accessMode: "manual_import" });
  await shoot(page, "empty-never", "/", [360, 1280]);
  await seedRun({ finishedHoursAgo: 2, scanned: 40, qualified: 0 });
  await shoot(page, "none-qualify", "/", [360, 1280]);
  await seedBaseline();
  await seedRun({ status: "FAILED", finishedHoursAgo: 0.2, error: "Provider timed out" });
  await shoot(page, "failed", "/", [360, 1280]);
  await seedBaseline();
  await setSettings({ staleAfterHrs: 1 });
  await resetData();
  await seedBaseline();
  await setSettings({ staleAfterHrs: 1 });
  await shoot(page, "stale", "/", [360, 1280]);
});
