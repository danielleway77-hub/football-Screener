import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// Step 6.1 (docs/TEST_CATALOG.md §6.1). Every test uses its own fake client IP (x-forwarded-for) so the
// 5-failures-per-IP lockout of one test never affects another.
if (existsSync(".env.test.local")) process.loadEnvFile(".env.test.local");
const PASSWORD = process.env.E2E_PASSWORD ?? "";
const fakeIp = () => `2001:db8::${randomUUID().slice(0, 4)}:${randomUUID().slice(0, 4)}`;

const signedOut = { cookies: [], origins: [] };

test.describe("signed out", () => {
  test.use({ storageState: signedOut });

  async function openLogin(page: Page, url = "/login") {
    await page.context().setExtraHTTPHeaders({ "x-forwarded-for": fakeIp() });
    await page.goto(url);
    await expect(page.getByTestId("login-form")).toHaveAttribute("data-hydrated", "true");
  }

  test("logged-out visit redirects to /login?next=", async ({ page }) => {
    await page.goto("/runs?x=1");
    await expect(page).toHaveURL(/\/login\?next=%2Fruns%3Fx%3D1$/);
    await page.goto("/");
    await expect(page).toHaveURL(/\/login\?next=%2F$/);
  });

  test("wrong password shows the generic error, associated with the field", async ({ page }) => {
    await openLogin(page);
    await page.locator("#password").fill("definitely-wrong");
    await page.getByRole("button", { name: "Sign in" }).click();
    const error = page.getByText("Incorrect password.");
    await expect(error).toBeVisible();
    const input = page.locator("#password");
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(input).toHaveAttribute("aria-describedby", "password-error");
    await expect(input).toBeFocused();
    await expect(page).toHaveURL(/\/login/);
  });

  test("5 failures show the lockout message and disable the form", async ({ page, baseURL }) => {
    const ip = fakeIp();
    await page.context().setExtraHTTPHeaders({ "x-forwarded-for": ip });
    for (let i = 0; i < 5; i++) {
      const res = await page.request.post("/api/auth/login", {
        data: { password: "nope-" + i },
        headers: { Origin: baseURL! },
      });
      expect(res.status()).toBe(401);
    }
    await page.goto("/login");
    await expect(page.getByTestId("login-form")).toHaveAttribute("data-hydrated", "true");
    await page.locator("#password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    // even the CORRECT password is refused while locked out
    await expect(page.getByText(/Too many attempts\. Try again in \d+ minutes?\./)).toBeVisible();
    await expect(page.locator("#password")).toBeDisabled();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeDisabled();
  });

  test("correct login lands on the dashboard; cookie is HttpOnly + SameSite=Lax", async ({
    page,
  }) => {
    await openLogin(page);
    await page.locator("#password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL((u) => u.pathname === "/");
    await expect(page.getByRole("heading", { level: 1, name: "Qualifying matches" })).toBeVisible();
    const cookie = (await page.context().cookies()).find((c) => c.name === "session");
    expect(cookie).toBeDefined();
    expect(cookie!.httpOnly).toBe(true);
    expect(cookie!.sameSite).toBe("Lax");
    expect(cookie!.path).toBe("/");
    await expect(page.evaluate(() => document.cookie)).resolves.not.toContain("session=");
  });

  test("login honours a safe next and ignores an open-redirect next", async ({ page }) => {
    await openLogin(page, "/login?next=%2Fruns");
    await page.locator("#password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL((u) => u.pathname === "/runs");
    await page.context().clearCookies();
    await openLogin(page, "/login?next=https%3A%2F%2Fevil.com");
    await page.locator("#password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL((u) => u.pathname === "/" && u.hostname === "localhost");
  });

  test("API call without a cookie returns 401 JSON", async ({ request }) => {
    const res = await request.post("/api/run");
    expect(res.status()).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHORIZED");
  });

  test("cross-origin login POST is refused (403) and a missing Origin too", async ({ request }) => {
    const evil = await request.post("/api/auth/login", {
      data: { password: PASSWORD },
      headers: { Origin: "https://evil.example" },
    });
    expect(evil.status()).toBe(403);
    const none = await request.post("/api/auth/login", { data: { password: PASSWORD } });
    expect(none.status()).toBe(403);
  });

  test("a tampered session cookie is treated as logged out", async ({ page, baseURL }) => {
    await page
      .context()
      .addCookies([{ name: "session", value: "eyJhbGciOiJIUzI1NiJ9.e30.bad", url: baseURL! }]);
    await page.goto("/runs");
    await expect(page).toHaveURL(/\/login\?next=/);
  });

  test("login page has no nav/footer, correct sizes, focus in the password field", async ({
    page,
  }) => {
    await openLogin(page);
    await expect(page.locator("nav")).toHaveCount(0);
    await expect(page.locator("footer")).toHaveCount(0);
    await expect(page.locator("#password")).toBeFocused();
    const input = (await page.locator("#password").boundingBox())!;
    const button = (await page.getByRole("button", { name: "Sign in" }).boundingBox())!;
    const toggle = (await page.getByRole("button", { name: "Show password" }).boundingBox())!;
    expect(Math.round(input.height)).toBe(44);
    expect(Math.round(button.height)).toBe(52);
    expect(toggle.width).toBeGreaterThanOrEqual(44);
    expect(toggle.height).toBeGreaterThanOrEqual(44);
    const doc = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
    }));
    expect(doc.sw).toBeLessThanOrEqual(doc.cw);
    if ((page.viewportSize()?.width ?? 0) >= 768) {
      const card = (await page.locator("main > div").first().boundingBox())!;
      expect(Math.round(card.width)).toBe(420);
    }
  });

  test("show/hide toggle flips the input type and aria-pressed", async ({ page }) => {
    await openLogin(page);
    const input = page.locator("#password");
    await expect(input).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(input).toHaveAttribute("type", "text");
    await expect(page.getByRole("button", { name: "Hide password" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("offline: the button is disabled and says why", async ({ page }) => {
    await openLogin(page);
    await page.context().setOffline(true);
    await expect(page.getByText("You're offline. Reconnect to sign in.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeDisabled();
    await page.context().setOffline(false);
  });
});

test.describe("signed in", () => {
  test("login page redirects an authenticated user to /", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL((u) => u.pathname === "/");
  });

  test("logout clears the session and protects the app again", async ({ browser, baseURL }) => {
    // A private context with its OWN login so logging out does not revoke the shared storage state.
    const context = await browser.newContext({
      baseURL,
      extraHTTPHeaders: { "x-forwarded-for": fakeIp() },
    });
    const login = await context.request.post("/api/auth/login", {
      data: { password: PASSWORD },
      headers: { Origin: baseURL! },
    });
    expect(login.status()).toBe(204);
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const out = await context.request.post("/api/auth/logout", { headers: { Origin: baseURL! } });
    expect(out.status()).toBe(204);
    expect((await context.cookies()).find((c) => c.name === "session")).toBeUndefined();
    await page.goto("/");
    await expect(page).toHaveURL(/\/login\?next=%2F$/);
    await context.close();
  });
});
