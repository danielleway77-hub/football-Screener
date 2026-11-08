import { existsSync, readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import seedDetail, { DETAIL_IDS_FILE, withE2eDb, XSS_NAME } from "./seed-detail";

test.beforeAll(async () => {
  await seedDetail(); // other specs wipe the shared schema
});

// Needs the ISOLATED e2e schema (see playwright.config.ts / seed-detail.ts): the matches are seeded there.
test.skip(!existsSync(DETAIL_IDS_FILE), "isolated e2e database not available");

const ids = () => JSON.parse(readFileSync(DETAIL_IDS_FILE, "utf8")) as Record<string, string>;
const open = async (page: Page, key: keyof ReturnType<typeof ids> | string, query = "") => {
  await page.goto(`/matches/${ids()[key]}${query}`);
  await expect(page.getByTestId("match-hero")).toBeVisible();
};
const box = async (page: Page, testId: string) => {
  const b = await page.getByTestId(testId).boundingBox();
  if (!b) throw new Error(`${testId} has no box`);
  return b;
};

test.describe("match detail", () => {
  test("deep link and refresh work", async ({ page }) => {
    await open(page, "golden");
    await expect(page).toHaveTitle(/Sporting Cristal vs FC Cajamarca/);
    await page.reload();
    await expect(page.getByTestId("match-hero")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Sporting Cristal vs FC Cajamarca",
    );
  });

  test("invalid id gives branded 404", async ({ page }) => {
    // Streaming (Cache Components) has already sent the 200 header when the page calls notFound(), so we
    // assert on the branded UI and the noindex meta that Next injects, not on the HTTP status.
    await page.goto("/matches/xyz");
    await expect(page.getByTestId("not-found")).toBeVisible();
    await expect(page.locator("meta[name=robots]").first()).toHaveAttribute("content", /noindex/);
    await page.goto("/matches/" + "a".repeat(200));
    await expect(page.getByTestId("not-found")).toBeVisible();
  });

  test("hero shows one h2 per team, league, kickoff and the verdict", async ({ page }) => {
    await open(page, "golden");
    const hero = page.getByTestId("match-hero");
    await expect(hero.getByRole("heading", { level: 2 })).toHaveText([
      "Sporting Cristal",
      "FC Cajamarca",
    ]);
    await expect(hero).toContainText("Peru · Liga 1");
    await expect(hero.getByTestId("qualifies-chip")).toHaveText("QUALIFIES");
    await expect(hero).toContainText("Strong: Sporting Cristal · League form");
    await expect(hero.getByTestId("confidence")).toHaveText(/Confidence HIGH/);
    await expect(hero).toContainText(/in 1 day|in \d+ hours?/);
  });

  test("explanation sentence contains both teams and both percentages", async ({ page }) => {
    await open(page, "golden");
    const text = (await page.getByTestId("form-explanation").textContent()) ?? "";
    for (const part of ["Sporting Cristal", "FC Cajamarca", "80%", "7%"]) {
      expect(text).toContain(part);
    }
    // The rule thresholds are the current settings, so don't pin them (another spec changes them briefly).
    expect(text).toMatch(/is above \d+% and FC Cajamarca's \(7%\) is below \d+%\./);
  });

  test("form card shows large bars with tick labels, badges and the gap", async ({ page }) => {
    await open(page, "golden");
    const card = page.getByTestId("form-card");
    await expect(card.getByTestId("form-track")).toHaveCount(2);
    for (const track of await card.getByTestId("form-track").all()) {
      expect((await track.boundingBox())?.height).toBeCloseTo(12, 0);
    }
    await expect(card.getByTestId("form-gap")).toContainText("73 pts");
    await expect(card.getByLabel("Recent results, oldest to newest")).toHaveCount(2);
    await expect(card.getByLabel("Win")).toHaveCount(4);
  });

  test("layout: form card ≈ 7/12 and probability card ≈ 5/12 at 1280", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "measured at 1280 only");
    await open(page, "golden");
    const form = await box(page, "form-card");
    const prob = await box(page, "probability-card");
    const total = prob.x + prob.width - form.x;
    expect(Math.abs(form.width - (total * 7) / 12)).toBeLessThanOrEqual(24);
    expect(Math.abs(prob.width - (total * 5) / 12)).toBeLessThanOrEqual(24);
    expect(Math.abs(form.y - prob.y)).toBeLessThanOrEqual(1);
  });

  test("ProbabilityPanel shows predicted score, Home/Draw/Away bars, BTTS and Over/Under with golden values", async ({
    page,
  }) => {
    await open(page, "golden");
    const panel = page.getByTestId("probability-panel");
    await expect(panel).toHaveAttribute("aria-label", "Exact probabilities");
    await expect(panel.getByTestId("predicted-score-tile")).toContainText("3–1");
    const rows = panel.getByTestId("prob-row");
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText("Win Sporting Cristal");
    await expect(rows.nth(0)).toContainText("76%");
    await expect(rows.nth(1)).toContainText("Draw");
    await expect(rows.nth(1)).toContainText("16%");
    await expect(rows.nth(2)).toContainText("Win FC Cajamarca");
    await expect(rows.nth(2)).toContainText("8%");
    const tiles = panel.getByTestId("prob-tile");
    await expect(tiles.nth(0)).toHaveAccessibleName(/Yes: 54 percent/);
    await expect(tiles.nth(1)).toHaveAccessibleName(/No: 46 percent \(calculated\)/);
    await expect(tiles.nth(2)).toHaveAccessibleName(/Over: 70 percent/);
    await expect(tiles.nth(3)).toHaveAccessibleName(/Under: 30 percent \(calculated\)/);
    await expect(page.getByTestId("probability-card")).toContainText(
      /From the data source at \w{3} \d+ \w{3} \d\d:\d\d\./,
    );
  });

  test("highest bar is lime, the others neutral; null probabilities read Unavailable", async ({
    page,
  }) => {
    await open(page, "golden");
    const fills = page.getByTestId("prob-track").locator("> *");
    await expect(fills.nth(0)).toHaveClass(/bg-primary/);
    await expect(fills.nth(1)).toHaveClass(/bg-neutral-bar/);
    await expect(fills.nth(2)).toHaveClass(/bg-neutral-bar/);
    await expect(page.getByTestId("prob-row").nth(0)).toHaveAttribute("data-highest", "true");

    await open(page, "away-strong");
    const panel = page.getByTestId("probability-panel");
    await expect(panel.getByTestId("prob-row")).toHaveCount(3);
    await expect(panel.getByText("Unavailable")).toHaveCount(3 + 4); // 3 rows + 4 pair tiles
    await expect(panel.getByTestId("predicted-score-tile")).toHaveCount(0);
    await expect(
      page.getByTestId("form-card").getByLabel("Recent results, oldest to newest"),
    ).toHaveCount(0);
    await expect(page.getByTestId("source-link")).toHaveCount(0);
    await expect(page.getByTestId("confidence")).toHaveCount(0);
  });

  test("external link has rel noopener noreferrer and target _blank", async ({ page }) => {
    await open(page, "golden");
    const link = page.getByTestId("source-link");
    await expect(link).toHaveText(/Open on e2e-detail/); // label derives from the match provider (not hard-coded)
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    await expect(link).toHaveAttribute("href", "https://example.com/predigoal/match/golden");
    expect((await link.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await expect(page.getByTestId("meta-row")).toContainText(
      /Fetched \w{3} \d+ \w{3} \d\d:\d\d · Source: /,
    );
  });

  test("a non-http source URL is never rendered as a link", async ({ page }) => {
    await open(page, "xss");
    await expect(page.getByTestId("source-link")).toHaveCount(0);
  });

  test("team name with <script> renders as text", async ({ page }) => {
    const errors: string[] = [];
    page.on("dialog", (d) => {
      errors.push(d.message());
      void d.dismiss();
    });
    await open(page, "xss");
    await expect(page.getByTestId("hero-home")).toContainText(XSS_NAME);
    expect(
      await page.evaluate(() => (window as unknown as { __xss?: number }).__xss),
    ).toBeUndefined();
    expect(await page.locator("script", { hasText: "__xss" }).count()).toBe(0);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(new RegExp("window.__xss=1"));
  });

  test("long names wrap inside the hero without overflow", async ({ page }) => {
    await open(page, "xss");
    const doc = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
    }));
    expect(doc.sw).toBeLessThanOrEqual(doc.cw);
    const away = await box(page, "hero-away");
    const hero = await box(page, "match-hero");
    expect(away.x + away.width).toBeLessThanOrEqual(hero.x + hero.width + 1);
  });

  test("no-longer-qualifies note when the stored flag is stale", async ({ page }) => {
    await open(page, "stale-flag");
    const hero = page.getByTestId("match-hero");
    await expect(hero.getByTestId("qualifies-chip")).toHaveText("NO LONGER QUALIFIES");
    const note = hero.getByTestId("no-longer-note");
    await expect(note).toContainText(
      "No longer qualifies under your current thresholds (75% / 35%).",
    );
    await expect(note.getByRole("link", { name: "Change thresholds" })).toHaveAttribute(
      "href",
      "/settings",
    );
    await expect(page.getByTestId("form-explanation")).toContainText(
      "Neither team pair meets the rule",
    );
  });

  test("no-longer-qualifies note appears when thresholds change", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "changes shared settings: desktop project only");
    const setHigh = (v: number) =>
      withE2eDb((db) => db.query(`UPDATE "Setting" SET "highThreshold" = $1 WHERE "id" = 1`, [v]));
    try {
      await open(page, "threshold");
      await expect(page.getByTestId("qualifies-chip")).toHaveText("QUALIFIES");
      await setHigh(79);
      await page.reload();
      await expect(page.getByTestId("qualifies-chip")).toHaveText("NO LONGER QUALIFIES");
      await expect(page.getByTestId("no-longer-note")).toContainText("(79% / 35%)");
    } finally {
      await setHigh(75);
    }
  });

  test("pager is disabled at the ends with visible text", async ({ page }) => {
    await open(page, "away-strong"); // earliest qualifying match
    await expect(page.getByTestId("pager-previous")).toBeDisabled();
    await expect(page.getByTestId("pager-previous-end")).toBeVisible();
    await expect(page.getByTestId("pager-previous-end")).toHaveText(
      "This is the first qualifying match.",
    );
    await expect(page.getByTestId("pager-next")).toBeEnabled();

    await open(page, "xss"); // latest qualifying match
    await expect(page.getByTestId("pager-next")).toBeDisabled();
    await expect(page.getByTestId("pager-next-end")).toHaveText(
      "This is the last qualifying match.",
    );
    await expect(page.getByTestId("pager-previous")).toBeEnabled();
  });

  test("pager moves between matches in kickoff order and keeps the dashboard context", async ({
    page,
  }) => {
    const from = encodeURIComponent("/?tab=upcoming&league=Liga%201");
    await open(page, "golden", `?from=${from}`);
    const next = page.getByTestId("pager-next");
    await expect(next).toHaveAttribute("title", /vs/);
    await next.click();
    await expect(page).toHaveURL(new RegExp(`/matches/${ids().xss}\\?from=`));
    await expect(page.getByRole("link", { name: /Back to dashboard/ })).toHaveAttribute(
      "href",
      "/?tab=upcoming&league=Liga%201",
    );
    // Next keeps the previous page mounted but hidden (Activity), so only look at what is visible.
    await page.locator('[data-testid="pager-previous"]:visible').click();
    await expect(page).toHaveURL(new RegExp(`/matches/${ids().golden}`));
  });

  test("back link validates `from`", async ({ page }) => {
    await open(page, "golden", `?from=${encodeURIComponent("//evil.example/x")}`);
    await expect(page.getByRole("link", { name: /Back to dashboard/ })).toHaveAttribute(
      "href",
      "/",
    );
    await open(page, "golden", `?from=${encodeURIComponent("https://evil.example")}`);
    await expect(page.getByRole("link", { name: /Back to dashboard/ })).toHaveAttribute(
      "href",
      "/",
    );
    await open(page, "golden", `?from=${encodeURIComponent("/settings")}`);
    await expect(page.getByRole("link", { name: /Back to dashboard/ })).toHaveAttribute(
      "href",
      "/",
    );
  });

  test("pager and back link sizes per breakpoint", async ({ page }, testInfo) => {
    await open(page, "golden");
    const w = page.viewportSize()!.width;
    const prev = await box(page, "pager-previous");
    const nextB = await box(page, "pager-next");
    const back = await page.getByRole("link", { name: /Back to dashboard/ }).boundingBox();
    expect(back!.height).toBeGreaterThanOrEqual(44);
    if (w < 768) {
      expect(prev.height).toBeGreaterThanOrEqual(44);
      expect(nextB.height).toBeGreaterThanOrEqual(44);
      expect(Math.abs(prev.width - nextB.width)).toBeLessThanOrEqual(2);
      const meta = await box(page, "meta-row");
      expect(prev.y).toBeGreaterThan(meta.y); // pager is at the very bottom
    } else {
      expect(prev.height).toBe(40);
      expect(Math.abs(prev.y - back!.y)).toBeLessThan(30); // same row as the back link
      expect(prev.x).toBeGreaterThan(w / 2); // right aligned
    }
    void testInfo;
  });

  test("has no automatically detectable accessibility violations", async ({ page }) => {
    await open(page, "golden");
    await page.waitForTimeout(1200); // let bars/count-ups settle before measuring contrast
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
  });
});

test.describe("match detail elevation", () => {
  test("no-probabilities note shows when the source sent none", async ({ page }) => {
    await open(page, "away-strong");
    await expect(page.getByTestId("no-probabilities")).toBeVisible();
  });
  test("sticky bar appears after the hero scrolls away", async ({ page }) => {
    await open(page, "golden");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.getByTestId("match-sticky")).toHaveAttribute("data-visible", "true");
  });
});
