import { expect, test } from "@playwright/test";

// Floating layers must be themed (never the default white/grey shadcn popups). Colours are tokens:
// popover = --surface-raised rgb(21,29,26); dialog/sheet = --surface-overlay rgb(27,37,33).
const RAISED = "rgb(21, 29, 26)";
const OVERLAY = "rgb(27, 37, 33)";

const bg = (el: Element) => getComputedStyle(el).backgroundColor;

test.beforeEach(async ({ page }) => {
  await page.goto("/style-guide#feedback");
  await expect(page.getByTestId("style-guide")).toBeVisible();
  // Interactions before React hydrates are silently lost; wait until the page is idle.
  await page.waitForLoadState("networkidle");
});

test("select popup is dark (surface-raised) with a visible option list", async ({ page }) => {
  await page.getByRole("combobox").first().click();
  const list = page.getByRole("listbox");
  await expect(list).toBeVisible();
  expect(await list.evaluate(bg)).toBe(RAISED);
});

test("dropdown menu popup is dark (surface-raised)", async ({ page }) => {
  await page.getByRole("button", { name: "Open menu" }).click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  expect(await menu.evaluate(bg)).toBe(RAISED);
});

test("tooltip is themed (not white)", async ({ page }) => {
  const trigger = page.getByRole("button", { name: "Hover me" });
  const tip = page.getByRole("tooltip");
  // Radix shows tooltips after a short delay; retry the hover until the handler is live.
  await expect(async () => {
    await trigger.hover();
    await expect(tip).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 10_000 });
  const colour = await tip.evaluate(bg);
  expect(colour).not.toBe("rgb(255, 255, 255)");
  expect(colour).not.toBe("rgb(0, 0, 0)");
});

test("sheet and dialog use surface-overlay", async ({ page }) => {
  await page.getByRole("button", { name: "Open sheet" }).click();
  expect(await page.getByRole("dialog").evaluate(bg)).toBe(OVERLAY);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Open dialog" }).click();
  expect(await page.getByRole("dialog").evaluate(bg)).toBe(OVERLAY);
});

test("toast is themed and appears", async ({ page }) => {
  await page.getByRole("button", { name: "Success toast" }).click();
  const toast = page.locator("[data-sonner-toast]").first();
  await expect(toast).toBeVisible();
  expect(await toast.evaluate(bg)).toBe(OVERLAY);
});

test("favicon is the Screener glyph, not the Next.js default", async ({ request }) => {
  const res = await request.get("/icon.svg");
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain("#C8F52E");
  expect((await request.get("/favicon.ico")).status()).not.toBe(200);
});
