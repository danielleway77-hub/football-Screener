import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// The specimen page is dev-only (404 in production builds).
const CASES = [
  "80-7",
  "30-82",
  "50-50",
  "100-0",
  "0-100",
  "76-34",
  "75-35",
  "74.9-35.1",
  "long",
  "55-60",
];

const open = async (page: Page) => {
  await page.goto("/style-guide/form-duel");
  await expect(page.getByTestId("duel-case-80-7")).toBeVisible();
};

test.describe("FormDuel", () => {
  test("no horizontal scroll at 360", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await open(page);
    const d = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
    }));
    expect(d.sw).toBeLessThanOrEqual(d.cw);
  });

  test("markers sit at their percent of the track and the height is fixed at 96", async ({
    page,
  }) => {
    await open(page);
    await page.waitForTimeout(1200);
    const c = page.getByTestId("duel-case-80-7");
    const track = (await c.getByTestId("duel-track").boundingBox())!;
    const home = (await c.getByTestId("team-logo").first().boundingBox())!;
    const away = (await c.getByTestId("team-logo").last().boundingBox())!;
    const x = (b: { x: number; width: number }) => (b.x + b.width / 2 - track.x) / track.width;
    expect(x(home)).toBeCloseTo(0.8, 1);
    expect(x(away)).toBeCloseTo(0.07, 1);
    expect(track.height).toBe(12);
    expect((await c.getByTestId("form-duel").boundingBox())!.height).toBe(96);
    await expect(c.getByTestId("duel-pill")).toHaveText("gap 73 pts");
  });

  test("overlap: the lower marker is below the track and nothing overlaps", async ({ page }) => {
    await open(page);
    await page.waitForTimeout(1200);
    const c = page.getByTestId("duel-case-50-50");
    const track = (await c.getByTestId("duel-track").boundingBox())!;
    const logos = c.getByTestId("team-logo");
    const a = (await logos.first().boundingBox())!;
    const b = (await logos.last().boundingBox())!;
    expect(b.y).toBeGreaterThan(track.y + track.height);
    expect(a.y + a.height).toBeLessThanOrEqual(b.y + 1 + a.height); // distinct rows
    expect(Math.abs(a.y - b.y)).toBeGreaterThan(28);
  });

  test("every case stays inside its card and keeps the 96px height", async ({ page }) => {
    await open(page);
    await page.waitForTimeout(1200);
    for (const id of CASES) {
      const c = page.getByTestId(`duel-case-${id}`);
      const duel = (await c.getByTestId("form-duel").boundingBox())!;
      expect(duel.height, id).toBe(96);
      const card = (await c.boundingBox())!;
      for (const logo of await c.getByTestId("team-logo").all()) {
        const b = (await logo.boundingBox())!;
        expect(b.x, id).toBeGreaterThanOrEqual(card.x);
        expect(b.x + b.width, id).toBeLessThanOrEqual(card.x + card.width);
      }
    }
  });

  test("75/35 bracket is grey and 76/34 is lime", async ({ page }) => {
    await open(page);
    const grey = await page
      .getByTestId("duel-case-75-35")
      .getByTestId("duel-bracket")
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    const lime = await page
      .getByTestId("duel-case-76-34")
      .getByTestId("duel-bracket")
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(grey).not.toBe(lime);
  });

  test("exposes one sentence to assistive tech and is axe clean", async ({ page }) => {
    await open(page);
    await page.waitForTimeout(1200);
    await expect(
      page.getByTestId("duel-case-80-7").getByRole("img", { name: /Qualifies\.$/ }),
    ).toHaveAttribute(
      "aria-label",
      "Home FC 80 percent, Away FC 7 percent, gap 73 points. Rule: one team above 75 and the other below 35. Qualifies.",
    );
    const r = await new AxeBuilder({ page }).analyze();
    expect(r.violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
  });

  test("hero on the detail page shows the duel above the caption", async ({ page }) => {
    const ids = JSON.parse(
      (await import("node:fs")).readFileSync("tests/e2e/.auth/detail-ids.json", "utf8"),
    ) as Record<string, string>;
    await page.goto(`/matches/${ids.golden}`);
    const hero = page.getByTestId("match-hero");
    await expect(hero.getByTestId("form-duel")).toBeVisible();
    const duel = (await hero.getByTestId("form-duel").boundingBox())!;
    const teams = (await hero.getByTestId("hero-home").boundingBox())!;
    expect(duel.y).toBeGreaterThan(teams.y + teams.height);
    await expect(hero.getByTestId("form-duel")).toHaveAttribute(
      "aria-label",
      /Sporting Cristal 80 percent/,
    );
  });
});
