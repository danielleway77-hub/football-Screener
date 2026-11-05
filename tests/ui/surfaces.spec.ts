import { expect, test } from "@playwright/test";

// Step 2.3 depth-system checks (docs/TEST_CATALOG.md §2.3, UI_BLUEPRINT §21 and §28).

test.beforeEach(async ({ page }) => {
  await page.goto("/style-guide#elevation");
  await expect(page.getByTestId("style-guide")).toBeVisible();
});

test("card border is 1px with white alpha <= .14", async ({ page }) => {
  const card = page.locator('[data-slot="card"]:not([data-force])').first();
  const border = await card.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { width: cs.borderTopWidth, color: cs.borderTopColor };
  });
  expect(border.width).toBe("1px");
  const alpha = Number(
    border.color.match(/rgba?\([^)]*?,\s*[^)]*?,\s*[^)]*?(?:,\s*([\d.]+))?\)/)?.[1] ?? 1,
  );
  expect(alpha).toBeLessThanOrEqual(0.14);
});

test("card has no outer shadow at rest", async ({ page }) => {
  const shadow = await page
    .locator('[data-slot="card"]:not([data-force])')
    .first()
    .evaluate((el) => getComputedStyle(el).boxShadow);
  const outer = shadow
    .split(/,(?![^(]*\))/)
    .filter((s) => s.trim() && s.trim() !== "none")
    .filter((s) => !/inset/.test(s) && !/rgba?\(0, 0, 0, 0\)/.test(s));
  expect(outer).toEqual([]);
});

test("dialog is on surface-3 and has a shadow", async ({ page }) => {
  await page.getByRole("button", { name: "Open dialog" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const shadow = await dialog.evaluate((el) => getComputedStyle(el).boxShadow);
  expect(shadow).not.toBe("none");
  expect(shadow).toMatch(/rgba\(0, 0, 0, 0\.7\)/);
});

test(".glass has backdrop-filter", async ({ page }) => {
  const filter = await page
    .locator(".glass")
    .first()
    .evaluate((el) => getComputedStyle(el).backdropFilter);
  expect(filter).toContain("blur");
});

test(".num uses tabular numerals", async ({ page }) => {
  const variant = await page
    .locator(".num")
    .first()
    .evaluate((el) => getComputedStyle(el).fontVariantNumeric);
  expect(variant).toContain("tabular-nums");
});

test("every border-radius is on the ladder and no pure black/white backgrounds", async ({
  page,
}) => {
  await expect(page.getByTestId("rule-checker-count")).toHaveText("0 violations", {
    timeout: 10_000,
  });
});
