import { expect, test, type Page } from "@playwright/test";
import { seedBaseline, seedMatches, type SeedMatch } from "./helpers/dashboard-db";

// Step 10.3: sticky filter bar and list polish. One shared isolated schema: run with --workers=1.
test.setTimeout(90_000);

const bar = (page: Page) => page.getByTestId("sticky-bar");

function manyMatches(n: number): SeedMatch[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `bulk${i}`,
    home: `Bulk Home ${i}`,
    away: `Bulk Away ${i}`,
    homePct: 80 + (i % 10),
    awayPct: 5 + (i % 20),
    inHours: 4 + i,
    league: i % 2 ? "Liga 1" : "Premier League",
    country: i % 2 ? "Peru" : "England",
  }));
}

test.beforeEach(async () => {
  await seedBaseline();
  await seedMatches(manyMatches(9));
});

async function open(page: Page, url = "/") {
  await page.goto(url);
  await expect(page.getByTestId("match-card").first()).toBeVisible();
  await expect(page.getByTestId("match-filters")).toBeVisible();
}

test("bar docks under the navbar and becomes glass, height unchanged", async ({ page }) => {
  await open(page);
  const before = (await bar(page).boundingBox())!;
  await expect(bar(page)).toHaveAttribute("data-stuck", "false");
  const idle = await bar(page).evaluate((el) => getComputedStyle(el).backdropFilter);
  expect(idle).toBe("none");

  await page.evaluate(() => window.scrollTo(0, 900));
  await expect(bar(page)).toHaveAttribute("data-stuck", "true");
  const stuck = (await bar(page).boundingBox())!;
  expect(Math.abs(stuck.y - 64)).toBeLessThanOrEqual(1);
  expect(Math.round(stuck.height)).toBe(Math.round(before.height));
  const style = await bar(page).evaluate((el) => {
    const s = getComputedStyle(el);
    return { filter: s.backdropFilter, border: s.borderBottomWidth, z: s.zIndex };
  });
  expect(style.filter).toContain("blur");
  expect(style.border).toBe("1px");
  expect(style.z).toBe("39");
});

test("sticking causes no layout shift (CLS < 0.01)", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __cls: number };
    w.__cls = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as {
        value: number;
        hadRecentInput: boolean;
      }[]) {
        if (!e.hadRecentInput) w.__cls += e.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  await open(page);
  await page.waitForTimeout(1200);
  const start = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
  for (const y of [200, 500, 900, 300, 0]) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(250);
  }
  const end = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
  expect(end - start).toBeLessThan(0.01);
});

test("the offline banner shifts the bar down by its own height", async ({ page, context }) => {
  await open(page);
  const top = (await bar(page).boundingBox())!.y;
  await context.setOffline(true);
  const banner = page.getByTestId("banner").filter({ hasText: "offline" });
  await expect(banner).toBeVisible();
  const bannerHeight = (await banner.boundingBox())!.height;
  const after = (await bar(page).boundingBox())!.y;
  expect(Math.abs(after - top - bannerHeight)).toBeLessThanOrEqual(2);
  expect(bannerHeight).toBeGreaterThanOrEqual(40);
  await context.setOffline(false);
});

test("the day indicator slides: one pill, on the selected tab", async ({ page }) => {
  await open(page);
  await expect(page.getByTestId("day-pill")).toHaveCount(1);
  await page.getByRole("tab", { name: /^Tomorrow/ }).click();
  await expect(page.getByRole("tab", { name: /^Tomorrow/ }).getByTestId("day-pill")).toHaveCount(1);
  await expect(page.getByTestId("day-pill")).toHaveCount(1);
});

test("changing a filter while stuck puts the results just under the bar; unstuck never scrolls", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("tab", { name: /^Today/ }).click();
  await expect(page).toHaveURL(/day=today/);
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => window.scrollY)).toBeLessThan(5);

  await page.getByRole("tab", { name: /^Upcoming/ }).click();
  await expect(page).not.toHaveURL(/day=/);
  await expect(page.getByTestId("match-card")).toHaveCount(12);
  await page.evaluate(() => window.scrollTo(0, 1500));
  await expect(bar(page)).toHaveAttribute("data-stuck", "true");
  await page.getByRole("tab", { name: /^Tomorrow/ }).click();
  await expect(page).toHaveURL(/day=tomorrow/);
  await expect(page.getByTestId("match-card").nth(11)).toHaveCount(0); // fewer cards than Upcoming
  await page.waitForTimeout(900);
  const barBox = (await bar(page).boundingBox())!;
  const cardTop = (await page.getByTestId("match-card").first().boundingBox())!.y;
  expect(cardTop).toBeGreaterThanOrEqual(barBox.y + barBox.height - 2);
  expect(cardTop).toBeLessThan(barBox.y + barBox.height + 80);
});

test("scroll position is restored after Back from a match", async ({ page }) => {
  await open(page);
  const card = page.getByTestId("match-card").nth(4);
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const before = await page.evaluate(() => window.scrollY);
  expect(before).toBeGreaterThan(300);
  await card.getByRole("link").click({ force: true });
  await expect(page).toHaveURL(/\/matches\//);
  await page.goBack();
  await expect(page.getByTestId("match-card").first()).toBeVisible();
  await page.waitForTimeout(800);
  const after = await page.evaluate(() => window.scrollY);
  expect(Math.abs(after - before)).toBeLessThanOrEqual(60);
});

test("reduced motion removes the bar transition", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  const prop = await bar(page).evaluate((el) => getComputedStyle(el).transitionProperty);
  expect(prop).toBe("none");
});

test.describe("phone", () => {
  test.beforeEach(({ page }) => {
    test.skip(page.viewportSize()!.width >= 768, "phone only");
  });

  test("bar shows tabs plus 44px icon buttons; search expands, syncs q and Esc closes", async ({
    page,
  }) => {
    await open(page);
    const searchButton = page.getByRole("button", { name: "Search leagues" });
    const sortButton = page.getByRole("button", { name: "Sort matches" });
    for (const b of [searchButton, sortButton]) {
      const box = (await b.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await expect(page.getByTestId("search-field")).toBeHidden();
    await expect(page.getByTestId("filters-dot")).toHaveCount(0);

    await searchButton.click();
    const input = page.getByLabel("Filter by league");
    await expect(input).toBeVisible();
    await expect(input).toBeFocused();
    await input.fill("peru");
    await expect(page).toHaveURL(/q=peru/);
    await expect(page.getByTestId("match-card").first()).toContainText("Peru");

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("search-field")).toBeHidden();
    await expect(searchButton).toBeFocused();
    await expect(page.getByTestId("filters-dot")).toHaveAccessibleName("Filters active");

    await page.reload();
    await expect(page.getByLabel("Filter by league")).toHaveValue("peru"); // persisted in the URL
  });

  test("the sort menu offers radio items and a non-default sort lights the dot", async ({
    page,
  }) => {
    await open(page);
    await page.getByRole("button", { name: "Sort matches" }).click();
    await page.getByRole("menuitemradio", { name: "Biggest form gap" }).click();
    await expect(page).toHaveURL(/sort=gap/);
    await expect(page.getByTestId("filters-dot")).toBeVisible();
  });

  test("the mobile bar is 48px of tabs and nothing else", async ({ page }) => {
    await open(page);
    await expect(page.getByTestId("results-caption").and(page.locator(":visible"))).toHaveCount(1);
    const row = (await page.getByTestId("match-filters").boundingBox())!;
    expect(row.height).toBeGreaterThanOrEqual(48);
    expect(row.height).toBeLessThan(60);
  });
});
