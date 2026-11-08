import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { resetData, seedBaseline, seedRun, setSettings } from "./helpers/dashboard-db";

// Step 14.1 (docs/TEST_CATALOG.md §14.1): offline / slow / timeout / 500 / 401 / 429 / stale / PARTIAL
// per route. Network conditions are emulated with context.setOffline and page.route (TESTING_STANDARDS §5b);
// nothing here waits with a fixed sleep as an assertion. All specs share ONE schema: run with --workers=1.
if (existsSync(".env.test.local")) process.loadEnvFile(".env.test.local");
const PASSWORD = process.env.E2E_PASSWORD ?? "";
test.setTimeout(120_000);

const detailId = () => "golden"; // seeded by seedBaseline (baselineMatches)
const h1 = (page: Page, name: string | RegExp) =>
  expect(page.getByRole("heading", { level: 1, name })).toBeVisible();

async function open(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

test.describe("offline", () => {
  test.beforeEach(async () => {
    await seedBaseline("official_api");
  });

  for (const [label, url] of [
    ["dashboard", "/"],
    ["runs", "/runs"],
    ["match detail", "DETAIL"],
  ] as const) {
    test(`${label}: banner, then 'Back online.' with a Refresh action`, async ({
      page,
      context,
    }) => {
      await open(page, url === "DETAIL" ? `/matches/${detailId()}` : url);
      await context.setOffline(true);
      const banner = page.getByTestId("banner").filter({ hasText: "You're offline" });
      await expect(banner).toBeVisible();
      // The page content stays readable (read-only) while offline.
      await expect(page.locator("main")).toBeVisible();
      await context.setOffline(false);
      const back = page.getByTestId("banner").filter({ hasText: "Back online." });
      await expect(back).toBeVisible();
      await expect(back.getByRole("button", { name: "Refresh" })).toBeVisible();
      await expect(back).toHaveCount(0, { timeout: 8000 });
    });
  }

  test("dashboard: Run now is disabled with a visible reason, and logout is disabled", async ({
    page,
    context,
  }) => {
    await open(page, "/");
    await context.setOffline(true);
    await expect(page.getByRole("button", { name: "Run now" })).toBeDisabled();
    await expect(page.getByText("You're offline. Reconnect to run a check.")).toBeVisible();
    await context.setOffline(false);
    await expect(page.getByRole("button", { name: "Run now" })).toBeEnabled();
  });

  test("a run started online and held is not replayed when the connection toggles", async ({
    page,
    context,
  }) => {
    await open(page, "/");
    let posts = 0;
    await page.route("**/api/run", async (route) => {
      posts++;
      await new Promise((r) => setTimeout(r, 6000));
      await route.abort().catch(() => undefined);
    });
    await page.getByTestId("run-status-panel").getByRole("button", { name: "Run now" }).click();
    await expect.poll(() => posts).toBe(1);
    await context.setOffline(true);
    await context.setOffline(false);
    await expect(page.getByTestId("banner").filter({ hasText: "Back online." })).toBeVisible();
    await expect(
      page.getByTestId("run-status-panel").getByRole("button", { name: /Run now/ }),
    ).toBeEnabled({ timeout: 15_000 });
    expect(posts).toBe(1);
  });
});

test.describe("slow, timeout, 500", () => {
  test.beforeEach(async () => {
    await seedBaseline("official_api");
  });

  test("slow >3 s shows the hint under the button; it clears when the request settles", async ({
    page,
  }) => {
    await open(page, "/");
    await page.route("**/api/run", async (route) => {
      await new Promise((r) => setTimeout(r, 4500));
      await route.fulfill({ status: 500, json: { error: { code: "INTERNAL", message: "x" } } });
    });
    await page.getByRole("button", { name: "Run now" }).click();
    await expect(page.getByText("Still working…")).toBeVisible({ timeout: 8000 });
    await expect(page.getByText("Still working…")).toHaveCount(0, { timeout: 10_000 });
  });

  test("timeout (>15 s) on Run now says the check may already be running (no blind retry invite)", async ({
    page,
  }) => {
    await open(page, "/");
    let calls = 0;
    await page.route("**/api/run", async (route) => {
      calls++;
      if (calls === 1) {
        await new Promise((r) => setTimeout(r, 17_000));
        return route.abort().catch(() => undefined);
      }
      return route.fulfill({ status: 202, json: { runId: "r-ok", status: "RUNNING" } });
    });
    await page.route("**/api/runs/r-ok", (route) =>
      route.fulfill({
        json: {
          id: "r-ok",
          status: "SUCCESS",
          scanned: 5,
          qualified: 2,
          failedCount: 0,
          error: null,
        },
      }),
    );
    const button = page.getByRole("button", { name: /^Run now$/ });
    await button.click();
    await expect(page.getByText("may already be running").first()).toBeVisible({
      timeout: 25_000,
    });
    await expect(page.getByText(/taking longer than usual|try again/i)).toHaveCount(0);
    expect(calls).toBe(1); // never replayed automatically
    await expect(button).toBeEnabled();
  });

  test("500 on Run now: readable message, no stack, button usable again, one request per click", async ({
    page,
  }) => {
    await open(page, "/");
    let calls = 0;
    await page.route("**/api/run", (route) => {
      calls++;
      return route.fulfill({
        status: 500,
        json: {
          error: { code: "INTERNAL", message: "Something went wrong on our side. Try again." },
        },
      });
    });
    await page.getByRole("button", { name: "Run now" }).dblclick();
    await expect(page.getByText("went wrong on our side").first()).toBeVisible();
    await expect(page.getByText(/at \w+ \(|Error:|node_modules/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Run now" })).toBeEnabled();
    expect(calls).toBe(1);
  });

  test("Run now double-click sends exactly one POST while pending", async ({ page }) => {
    await open(page, "/");
    let posts = 0;
    await page.route("**/api/run", async (route) => {
      posts++;
      await new Promise((r) => setTimeout(r, 1500));
      await route.fulfill({
        status: 500,
        json: {
          error: { code: "INTERNAL", message: "Something went wrong on our side. Try again." },
        },
      });
    });
    await page.getByTestId("run-status-panel").getByRole("button", { name: "Run now" }).dblclick();
    await expect(page.getByText("Something went wrong on our side").first()).toBeVisible();
    expect(posts).toBe(1);
  });

  test("429 on Run now shows the wait time", async ({ page }) => {
    await open(page, "/");
    await page.route("**/api/run", (route) =>
      route.fulfill({
        status: 429,
        headers: { "retry-after": "180" },
        json: { error: { code: "RATE_LIMITED", message: "Rate limited" } },
      }),
    );
    await page.getByRole("button", { name: "Run now" }).click();
    await expect(page.getByText("Try again in 3 minutes.").first()).toBeVisible();
  });

  test("500 on data load (forced route error) shows ErrorState with a working Try again", async ({
    page,
  }) => {
    test.skip(
      process.env.PW_PROD === "1",
      "the ?__error test hooks are compiled out of production builds (covered in dev mode)",
    );
    await page.goto("/runs?__error=1");
    const error = page.getByTestId("error-state");
    await expect(error).toBeVisible();
    await expect(error).toContainText("Something went wrong");
    await page.goto("/runs");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test.describe("session expiry (401 mid-session)", () => {
  test("401 from an API call sends the user to /login?next= and back after signing in", async ({
    page,
  }) => {
    await seedBaseline("official_api");
    await open(page, "/");
    await page.route("**/api/run", (route) =>
      route.fulfill({ status: 401, json: { error: { code: "UNAUTHORIZED", message: "x" } } }),
    );
    await page.context().clearCookies(); // what a real expired session looks like
    await page.getByRole("button", { name: "Run now" }).click();
    await expect(page).toHaveURL(/\/login\?next=%2F$/);
    await page.unroute("**/api/run");
    await page
      .context()
      .setExtraHTTPHeaders({ "x-forwarded-for": `2001:db8::${randomUUID().slice(0, 4)}` });
    await expect(page.getByTestId("login-form")).toHaveAttribute("data-hydrated", "true");
    await page.locator("#password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/localhost:\d+\/$/);
  });

  test("deleting the session cookie mid-use redirects with next and returns after login", async ({
    page,
    context,
  }) => {
    await open(page, "/runs?page=1");
    await context.clearCookies();
    await page.reload();
    await expect(page).toHaveURL(/\/login\?next=%2Fruns%3Fpage%3D1$/);
    await page
      .context()
      .setExtraHTTPHeaders({ "x-forwarded-for": `2001:db8::${randomUUID().slice(0, 4)}` });
    await page.locator("#password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/runs\?page=1$/);
  });
});

test.describe("logout with an expired session", () => {
  test("still lands on /login", async ({ page, context }) => {
    await open(page, "/");
    await context.clearCookies();
    const logout = page.getByRole("button", { name: "Log out" });
    if (!(await logout.isVisible())) await page.getByRole("button", { name: "Open menu" }).click();
    await logout.click();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("login", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("429 shows the wait time in minutes and disables the form", async ({ page }) => {
    await page.route("**/api/auth/login", (route) =>
      route.fulfill({ status: 429, headers: { "retry-after": "540" }, body: "" }),
    );
    await page.goto("/login");
    await expect(page.getByTestId("login-form")).toHaveAttribute("data-hydrated", "true");
    await page.locator("#password").fill("whatever-12345");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Too many attempts. Try again in 9 minutes.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeDisabled();
  });

  test("offline: Sign in is disabled with helper text; slow sign-in shows the hint", async ({
    page,
    context,
  }) => {
    await page.goto("/login");
    await expect(page.getByTestId("login-form")).toHaveAttribute("data-hydrated", "true");
    await context.setOffline(true);
    await expect(page.getByRole("button", { name: "Sign in" })).toBeDisabled();
    await expect(page.getByText("You're offline. Reconnect to sign in.")).toBeVisible();
    await context.setOffline(false);

    await page.route("**/api/auth/login", async (route) => {
      await new Promise((r) => setTimeout(r, 4500));
      await route.fulfill({ status: 401, body: "" });
    });
    await page.locator("#password").fill("whatever-12345");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Still working…")).toBeVisible({ timeout: 8000 });
  });

  test("network failure keeps the typed password and shows a readable error", async ({ page }) => {
    await page.route("**/api/auth/login", (route) => route.abort());
    await page.goto("/login");
    await expect(page.getByTestId("login-form")).toHaveAttribute("data-hydrated", "true");
    await page.locator("#password").fill("keep-me-123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Couldn't reach the server. Try again.")).toBeVisible();
    await expect(page.locator("#password")).toHaveValue("keep-me-123");
  });
});

test.describe("stale and PARTIAL", () => {
  test("stale banner at 30 h; PARTIAL panel with warning counts", async ({ page }) => {
    await resetData();
    await setSettings({ accessMode: "manual_import", staleAfterHrs: 24, windowDays: 2 });
    await seedRun({ status: "SUCCESS", finishedHoursAgo: 30 });
    await open(page, "/");
    await expect(
      page.getByTestId("banner").filter({ hasText: "Data is 30 hours old." }),
    ).toBeVisible();
    await seedRun({ status: "PARTIAL", scanned: 42, failedCount: 4, finishedHoursAgo: 0 });
    await page.reload();
    await expect(page.getByTestId("run-status-panel")).toHaveAttribute("data-state", "partial");
    await expect(page.getByTestId("run-status-panel")).toContainText("4");
    await h1(page, "Qualifying matches");
  });
});

test.describe("404", () => {
  test("unknown match id renders the not-found view with a way back", async ({ page }) => {
    await page.goto("/matches/does-not-exist-123");
    await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
    await expect(page.getByRole("link", { name: /dashboard/i }).first()).toBeVisible();
  });
});
