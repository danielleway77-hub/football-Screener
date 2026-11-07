import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import seedDetail from "./seed-detail";

// The specs share one isolated schema and others wipe it: restore the known detail matches first.
test.beforeAll(async () => {
  await seedDetail();
});

// The detail page needs a real match: ids come from the seeded isolated e2e schema (tests/e2e/seed-detail.ts).
const goldenId = () =>
  (JSON.parse(readFileSync("tests/e2e/.auth/detail-ids.json", "utf8")) as Record<string, string>)
    .golden!;

// Step 4.1 (docs/TEST_CATALOG.md §4.1): routing skeleton.

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 0) < 768;

const PAGES = [
  { path: "/", title: "Dashboard · Screener", h1: "Qualifying matches" },
  { path: "/runs", title: "Runs · Screener", h1: "Run history" },
  { path: "/import", title: "Import · Screener", h1: "Update your matches" },
  { path: "/settings", title: "Settings · Screener", h1: "Settings" },
  {
    path: "/matches/@golden",
    title: "Sporting Cristal vs FC Cajamarca · Screener",
    h1: "Sporting Cristal vs FC Cajamarca",
  },
];

for (const p of PAGES) {
  test(`${p.path}: one h1, correct title, shell present`, async ({ page }) => {
    await page.goto(p.path.replace("@golden", goldenId()));
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveText(p.h1);
    await expect(page).toHaveTitle(p.title);
    await expect(page.getByTestId("navbar")).toBeVisible();
    await expect(page.locator("footer")).toBeVisible();
  });
}

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test("/login: titled, one h1, no nav and no footer", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle("Sign in · Screener");
    await expect(page.locator("h1")).toHaveText("Sign in");
    await expect(page.locator("nav")).toHaveCount(0);
    await expect(page.locator("footer")).toHaveCount(0);
    await expect(page.getByText("Personal use only.")).toBeVisible();
  });
});

test("every nav link navigates and lands focus on #main", async ({ page }) => {
  test.skip(isMobile(page), "desktop nav");
  await page.goto("/");
  await expect(page.getByTestId("navbar")).toHaveAttribute("data-hydrated", "true");
  const nav = page.getByRole("navigation", { name: "Main" }).first();
  for (const [name, path, h1] of [
    ["Runs", "/runs", "Run history"],
    ["Import", "/import", "Update your matches"],
    ["Settings", "/settings", "Settings"],
    ["Dashboard", "/", "Qualifying matches"],
  ] as const) {
    await nav.getByRole("link", { name }).click();
    await expect(page).toHaveURL((u) => u.pathname === path);
    await expect(page.getByRole("heading", { level: 1, name: h1 })).toBeVisible();
    // Next keeps the previous route in the DOM (hidden); only the visible one counts.
    await expect(page.locator("h1:visible")).toHaveCount(1);
    await expect(page.locator("#main")).toBeFocused();
  }
});

test("unknown URL shows the branded 404 linking home", async ({ page }) => {
  const res = await page.goto("/nope");
  expect(res?.status()).toBe(404);
  await expect(page.getByTestId("not-found")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
  const back = page.getByRole("link", { name: "Back to dashboard" });
  expect(Math.round((await back.boundingBox())!.height)).toBeGreaterThanOrEqual(44);
  await back.click();
  await expect(page).toHaveURL((u) => u.pathname === "/");
});

for (const path of ["/", "/runs", "/import", "/settings", "/matches/@golden"]) {
  test(`forced error on ${path} shows ErrorState and Retry recovers`, async ({ page }) => {
    test.skip(
      process.env.PW_PROD === "1",
      "the ?__error test hooks are compiled out of production builds (covered in dev mode)",
    );
    await page.goto(`${path.replace("@golden", goldenId())}?__error=1`);
    await expect(page.getByText("Something went wrong")).toBeVisible();
    await expect(page.getByRole("link", { name: "Dashboard" }).last()).toHaveAttribute("href", "/");
    // Retry re-renders the segment, which throws again while ?__error=1 is present: the boundary must still
    // be interactive (button re-enabled, no crash).
    const retry = page.getByRole("button", { name: /try again/i });
    await retry.click();
    await expect(retry).toBeEnabled();
    await expect(page.getByText("Something went wrong")).toBeVisible();
    await expect(page.locator("main").getByText("Forced test error")).toHaveCount(0); // message never shown to users
  });
}

test("skeleton header block has the same height as the real header (±2px)", async ({ page }) => {
  await page.goto("/style-guide/header-parity");
  const real = await page.getByTestId("real-header").boundingBox();
  const skel = await page.getByTestId("skeleton-header").boundingBox();
  expect(Math.abs(real!.height - skel!.height)).toBeLessThanOrEqual(2);
});

test("health endpoint and robots", async ({ request }) => {
  const h = await request.get("/api/health");
  expect(h.status()).toBe(200);
  expect(await h.json()).toMatchObject({ ok: true, db: true }); // shape since Step 8: db check + last run
  const r = await (await request.get("/robots.txt")).text();
  expect(r).toContain("Disallow: /");
});
