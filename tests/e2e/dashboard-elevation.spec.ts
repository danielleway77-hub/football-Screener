import { expect, test } from "@playwright/test";
import {
  baselineMatches,
  resetData,
  seedBaseline,
  seedMatches,
  seedRun,
  setSettings,
} from "./helpers/dashboard-db";

test.setTimeout(90_000);

test.describe("dashboard elevation", () => {
  test.beforeEach(async () => {
    await seedBaseline();
  });

  test("cards without probabilities say so once, with no layout change", async ({ page }) => {
    await page.goto("/");
    const missing = page.locator('[data-testid="probability-grid"][data-all-missing]');
    await expect(missing.first()).toBeVisible();
    await expect(missing.first().getByTestId("prob-unavailable")).toHaveText(
      "Probabilities unavailable",
    );
    // the tiles are still there for assistive tech
    await expect(missing.first().getByTestId("prob-tile").first()).toHaveAttribute(
      "data-missing",
      "true",
    );
  });

  test("freshness dot breathes only when motion is allowed", async ({ page, isMobile }) => {
    test.skip(isMobile, "the pill lives in the desktop navbar");
    await page.goto("/");
    const ring = page.getByTestId("freshness-pill").locator(".live-ring");
    await expect(ring).toHaveCount(1);
    await expect(ring).toHaveCSS("animation-name", "live-ring");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(ring).toHaveCSS("animation-name", "none");
  });
});

test.describe("dashboard elevation: states and motion", () => {
  test("stale data gets a warning rail and a plain-language hint", async ({ page }) => {
    await resetData();
    await setSettings({ staleAfterHrs: 1 });
    await seedMatches(baselineMatches());
    await seedRun({ finishedHoursAgo: 3, scanned: 40, qualified: 3 });
    await page.goto("/");
    await expect(page.getByTestId("run-status-panel")).toHaveAttribute("data-state", "stale");
    await expect(page.getByTestId("panel-rail")).toHaveCount(1);
    await expect(page.getByTestId("stale-hint")).toContainText("may be out of date");
  });

  test("empty views carry context chips on one surface", async ({ page }) => {
    await seedBaseline();
    await page.goto("/?q=zzzz");
    const empty = page.getByTestId("dashboard-empty");
    await expect(empty).toBeVisible();
    await expect(empty).toContainText("Nothing matches these filters");
    await expect(empty).toContainText("zzzz");
    await expect(empty).toContainText("Qualifying in window");
  });

  test("SSR first paint is final; a filter change re-enters the cards with the stagger", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "tabs are exercised on desktop; the stagger logic is viewport independent");
    await seedBaseline();
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/");
    await expect(page.getByTestId("match-card").first()).toBeVisible();
    // first paint: visible straight away (never hidden waiting for JS)
    await expect(page.getByTestId("match-card").first()).toHaveCSS("opacity", "1");
    await page.getByRole("tab", { name: /Tomorrow/ }).click();
    await expect(page).toHaveURL(/day=tomorrow/);
    await expect(page.getByTestId("match-card")).toHaveCount(1);
    await expect(page.getByTestId("match-card").first()).toBeVisible();
    await expect(page.locator('[data-motion="animated"]').first()).toBeAttached();
  });
});
