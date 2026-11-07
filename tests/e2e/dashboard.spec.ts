import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import {
  baselineMatches,
  resetData,
  seedBaseline,
  seedMatches,
  seedRun,
  setSettings,
} from "./helpers/dashboard-db";

// Step 10.2 (and the 10.3/10.4 behaviours that live on the same page). All specs share ONE isolated
// database schema, so every test re-seeds a known state first and the suite must run with --workers=1.
test.setTimeout(90_000);

const cards = (page: Page) => page.getByTestId("match-card");
const ready = async (page: Page, url = "/") => {
  await page.goto(url);
  await expect(page.getByRole("heading", { level: 1, name: "Qualifying matches" })).toBeVisible();
  await expect(page.getByTestId("match-filters")).toBeVisible();
};

test.describe("dashboard with seeded data", () => {
  test.beforeEach(async () => {
    await seedBaseline();
  });

  test("golden: Sporting Cristal 80/7 visible, Atletico 44/56 absent, past match hidden", async ({
    page,
  }) => {
    await ready(page);
    await expect(page.getByRole("heading", { name: "Sporting Cristal" })).toBeVisible();
    await expect(page.getByText("Atletico Madrid")).toHaveCount(0);
    await expect(page.getByText("Past Home")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  });

  test("bento hero count equals the number of qualifying matches in the list", async ({ page }) => {
    await ready(page);
    await expect(cards(page)).toHaveCount(3);
    await expect(page.getByTestId("bento-count").locator(".sr-only")).toHaveText("3");
    await expect(page.getByTestId("results-caption").and(page.locator(":visible"))).toHaveText(
      "Showing 3 matches",
    );
    await expect(page.getByTestId("bento-showing")).toContainText("of 3");
    await expect(page.getByTestId("next-kickoff")).toContainText("Next kickoff");
  });

  test("filters update the URL and survive reload and Back", async ({ page }) => {
    await ready(page);
    await page.getByRole("tab", { name: /^Tomorrow/ }).click();
    await expect(page).toHaveURL(/day=tomorrow/);
    await expect(cards(page)).toHaveCount(1);
    await expect(page.getByTestId("results-caption").and(page.locator(":visible"))).toHaveText(
      "Showing 1 match",
    );
    await page.reload();
    await expect(page.getByRole("tab", { name: /^Tomorrow/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(cards(page)).toHaveCount(1);

    await page.getByLabel("Filter by league").fill("peru");
    await expect(page).toHaveURL(/q=peru/);
    await expect(cards(page)).toHaveCount(1);
    await page.getByLabel("Filter by league").fill("zzz");
    await expect(page).toHaveURL(/q=zzz/);
    await expect(page.getByText("Nothing matches these filters")).toBeVisible();
    await page.getByRole("link", { name: "Clear filters" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByLabel("Filter by league")).toHaveValue("");
    await expect(cards(page)).toHaveCount(3);
  });

  test("invalid params fall back to defaults", async ({ page }) => {
    await ready(page, "/?day=nope&sort=bad&q=" + "x".repeat(200));
    await expect(page.getByRole("tab", { name: /^Upcoming/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByLabel("Filter by league")).toHaveValue("x".repeat(60));
  });

  test("sort by biggest form gap orders cards by gap inside a day", async ({ page }) => {
    await seedMatches([
      {
        id: "t-small",
        home: "Small Gap",
        away: "Small Gap Away",
        homePct: 76,
        awayPct: 30,
        inHours: 23.5,
      },
    ]);
    await ready(page, "/?day=tomorrow&sort=gap");
    // tomorrow: golden gap 73, small gap 46 (kicks off earlier, so kickoff order would be reversed)
    const names = await page.getByTestId("match-card").locator("h3").allTextContents();
    expect(names.filter((_, i) => i % 2 === 0)).toEqual(["Sporting Cristal", "Small Gap"]);
    await ready(page, "/?day=tomorrow");
    const byKickoff = await page.getByTestId("match-card").locator("h3").allTextContents();
    expect(byKickoff.filter((_, i) => i % 2 === 0)).toEqual(["Small Gap", "Sporting Cristal"]);
  });

  test("tabs are keyboard navigable (arrow keys move and select)", async ({ page }) => {
    await ready(page);
    await page.getByRole("tab", { name: /^Upcoming/ }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: /^Today/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page).toHaveURL(/day=today/);
    await expect(page.getByRole("tab", { name: /^Today/ })).toBeFocused();
    await page.keyboard.press("End");
    await expect(page).toHaveURL(/day=dayafter/);
  });

  test("Day after tab is hidden when the window is 1 day", async ({ page }) => {
    await setSettings({ windowDays: 1 });
    await ready(page, "/?day=dayafter");
    await expect(page.getByRole("tab", { name: /^Day after/ })).toHaveCount(0);
    await expect(page.getByRole("tab", { name: /^Upcoming/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("layout: hero, panel, grid columns and control sizes per breakpoint", async ({
    page,
  }, testInfo) => {
    await ready(page);
    await expect(cards(page).first()).toBeVisible();
    const width = page.viewportSize()!.width;
    const box = async (id: string) => (await page.getByTestId(id).boundingBox())!;
    const container = (await page.getByTestId("bento").boundingBox())!;
    const hero = await box("bento-hero");

    if (width >= 1280) {
      const heroCard = await page.evaluate(
        () =>
          document
            .querySelector("[data-testid=bento-hero]")!
            .closest("[data-spotlight]")!
            .getBoundingClientRect().width,
      );
      const ratio = heroCard / container.width;
      expect(ratio).toBeGreaterThan(0.46);
      expect(ratio).toBeLessThan(0.54);
      const tile = await box("bento-scanned");
      expect(tile.width / container.width).toBeGreaterThan(0.14);
      expect(tile.width / container.width).toBeLessThan(0.19);
    } else {
      expect(hero.width).toBeGreaterThan(container.width * 0.9);
    }
    if (width < 768) {
      const tiles = [
        await box("bento-scanned"),
        await box("bento-updated"),
        await box("bento-showing"),
      ];
      expect(new Set(tiles.map((t) => Math.round(t.y))).size).toBe(1); // one row of three
      expect(Math.round(tiles[0]!.height)).toBe(88);
    }

    if (width >= 1024) {
      const panel = await box("run-status-panel");
      const h1 = (await page.getByRole("heading", { level: 1 }).boundingBox())!;
      expect(Math.abs(panel.width - 400)).toBeLessThanOrEqual(2);
      expect(panel.x).toBeGreaterThan(h1.x + 100);
    }

    // Cards are grouped by day (one grid per group), so read the grid's column count instead of card positions.
    const columns = await page.evaluate(() => {
      const card = document.querySelector('[data-testid="match-card"]')!;
      for (let el = card.parentElement; el; el = el.parentElement) {
        const cols = getComputedStyle(el).gridTemplateColumns;
        if (getComputedStyle(el).display === "grid" && cols !== "none")
          return cols.split(" ").length;
      }
      return 0;
    });
    const expected = width < 768 ? 1 : width < 1280 ? 2 : 3;
    expect(columns).toBe(expected);

    for (const locator of [page.getByLabel("Filter by league"), page.getByRole("tab").first()]) {
      expect((await locator.boundingBox())!.height).toBeGreaterThanOrEqual(40);
    }
    expect(
      (await page.getByLabel("Filter by league").boundingBox())!.height,
    ).toBeGreaterThanOrEqual(44);
    const sort = page.getByRole(width < 768 ? "button" : "combobox", { name: "Sort matches" });
    const sortBox = (await sort.boundingBox())!;
    expect(sortBox.height).toBeGreaterThanOrEqual(44);
    if (width >= 1920) expect(width).toBeGreaterThan(1900);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    void testInfo;
  });

  test("four cards fill four columns at 1920", async ({ page }) => {
    test.skip(page.viewportSize()!.width < 1920, "wide only");
    await seedMatches([
      { id: "extra", home: "Extra Home", away: "Extra Away", homePct: 90, awayPct: 4, inHours: 5 },
    ]);
    await ready(page);
    await expect(cards(page)).toHaveCount(4);
    const xs = await page.evaluate(
      () =>
        new Set(
          Array.from(document.querySelectorAll('[data-testid="match-card"]')).map((el) =>
            Math.round(el.getBoundingClientRect().x),
          ),
        ).size,
    );
    expect(xs).toBe(4);
  });

  test("axe finds no violations on the dashboard", async ({ page }) => {
    await ready(page);
    await expect(cards(page).first()).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.html.slice(0, 140)}`)).toEqual([]);
  });

  test("500 shows ErrorState with Retry and keeps the header and run panel", async ({ page }) => {
    test.skip(
      process.env.PW_PROD === "1",
      "the ?__error test hooks are compiled out of production builds (covered in dev mode)",
    );
    await ready(page, "/?__error=results");
    await expect(page.getByText("Couldn't load matches")).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Qualifying matches" })).toBeVisible();
    await expect(page.getByTestId("run-status-panel")).toBeVisible();
  });

  test("skeleton to content swap causes no layout shift (CLS < 0.01, footer excluded)", async ({
    page,
  }) => {
    // The footer is pushed down by the page growing past the viewport; that is not a shift of the content
    // the user is looking at, so shifts whose only moved node is the footer are ignored.
    await page.addInitScript(() => {
      const w = window as unknown as { __cls: number };
      w.__cls = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as unknown as {
          value: number;
          hadRecentInput: boolean;
          sources: { node?: Element }[];
        }[]) {
          const onlyFooter =
            e.sources.length > 0 && e.sources.every((s) => s.node?.closest("footer"));
          if (!e.hadRecentInput && !onlyFooter) w.__cls += e.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
    });
    await ready(page);
    await expect(cards(page).first()).toBeVisible();
    await page.waitForTimeout(1500);
    const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
    expect(cls).toBeLessThan(0.01);
  });
});

test.describe("run status panel and banners", () => {
  test("official API mode: Run now polls, announces the result and stops polling", async ({
    page,
  }) => {
    await seedBaseline("official_api");
    let polls = 0;
    await page.route("**/api/run", async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      await route.fulfill({ status: 202, json: { runId: "mock-run", status: "RUNNING" } });
    });
    await page.route("**/api/runs/mock-run", async (route) => {
      polls += 1;
      const done = polls >= 3;
      await route.fulfill({
        json: {
          id: "mock-run",
          status: done ? "SUCCESS" : "RUNNING",
          scanned: 42,
          qualified: 3,
          failedCount: 0,
          error: null,
        },
      });
    });
    await ready(page);
    const button = page.getByRole("button", { name: "Run now" });
    await expect(button).toBeEnabled();
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await button.click();
    await expect(page.getByRole("button", { name: "Running…" })).toBeDisabled();
    await expect(page.getByTestId("run-status-panel")).toHaveAttribute("data-state", "running");
    await expect(page.getByText("Checking fixtures…")).toBeVisible();
    await expect(page.getByText("3 qualifying matches found.")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "Run now" })).toBeEnabled();
    const settled = polls;
    await page.waitForTimeout(3500);
    expect(polls).toBe(settled); // polling stopped on the terminal status
  });

  test("assisted/manual mode: Update data links to /import", async ({ page }) => {
    for (const mode of ["assisted_ingest", "manual_import"] as const) {
      await seedBaseline(mode);
      await ready(page);
      const link = page.getByTestId("run-status-panel").getByRole("link", { name: "Update data" });
      await expect(link).toHaveAttribute("href", "/import");
      await expect(page.getByRole("button", { name: "Run now" })).toHaveCount(0);
    }
  });

  test("offline disables Run now with a visible reason", async ({ page, context }) => {
    await seedBaseline("official_api");
    await ready(page);
    await context.setOffline(true);
    await expect(page.getByRole("button", { name: "Run now" })).toBeDisabled();
    await expect(page.getByText("You're offline. Reconnect to run a check.")).toBeVisible();
    await context.setOffline(false);
  });

  test("stale banner appears at 30 hours and cards are still shown", async ({ page }) => {
    await resetData();
    await setSettings({ accessMode: "manual_import", staleAfterHrs: 24, windowDays: 2 });
    await seedRun({ finishedHoursAgo: 30 });
    await seedMatches(baselineMatches());
    await ready(page);
    await expect(
      page.getByTestId("banner").filter({ hasText: "Data is 30 hours old." }),
    ).toBeVisible();
    await expect(page.getByTestId("run-status-panel")).toHaveAttribute("data-state", "stale");
    await expect(cards(page).first()).toBeVisible();
  });

  test("PARTIAL and FAILED runs show their own panel states", async ({ page }) => {
    await resetData();
    await setSettings({ accessMode: "manual_import", windowDays: 2 });
    await seedRun({ status: "PARTIAL", scanned: 42, failedCount: 4, finishedHoursAgo: 1 });
    await seedMatches(baselineMatches());
    await ready(page);
    const panel = page.getByTestId("run-status-panel");
    await expect(panel).toHaveAttribute("data-state", "partial");
    await expect(panel).toContainText("38 of 42 stored");
    await expect(panel.getByRole("link", { name: "View details" })).toHaveAttribute(
      "href",
      "/runs",
    );

    await seedRun({ status: "FAILED", error: "The source was unreachable.", finishedHoursAgo: 0 });
    await page.reload();
    await expect(panel).toHaveAttribute("data-state", "failed");
    await expect(panel).toContainText("The source was unreachable.");
  });
});

test.describe("empty variants", () => {
  test("no data yet (manual import): onboarding card with Import data", async ({ page }) => {
    await resetData();
    await setSettings({ accessMode: "manual_import" });
    await ready(page);
    await expect(page.getByText("Import your first batch")).toBeVisible();
    await expect(page.getByRole("link", { name: "Import data" })).toHaveAttribute(
      "href",
      "/import",
    );
    await expect(page.getByTestId("run-status-panel")).toHaveAttribute("data-state", "never");
    await expect(page.getByTestId("bento-count")).toContainText("0");
  });

  test("no data yet per mode shows the matching title", async ({ page }) => {
    await resetData();
    await setSettings({ accessMode: "assisted_ingest" });
    await ready(page);
    await expect(page.getByText("Waiting for your first update")).toBeVisible();
    await setSettings({ accessMode: "official_api" });
    await page.reload();
    await expect(page.getByText("No matches yet")).toBeVisible();
    await expect(page.getByRole("button", { name: "Run now" })).toHaveCount(2);
  });

  test("data present but none qualify: explains the rule and links to Settings", async ({
    page,
  }) => {
    await resetData();
    await setSettings({ accessMode: "manual_import" });
    await seedRun({ scanned: 42, qualified: 0, finishedHoursAgo: 1 });
    await seedMatches([
      {
        id: "plain",
        home: "Plain A",
        away: "Plain B",
        homePct: 50,
        awayPct: 50,
        inHours: 24,
        qualifies: false,
      },
    ]);
    await ready(page);
    await expect(page.getByText("No matches qualify right now").first()).toBeVisible();
    await expect(
      page.getByText(/42 scanned at \d\d:\d\d\. None had one team above 75%/),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Adjust thresholds" })).toHaveAttribute(
      "href",
      "/settings",
    );
  });
});
