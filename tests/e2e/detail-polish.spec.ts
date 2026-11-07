import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { DETAIL_IDS_FILE } from "./seed-detail";

test.skip(!existsSync(DETAIL_IDS_FILE), "isolated e2e database not available");
const ids = () => JSON.parse(readFileSync(DETAIL_IDS_FILE, "utf8")) as Record<string, string>;

test.describe("match detail polish", () => {
  test("missing probabilities explain themselves once", async ({ page }) => {
    await page.goto(`/matches/${ids()["away-strong"]}`);
    await expect(page.getByTestId("no-probabilities")).toBeVisible();
    await expect(page.getByTestId("predicted-score-tile")).toHaveCount(0);
  });

  test("full data shows no missing note", async ({ page }) => {
    await page.goto(`/matches/${ids().golden}`);
    await expect(page.getByTestId("probability-panel")).toBeVisible();
    await expect(page.getByTestId("no-probabilities")).toHaveCount(0);
  });

  test("sticky mini-header appears after the hero scrolls away", async ({ page }) => {
    await page.goto(`/matches/${ids().golden}`);
    const bar = page.getByTestId("match-sticky");
    await expect(bar).not.toHaveAttribute("data-visible", "true");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(bar).toHaveAttribute("data-visible", "true");
    await expect(bar).toContainText("Sporting Cristal vs FC Cajamarca");
  });
});
