import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Step 10.1 measurable checks on the dev-only /style-guide/match page. Widths are set explicitly so one
// project covers 360 / 768 / 1280 / 1920.
const WIDTHS = [360, 768, 1280, 1920] as const;
const expectedMin = (w: number) => (w < 768 ? 424 : 440);

test.describe("match components (style guide)", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "viewport is set per test");
  });

  for (const width of WIDTHS) {
    test(`card geometry at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/style-guide/match");
      await expect(page.getByTestId("match-style-guide")).toBeVisible();

      const card = page.getByTestId("card-specimen").first().getByTestId("match-card");
      const box = (await card.boundingBox())!;
      expect(Math.abs(box.height - expectedMin(width))).toBeLessThanOrEqual(8);

      const skeleton = page.getByTestId("skeleton-specimen").getByTestId("skeleton");
      const skeletonBox = (await skeleton.boundingBox())!;
      expect(Math.round(skeletonBox.height)).toBe(Math.round(box.height));

      expect(Math.round((await card.getByTestId("form-track").first().boundingBox())!.height)).toBe(
        8,
      );
      expect(Math.round((await card.getByTestId("qualifies-chip").boundingBox())!.height)).toBe(28);
      for (const tile of await card.getByTestId("prob-tile").all()) {
        expect(Math.round((await tile.boundingBox())!.height)).toBe(64);
      }
      for (const tile of await card.getByTestId("pair-tile").all()) {
        expect(Math.round((await tile.boundingBox())!.height)).toBe(64);
      }
    });

    test(`every card state keeps its height and never overflows at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/style-guide/match");
      const result = await page.evaluate(() =>
        Array.from(document.querySelectorAll('[data-testid="match-card"]')).map((el) => ({
          h: Math.round(el.getBoundingClientRect().height),
          overflow: el.scrollWidth > el.clientWidth,
          links: el.querySelectorAll("a").length,
        })),
      );
      expect(result.length).toBeGreaterThanOrEqual(10);
      for (const card of result) {
        expect(card.overflow).toBe(false);
        expect(card.links).toBe(1);
        expect(card.h).toBe(Math.round(result[0]!.h));
      }
      const doc = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(doc).toBeLessThanOrEqual(0);
    });
  }

  test("tick marks sit at 35% and 75% of the track", async ({ page }) => {
    await page.goto("/style-guide/match");
    const specimen = page.getByTestId("bar-specimen").first();
    const track = (await specimen.getByTestId("form-track").boundingBox())!;
    const ticks = await specimen.getByTestId("form-tick").all();
    const centres = [] as number[];
    for (const t of ticks) {
      const b = (await t.boundingBox())!;
      centres.push((b.x + b.width / 2 - track.x) / track.width);
    }
    expect(centres[0]).toBeCloseTo(0.35, 1);
    expect(centres[1]).toBeCloseTo(0.75, 1);
  });

  test("axe finds no violations on the match component states", async ({ page }) => {
    await page.goto("/style-guide/match");
    await expect(page.getByTestId("match-style-guide")).toBeVisible();
    const results = await new AxeBuilder({ page })
      .include('[data-testid="match-style-guide"]')
      .analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.html.slice(0, 120)}`)).toEqual([]);
  });

  test("reduced motion shows final bar widths and values immediately", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/style-guide/match");
    const specimen = page.getByTestId("bar-specimen").first();
    await expect(specimen.getByTestId("countup-visible")).toHaveText("80%", { timeout: 1000 });
    const ratio = await specimen.getByTestId("form-track").evaluate((t) => {
      const fill = t.firstElementChild as HTMLElement;
      return fill.getBoundingClientRect().width / t.getBoundingClientRect().width;
    });
    expect(ratio).toBeCloseTo(0.8, 1);
  });
});
