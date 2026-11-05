import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Step 3.1 measurable checks (docs/TEST_CATALOG.md §3.1) against the real AppShell demo.

async function openShell(page: Page) {
  await page.goto("/style-guide/shell");
  await expect(page.getByTestId("navbar")).toBeVisible();
  await expect(page.getByTestId("navbar")).toHaveAttribute("data-hydrated", "true"); // handlers attached
}

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 0) < 768;

test("navbar is 64px tall", async ({ page }) => {
  await openShell(page);
  const box = await page.getByTestId("navbar").boundingBox();
  expect(Math.abs(box!.height - 64)).toBeLessThanOrEqual(1);
});

test("desktop: nav links are 40px tall and the hamburger is hidden", async ({ page }) => {
  test.skip(isMobile(page), "desktop only");
  await openShell(page);
  const link = page.getByRole("link", { name: "Runs" });
  expect(Math.round((await link.boundingBox())!.height)).toBe(40);
  await expect(page.getByRole("button", { name: "Open menu" })).toBeHidden();
  // 4 links + logout icon button, in the agreed order
  const labels = await page
    .getByRole("navigation", { name: "Main" })
    .first()
    .locator("a")
    .allInnerTexts();
  expect(labels.map((l) => l.trim())).toEqual(["Dashboard", "Runs", "Import", "Settings"]);
});

test("mobile: hamburger ≥ 44×44, sheet rows are 56px, close returns focus", async ({ page }) => {
  test.skip(!isMobile(page), "mobile only");
  await openShell(page);
  const trigger = page.getByRole("button", { name: "Open menu" });
  const tb = (await trigger.boundingBox())!;
  expect(tb.width).toBeGreaterThanOrEqual(44);
  expect(tb.height).toBeGreaterThanOrEqual(44);
  await expect(page.getByRole("link", { name: "Runs" })).toBeHidden();

  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  for (const name of ["Dashboard", "Runs", "Import", "Settings"]) {
    const row = dialog.getByRole("link", { name });
    expect(Math.round((await row.boundingBox())!.height)).toBe(56);
  }
  // body scroll is locked while the sheet is open
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe("hidden");

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("the first Tab stop is the skip link and it targets main", async ({ page }) => {
  await openShell(page);
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await expect(skip).toHaveAttribute("href", "#main");
  await expect(page.locator("main#main")).toHaveCount(1);
});

test("the footer sits at the bottom of the viewport on a short page", async ({ page }) => {
  await openShell(page);
  const { footerBottom, innerHeight } = await page.evaluate(() => ({
    footerBottom: document.querySelector("footer")!.getBoundingClientRect().bottom,
    innerHeight: window.innerHeight,
  }));
  expect(footerBottom).toBeGreaterThanOrEqual(innerHeight - 1);
});

test("there is exactly one navbar, one footer and one main landmark", async ({ page }) => {
  await openShell(page);
  await expect(page.locator("header[data-testid=navbar]")).toHaveCount(1);
  await expect(page.locator("footer")).toHaveCount(1);
  await expect(page.locator("main")).toHaveCount(1);
});

test("no horizontal overflow at 360px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await openShell(page);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("shell has no serious or critical accessibility violations", async ({ page }) => {
  await openShell(page);
  const results = await new AxeBuilder({ page }).analyze();
  const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});
