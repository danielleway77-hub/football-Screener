import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { seedBaseline, seedMatches } from "../e2e/helpers/dashboard-db";

// Step 15.6 (UI_BLUEPRINT §35 and §31 zoom): ultra-wide layout and 200% zoom / text scale.
test.setTimeout(120_000);
test.skip(({ isMobile }) => isMobile, "uses its own viewports");

test.beforeAll(async () => {
  mkdirSync("docs/reference/ui-review/15.6", { recursive: true });
  await seedBaseline();
  await seedMatches(
    Array.from({ length: 5 }, (_, i) => ({
      id: `w${i}`,
      home: `Wide Home ${i}`,
      away: `Wide Away ${i}`,
      homePct: 82,
      awayPct: 8,
      inHours: 26 + i,
    })),
  );
});

const vignette = (page: import("@playwright/test").Page) =>
  page.evaluate(() => getComputedStyle(document.documentElement, "::after").backgroundImage);

for (const size of [
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
]) {
  test(`${size.width}x${size.height}: 4 cards per row, content never wider than 1680, vignette on`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.getByTestId("match-card").first()).toBeVisible();
    const perRow = await page.getByTestId("match-card").evaluateAll((els) => {
      const rows = new Map<number, number>();
      for (const e of els) {
        const t = Math.round(e.getBoundingClientRect().top + window.scrollY);
        rows.set(t, (rows.get(t) ?? 0) + 1);
      }
      return Math.max(...rows.values());
    });
    expect(perRow).toBe(4);
    const widest = await page.evaluate(() => {
      let max = 0;
      for (const el of Array.from(document.querySelectorAll("main .container-wide *"))) {
        // the sheen beam is a clipped, rotating decoration inside an overflow:hidden ring
        if (getComputedStyle(el).position === "fixed" || el.closest(".card-sheen")) continue;
        max = Math.max(max, el.getBoundingClientRect().width);
      }
      return max;
    });
    expect(widest).toBeLessThanOrEqual(1680);
    expect(await vignette(page)).toContain("radial-gradient");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `docs/reference/ui-review/15.6/dashboard-${size.width}.png` });
  });
}

test("no vignette below 1920", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  expect(await vignette(page)).toBe("none");
});

test("container stays centred at 2560 and never exceeds 1680", async ({ page }) => {
  await page.setViewportSize({ width: 2560, height: 1440 });
  await page.goto("/");
  const box = await page.locator("main .container-wide").first().boundingBox();
  expect(box!.width).toBeLessThanOrEqual(1680);
  const client = await page.evaluate(
    () => document.querySelector("main")!.getBoundingClientRect().width,
  ); // main spans the viewport minus the stable scrollbar gutter
  expect(Math.abs(box!.x - (client - box!.width) / 2)).toBeLessThan(2);
});

const measure = (page: import("@playwright/test").Page) =>
  page.evaluate(() => ({
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    clipped: Array.from(document.querySelectorAll("[data-testid='match-card']")).filter(
      (c) => c.scrollHeight > c.clientHeight + 1,
    ).length,
  }));

for (const route of ["/", "/matches/golden", "/runs", "/settings", "/import"]) {
  test(`200% zoom (a 640 CSS px viewport, same media queries as a real browser zoom) on ${route}: no horizontal scroll, no clipped card text`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 640, height: 450 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(route);
    await expect(page.locator("main").first()).toBeVisible();
    await page.waitForTimeout(300);
    const r = await measure(page);
    expect(r.overflowX).toBeLessThanOrEqual(1);
    expect(r.clipped).toBe(0);
  });

  test(`200% text size on ${route}: no horizontal scroll, no clipped card text`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 640, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(route);
    await expect(page.locator("main").first()).toBeVisible();
    await page.addStyleTag({ content: "html{font-size:200% !important}" });
    await page.waitForTimeout(300);
    const r = await measure(page);
    expect(r.overflowX).toBeLessThanOrEqual(1);
    expect(r.clipped).toBe(0);
  });
}
