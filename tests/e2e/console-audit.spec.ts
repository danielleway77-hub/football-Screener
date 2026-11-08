import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import seedDetail from "./seed-detail";

// The specs share one isolated schema and others wipe it: restore the known detail matches first.
test.beforeAll(async () => {
  await seedDetail();
});

// Functional audit: no page may log console errors, page errors or hydration warnings (docs/FUNCTIONAL_AUDIT.md).

const goldenId = () =>
  (JSON.parse(readFileSync("tests/e2e/.auth/detail-ids.json", "utf8")) as Record<string, string>)
    .golden!;

const ROUTES = [
  "/",
  "/?day=tomorrow&sort=gap&q=Test",
  "/?day=today",
  "/runs",
  "/runs?status=FAILED&skipped=1",
  "/import",
  "/settings",
  "/matches/@golden",
];

function collect(page: Page, ignoreFailedResource = false) {
  const problems: string[] = [];
  page.on("console", (m) => {
    const type = m.type();
    const text = m.text();
    if (type !== "error" && !/hydrat/i.test(text)) return;
    // An intentional HTTP 404 (unknown URL) is logged by Chrome itself as a failed resource.
    if (ignoreFailedResource && /Failed to load resource/.test(text)) return;
    problems.push(`console.${type}: ${text}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  return problems;
}

for (const route of ROUTES) {
  test(`no console errors, page errors or hydration warnings on ${route}`, async ({ page }) => {
    const problems = collect(page);
    await page.goto(route.replace("@golden", goldenId()));
    await expect(page.locator("main")).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(problems).toEqual([]);
  });
}

test("no console errors on the 404 page", async ({ page }) => {
  const problems = collect(page, true);
  await page.goto("/definitely-not-a-page");
  await expect(page.locator("h1")).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(problems).toEqual([]);
});

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test("no console errors on /login", async ({ page }) => {
    const problems = collect(page);
    await page.goto("/login");
    await expect(page.locator("h1")).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(problems).toEqual([]);
  });
});
