import { expect, test, type Page } from "@playwright/test";

// Step 3.4 checks (docs/TEST_CATALOG.md §3.4) in a real browser.

async function openGuide(page: Page) {
  await page.goto("/style-guide#interactions");
  await expect(page.locator('[data-testid="style-guide"][data-hydrated="true"]')).toBeVisible();
}

async function openSticky(page: Page) {
  await page.goto("/style-guide/sticky");
  await expect(page.getByTestId("navbar")).toHaveAttribute("data-hydrated", "true");
}

test.describe("StickyBar", () => {
  test("docks under the navbar, becomes glass, and the layout does not shift", async ({ page }) => {
    await openSticky(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0); // a wider-than-screen page makes phones zoom out
    const bar = page.getByTestId("sticky-bar");
    await expect(bar).toHaveAttribute("data-stuck", "false");
    const flowHeight = (await bar.boundingBox())!.height;
    const noFilter = await bar.evaluate((el) => getComputedStyle(el).backdropFilter);
    expect(noFilter).toBe("none");

    await page.evaluate(() => {
      (window as unknown as { __cls: number }).__cls = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as unknown as {
          hadRecentInput: boolean;
          value: number;
        }[]) {
          if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
        }
      }).observe({ type: "layout-shift", buffered: false });
    });

    await page.mouse.wheel(0, 900);
    await expect(bar).toHaveAttribute("data-stuck", "true");
    await page.waitForTimeout(300);

    const box = (await bar.boundingBox())!;
    expect(Math.abs(box.y - 64)).toBeLessThanOrEqual(1); // docked right under the 64px navbar
    expect(Math.abs(box.height - flowHeight)).toBeLessThanOrEqual(1); // same height: no shift
    expect(await bar.evaluate((el) => getComputedStyle(el).backdropFilter)).toContain("blur");
    expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeLessThan(
      0.01,
    );

    await page.mouse.wheel(0, -2000);
    await expect(bar).toHaveAttribute("data-stuck", "false");
  });

  test("stays below the navbar in stacking order", async ({ page }) => {
    await openSticky(page);
    const z = await page.evaluate(() => ({
      bar: Number(getComputedStyle(document.querySelector('[data-testid="sticky-bar"]')!).zIndex),
      nav: Number(getComputedStyle(document.querySelector('[data-testid="navbar"]')!).zIndex),
    }));
    expect(z.bar).toBe(39);
    expect(z.nav).toBe(40);
  });
});

test.describe("SpotlightCard", () => {
  test("glows under the pointer on hover-capable devices only", async ({ page }) => {
    await openGuide(page);
    const card = page.getByTestId("spotlight-demo");
    await card.scrollIntoViewIfNeeded();
    const overlay = page.getByTestId("spotlight-overlay");

    const canHover = await page.evaluate(
      () => matchMedia("(hover: hover) and (pointer: fine)").matches,
    );
    if (!canHover) {
      await expect(overlay).toHaveCount(0); // touch device: no overlay, no listeners
      return;
    }
    await card.hover({ position: { x: 60, y: 30 } });
    await expect(overlay).toBeVisible();
    await expect
      .poll(async () => Number(await overlay.evaluate((el) => getComputedStyle(el).opacity)))
      .toBe(1);
    const mx = await card.evaluate(
      (el) => el.closest("[data-spotlight]")!.getAttribute("style") ?? "",
    );
    expect(mx).toContain("--mx");
    // moving away fades it out
    await page.mouse.move(2, 2);
    await expect
      .poll(async () => Number(await overlay.evaluate((el) => getComputedStyle(el).opacity)))
      .toBe(0);
  });

  test("is inert with reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openGuide(page);
    await expect(page.getByTestId("spotlight-overlay")).toHaveCount(0);
  });
});

test.describe("SegmentedControl", () => {
  test("arrow keys select and the selection pill follows", async ({ page }) => {
    await openGuide(page);
    const group = page.getByRole("radiogroup", { name: "Screening window" });
    await group.scrollIntoViewIfNeeded();
    const first = group.getByRole("radio", { name: "Tomorrow only" });
    const second = group.getByRole("radio", { name: "Tomorrow + day after" });
    await expect(second).toBeChecked();
    await second.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(first).toBeChecked();
    await expect(first).toBeFocused();
    await page.keyboard.press("End");
    await expect(second).toBeChecked();
    // the pill (primary-soft) sits inside the selected option
    const bg = await second
      .locator("span")
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).toMatch(/rgba?\(200, 245, 46/);
  });

  test("controls are at least 44px tall", async ({ page }) => {
    await openGuide(page);
    const group = page.getByRole("radiogroup", { name: "Screening window" });
    expect((await group.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  });
});

test("ScrollFade shows edge fades only on overflowing sides", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await openGuide(page);
  const region = page.getByRole("region", { name: "Example days" });
  await region.scrollIntoViewIfNeeded();
  await expect(region).toHaveAttribute("data-fade-left", "false");
  await expect(region).toHaveAttribute("data-fade-right", "true");
  await region.evaluate((el) => el.scrollTo({ left: el.scrollWidth }));
  await expect(region).toHaveAttribute("data-fade-left", "true");
  await expect(region).toHaveAttribute("data-fade-right", "false");
});

test("primary button sheen is CSS-only (no JS) and absent on touch", async ({ page }) => {
  await page.goto("/style-guide#buttons");
  const sheen = await page
    .locator('[data-slot="button"][data-variant="default"]')
    .first()
    .evaluate((el) => getComputedStyle(el, "::after").content);
  const canHover = await page.evaluate(
    () => matchMedia("(hover: hover) and (pointer: fine)").matches,
  );
  if (canHover) expect(sheen).toBe('""');
  else expect(sheen === "none" || sheen === "normal").toBe(true);
});
