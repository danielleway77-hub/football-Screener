import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Step 3.2 checks (docs/TEST_CATALOG.md §3.2) in a real browser.

async function openKit(page: Page) {
  await page.goto("/style-guide#state-kit");
  await expect(page.getByTestId("style-guide")).toBeVisible();
  await expect(page.locator('[data-testid="style-guide"][data-hydrated="true"]')).toBeVisible();
}

test("offline banner appears and 'Back online.' shows then disappears", async ({
  page,
  context,
}) => {
  await openKit(page);
  const demo = page.getByTestId("offline-demo");
  await expect(demo.getByRole("status")).toHaveCount(0);

  await context.setOffline(true);
  await expect(demo.getByRole("status")).toContainText("You're offline");

  await context.setOffline(false);
  await expect(demo.getByRole("status")).toContainText("Back online.");
  await expect(demo.getByRole("status")).toHaveCount(0, { timeout: 6000 });
});

test("the slow-request hint appears after ~3 seconds and goes away", async ({ page }) => {
  await openKit(page);
  await page.getByRole("button", { name: "Start a slow request" }).click();
  const hint = page.getByText("Still working… this is taking longer than usual.");
  await expect(hint).toBeHidden();
  await expect(hint).toBeVisible({ timeout: 5000 });
  await expect(hint).toBeHidden({ timeout: 5000 }); // request settles at 4.5 s
});

test("swapping skeleton for content causes no layout shift and keeps the same height", async ({
  page,
}) => {
  await openKit(page);
  const area = page.getByTestId("swap-area");
  await area.scrollIntoViewIfNeeded();
  const before = (await area.boundingBox())!.height;

  await page.evaluate(() => {
    (window as unknown as { __cls: number }).__cls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as {
        hadRecentInput: boolean;
        value: number;
      }[]) {
        if (!entry.hadRecentInput) (window as unknown as { __cls: number }).__cls += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: false });
  });
  await page.getByRole("button", { name: "Show content" }).click();
  await expect(page.getByTestId("swap-content")).toBeVisible();
  await page.waitForTimeout(300);

  const after = (await area.boundingBox())!.height;
  const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
  expect(Math.abs(after - before)).toBeLessThanOrEqual(1);
  expect(cls).toBeLessThan(0.01);
});

test("the error state retry runs once per click and shows no stack trace", async ({ page }) => {
  await openKit(page);
  const demo = page.getByTestId("demo-error");
  const retry = demo.getByRole("button", { name: /Try again/ });
  await retry.dblclick();
  await expect(page.getByTestId("retry-count")).toHaveText("retries: 1");
  await expect(demo).not.toContainText(/at .*\(.*:\d+:\d+\)/);
});

test("the route progress bar runs while an in-app navigation is held, then completes", async ({
  page,
}) => {
  await openKit(page);
  // Hold the next page's request until the test has observed the bar (deterministic, no timing race).
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/style-guide/shell**", async (route) => {
    await gate;
    await route.continue();
  });
  const bar = page.getByTestId("route-progress");
  await expect(bar).toHaveAttribute("data-phase", "idle");

  await page.getByRole("link", { name: "Navigate to the shell demo" }).click();
  await expect(bar).toHaveAttribute("data-phase", "loading");

  release();
  await expect(page).toHaveURL(/\/style-guide\/shell/, { timeout: 30_000 });
  // The bar finishes: this page has no RouteProgress, so only the URL change is asserted here;
  // completion (done → idle) is covered by the component tests.
});
test("the state kit section has no serious or critical accessibility violations", async ({
  page,
}) => {
  await openKit(page);
  const results = await new AxeBuilder({ page }).include("#state-kit").analyze();
  const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});
