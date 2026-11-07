import { expect, test, type Page } from "@playwright/test";
import {
  baselineMatches,
  resetData,
  seedBaseline,
  seedMatches,
  seedRun,
  setSettings,
} from "./helpers/dashboard-db";

// Step 10.4: day groups and the navbar freshness pill. Shared isolated schema: run with --workers=1.
test.setTimeout(90_000);

const groups = (page: Page) => page.getByTestId("day-group");
const pill = (page: Page) => page.getByTestId("freshness-pill");

async function open(page: Page, url = "/") {
  await page.goto(url);
  await expect(page.getByTestId("match-filters")).toBeVisible();
}

test.describe("day groups", () => {
  test.beforeEach(async () => {
    await seedBaseline();
  });

  test("Upcoming groups by local day, in order, with labels and counts; one h1, groups are h2", async ({
    page,
  }) => {
    await open(page);
    await expect(groups(page)).toHaveCount(3);
    const headings = await groups(page).getByRole("heading", { level: 2 }).allTextContents();
    expect(headings[0]).toMatch(/^Today · \w{3} \d{1,2} \w{3}$/);
    expect(headings[1]).toMatch(/^Tomorrow · \w{3} \d{1,2} \w{3}$/);
    expect(headings[2]).toMatch(/^\w{3} \d{1,2} \w{3}$/);
    await expect(page.getByTestId("day-group-count")).toHaveText(["1 match", "1 match", "1 match"]);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(groups(page).first()).toHaveAttribute("aria-labelledby", /day-group-/);
    // chronological: Today Home, Sporting Cristal, Dayafter Home
    const teams = await page.getByTestId("match-card").locator("h3").allTextContents();
    expect(teams.filter((_, i) => i % 2 === 0)).toEqual([
      "Today Home",
      "Sporting Cristal",
      "Dayafter Home",
    ]);
  });

  test("single-day tabs show no group header", async ({ page }) => {
    for (const day of ["today", "tomorrow", "dayafter"]) {
      await open(page, `/?day=${day}`);
      await expect(page.getByTestId("match-card").first()).toBeVisible();
      await expect(groups(page)).toHaveCount(0);
    }
  });

  test("sort applies within each day and says so; kickoff sort has no note", async ({ page }) => {
    await seedMatches([
      {
        id: "tomorrow-early-small",
        home: "Early Small",
        away: "Early Small Away",
        homePct: 76,
        awayPct: 30,
        inHours: 23.5,
      },
    ]);
    await open(page, "/?sort=gap");
    await expect(page.getByTestId("sort-note")).toHaveText("Sorted within each day");
    const tomorrow = groups(page).nth(1);
    const names = await tomorrow.locator("h3").allTextContents();
    expect(names.filter((_, i) => i % 2 === 0)).toEqual(["Sporting Cristal", "Early Small"]); // gap 73 then 46
    await expect(groups(page).first().getByRole("heading", { level: 2 })).toContainText("Today");

    await open(page, "/");
    await expect(page.getByTestId("sort-note")).toHaveCount(0);
    const byKickoff = await groups(page).nth(1).locator("h3").allTextContents();
    expect(byKickoff.filter((_, i) => i % 2 === 0)).toEqual(["Early Small", "Sporting Cristal"]);
  });
});

test.describe("freshness pill", () => {
  test("server-rendered initial value (in the HTML response), 32px, links to /runs", async ({
    page,
  }) => {
    await seedBaseline();
    const html = await (await page.request.get("/")).text();
    expect(html).toContain('data-testid="freshness-pill"');
    expect(html).toMatch(/Updated[^<]*(<[^>]*>)*1(<[^>]*>)* h ago/);

    await open(page);
    test.skip(page.viewportSize()!.width < 1024, "navbar pill is shown from 1024px");
    const navbar = page.getByTestId("navbar");
    await expect(navbar.getByTestId("freshness-pill")).toBeVisible();
    const box = (await pill(page).boundingBox())!;
    expect(Math.round(box.height)).toBe(32);
    expect(box.width).toBeGreaterThanOrEqual(150);
    await expect(pill(page)).toHaveAttribute("data-tone", "positive");
    await expect(pill(page)).toHaveAccessibleName(
      /^Updated .+. Data last updated Today \d\d:\d\d\. View run history\.$/,
    );
    await pill(page).click();
    await expect(page).toHaveURL(/\/runs$/);
  });

  test("states: stale, never and running", async ({ page }) => {
    test.skip(page.viewportSize()!.width < 1024, "navbar pill is shown from 1024px");
    await resetData();
    await setSettings({ accessMode: "manual_import", staleAfterHrs: 24 });
    await open(page);
    await expect(pill(page)).toHaveText("No data yet");
    await expect(pill(page)).toHaveAttribute("data-tone", "faint");

    await seedRun({ finishedHoursAgo: 30 });
    await page.reload();
    await expect(pill(page)).toHaveAttribute("data-tone", "warning");
    await expect(pill(page)).toContainText("Updated 1 d ago");

    await seedRun({ status: "RUNNING", finishedHoursAgo: 0 });
    await page.reload();
    await expect(pill(page)).toHaveText("Checking…");
    await expect(pill(page)).toHaveAttribute("data-tone", "running");
  });

  test("a finished Run now refreshes the pill without a reload", async ({ page }) => {
    test.skip(page.viewportSize()!.width < 1024, "navbar pill is shown from 1024px");
    await resetData();
    await setSettings({ accessMode: "official_api", staleAfterHrs: 24 });
    await seedRun({ finishedHoursAgo: 30 });
    await seedMatches(baselineMatches());
    await page.route("**/api/run", (route) =>
      route.request().method() === "POST"
        ? route.fulfill({ status: 202, json: { runId: "mock-run", status: "RUNNING" } })
        : route.fallback(),
    );
    await page.route("**/api/runs/mock-run", async (route) => {
      await seedRun({ finishedHoursAgo: 0 }); // the "real" run finished and stored its data
      await route.fulfill({
        json: {
          id: "mock-run",
          status: "SUCCESS",
          scanned: 9,
          qualified: 3,
          failedCount: 0,
          error: null,
        },
      });
    });
    await open(page);
    await expect(pill(page)).toHaveAttribute("data-tone", "warning");
    await page.getByTestId("run-status-panel").getByRole("button", { name: "Run now" }).click();
    await expect(pill(page)).toHaveAttribute("data-tone", "positive", { timeout: 20_000 });
    await expect(pill(page)).toContainText("just now");
  });

  test("the navbar does not overflow at 1024px", async ({ page }) => {
    test.skip(page.viewportSize()!.width !== 1280, "single run");
    await seedBaseline();
    await page.setViewportSize({ width: 1024, height: 800 });
    await open(page);
    await expect(pill(page)).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    const header = (await page.getByTestId("navbar").boundingBox())!;
    expect(header.height).toBe(64);
  });

  test("phone: the pill is at the top of the menu sheet, not in the navbar", async ({ page }) => {
    test.skip(page.viewportSize()!.width >= 768, "phone only");
    await seedBaseline();
    await open(page);
    await expect(pill(page)).toBeHidden(); // the navbar copy is display:none below 1024px
    await page.getByRole("button", { name: "Open menu" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByTestId("freshness-pill")).toBeVisible();
    const pillBox = (await dialog.getByTestId("freshness-pill").boundingBox())!;
    const navBox = (await dialog.getByRole("navigation").boundingBox())!;
    expect(pillBox.y).toBeLessThan(navBox.y);
    await dialog.getByTestId("freshness-pill").click();
    await expect(page).toHaveURL(/\/runs$/);
  });
});

test.describe("login page", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test("has no freshness pill", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByTestId("freshness-pill")).toHaveCount(0);
  });
});
