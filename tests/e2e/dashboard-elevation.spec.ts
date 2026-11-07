import { expect, test } from "@playwright/test";
import { seedBaseline } from "./helpers/dashboard-db";

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
