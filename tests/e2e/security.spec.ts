import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { SESSION_COOKIE } from "./helpers/cookie";
import { resetData, seedBaseline, seedMatches, seedRun } from "./helpers/dashboard-db";

// Step 16.1 (docs/TEST_CATALOG.md section 16.1, TESTING_STANDARDS 5b): headers, unauthenticated access,
// open redirects and hostile strings against the real running app. Handler-level checks live in
// tests/integration/security.test.ts; the static route inventory in tests/unit/route-inventory.test.ts.
if (existsSync(".env.test.local")) process.loadEnvFile(".env.test.local");
const PASSWORD = process.env.E2E_PASSWORD ?? "";
const fakeIp = () => `2001:db8::${randomUUID().slice(0, 4)}:${randomUUID().slice(0, 4)}`;
const signedOut = { cookies: [], origins: [] };
const isProd = process.env.PW_PROD === "1";

const PAGES = ["/", "/runs", "/settings", "/import", "/matches/some-id"];
const SESSION_APIS: [string, string][] = [
  ["POST", "/api/import"],
  ["POST", "/api/run"],
  ["GET", "/api/runs/abc"],
  ["GET", "/api/settings"],
  ["PUT", "/api/settings"],
  ["POST", "/api/settings/password"],
  ["POST", "/api/settings/rescreen"],
  ["GET", "/api/tokens"],
  ["POST", "/api/tokens"],
  ["DELETE", "/api/tokens/abc"],
];

function expectSecurityHeaders(headers: Record<string, string>, where: string) {
  const csp = headers["content-security-policy"] ?? "";
  for (const d of [
    "default-src 'self'",
    "img-src 'self' data: https:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ]) {
    expect(csp, `${where} CSP ${d}`).toContain(d);
  }
  expect(headers["x-content-type-options"], where).toBe("nosniff");
  expect(headers["referrer-policy"], where).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"], where).toContain("camera=()");
  expect(headers["x-frame-options"], where).toBe("DENY");
  expect(headers["x-powered-by"], where).toBeUndefined();
}

test.describe("headers", () => {
  test("pages, 404, API success and API error all carry the security headers", async ({
    request,
  }) => {
    for (const url of [
      "/",
      "/runs",
      "/settings",
      "/does-not-exist",
      "/api/health",
      "/api/tokens",
    ]) {
      const res = await request.get(url);
      expectSecurityHeaders(res.headers(), url);
    }
    // Unauthenticated redirect and JSON 401 produced by the proxy carry them too.
    const anon = await (
      await import("@playwright/test")
    ).request.newContext({
      baseURL: test.info().project.use.baseURL!,
    });
    for (const url of ["/", "/api/tokens", "/login"]) {
      const res = await anon.get(url, { maxRedirects: 0 });
      expectSecurityHeaders(res.headers(), `anon ${url}`);
    }
    await anon.dispose();
  });

  test("API responses are not cacheable and CORS is limited to /api/ingest", async ({
    request,
  }) => {
    const res = await request.get("/api/settings");
    expect(res.headers()["cache-control"]).toBe("no-store");
    for (const url of ["/api/health", "/api/settings", "/api/tokens", "/runs"]) {
      const r = await request.get(url, { headers: { Origin: "https://evil.example" } });
      expect(r.headers()["access-control-allow-origin"], url).toBeUndefined();
    }
    const pre = await request.fetch("/api/ingest", {
      method: "OPTIONS",
      headers: { Origin: "https://evil.example", "Access-Control-Request-Method": "POST" },
    });
    expect(pre.status()).toBe(403);
    expect(pre.headers()["access-control-allow-origin"]).toBeUndefined();
  });

  test("robots: noindex meta and Disallow all", async ({ page, request }) => {
    expect(await (await request.get("/robots.txt")).text()).toMatch(/Disallow: \//);
    await page.goto("/");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("the CSP does not break the app: every page renders with zero CSP violations", async ({
    page,
  }) => {
    const violations: string[] = [];
    page.on("console", (m) => {
      if (/content security policy|violates the following/i.test(m.text())) {
        violations.push(m.text());
      }
    });
    page.on("pageerror", (e) => violations.push(e.message));
    await seedBaseline();
    for (const url of ["/", "/runs", "/settings", "/import", "/does-not-exist"]) {
      await page.goto(url);
      await expect(page.locator("main, h1").first()).toBeVisible();
    }
    expect(violations).toEqual([]);
  });

  test("/style-guide is 404 in a production build", async ({ request }) => {
    test.skip(!isProd, "only meaningful against the production build (PW_PROD=1)");
    for (const url of ["/style-guide", "/style-guide/match", "/style-guide/shell"]) {
      expect((await request.get(url)).status(), url).toBe(404);
    }
  });
});

test.describe("signed out", () => {
  test.use({ storageState: signedOut });

  test("every app page redirects to /login?next=", async ({ request }) => {
    for (const url of PAGES) {
      const res = await request.get(url, { maxRedirects: 0 });
      expect(res.status(), url).toBe(307);
      expect(res.headers().location, url).toMatch(/\/login\?next=/);
    }
  });

  test("every session API answers 401 with a generic body", async ({ request, baseURL }) => {
    for (const [method, url] of SESSION_APIS) {
      const res = await request.fetch(url, {
        method,
        data: method === "GET" ? undefined : {},
        headers: { Origin: baseURL! },
      });
      expect(res.status(), `${method} ${url}`).toBe(401);
      expect((await res.json()).error.code).toBe("UNAUTHORIZED");
    }
  });

  test("tampered, garbage and expired session cookies are treated as signed out", async ({
    page,
    context,
    baseURL,
  }) => {
    const cookies = [
      "garbage",
      "eyJhbGciOiJub25lIn0.eyJ2IjoxLCJleHAiOjk5OTk5OTk5OTl9.",
      // Well-formed HS256 token signed with another key.
      [
        "eyJhbGciOiJIUzI1NiJ9",
        "eyJ2IjoxLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MTcwMDAwMDAwMX0",
        "A".repeat(43),
      ].join("."),
    ];
    for (const value of cookies) {
      await context.clearCookies();
      await context.addCookies([
        {
          name: SESSION_COOKIE,
          value,
          domain: "localhost",
          path: "/",
          secure: SESSION_COOKIE.startsWith("__Host-"),
        },
      ]);
      await page.goto("/runs");
      await expect(page).toHaveURL(/\/login\?next=%2Fruns/);
      const res = await page.request.get("/api/tokens");
      expect(res.status()).toBe(401);
    }
  });

  test("open-redirect next values never leave the site after login", async ({ page, baseURL }) => {
    test.slow(); // eight real logins in a row (bcrypt cost 12 + remote DB writes)
    const evil = [
      "//evil.example",
      "https://evil.example",
      "/\\evil.example",
      "/\\/evil.example",
      "javascript:alert(1)",
      "//evil.example/%2e%2e",
      "/%0d%0aSet-Cookie:x=1",
      "https:evil.example",
    ];
    const origin = new URL(baseURL!).origin;
    for (const next of evil) {
      await page.context().clearCookies();
      await page.context().setExtraHTTPHeaders({ "x-forwarded-for": fakeIp() });
      await page.goto(`/login?next=${encodeURIComponent(next)}`);
      await expect(page.getByTestId("login-form")).toHaveAttribute("data-hydrated", "true");
      await page.locator("#password").fill(PASSWORD);
      await page.getByRole("button", { name: "Sign in" }).click();
      await page.waitForURL((u) => !u.pathname.startsWith("/login"));
      expect(new URL(page.url()).origin, next).toBe(origin);
      // A percent-encoded CRLF stays a harmless same-site path; every other value collapses to "/".
      if (!next.includes("%0d")) expect(new URL(page.url()).pathname, next).toBe("/");
    }
    // A legitimate same-site next still works.
    await page.context().clearCookies();
    await page.context().setExtraHTTPHeaders({ "x-forwarded-for": fakeIp() });
    await page.goto("/login?next=%2Fruns");
    await expect(page.getByTestId("login-form")).toHaveAttribute("data-hydrated", "true");
    await page.locator("#password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/runs$/);
  });

  test("wrong Origin on login/logout is refused", async ({ request }) => {
    for (const url of ["/api/auth/login", "/api/auth/logout"]) {
      const res = await request.post(url, {
        data: { password: "x" },
        headers: { Origin: "https://evil.example" },
      });
      expect(res.status(), url).toBe(403);
    }
  });
});

test.describe("hostile strings are stored and rendered inert", () => {
  const HOSTILE = [
    `<img src=x onerror="window.__xss=1">`,
    `"><script>window.__xss=1</script>`,
    `'); DROP TABLE "Match"; --`,
    `{{constructor.constructor('window.__xss=1')()}}`,
  ];

  async function expectInert(page: Page) {
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBe(
      undefined,
    );
    // No injected element and no executable script holding the payload (the escaped JSON in the flight
    // data is data, not code).
    const injected = await page.evaluate(
      () =>
        document.querySelectorAll("[onerror], [onload]").length +
        [...document.scripts].filter((x) => x.textContent?.trim().startsWith("window.__xss"))
          .length,
    );
    expect(injected).toBe(0);
  }

  test("team and league names on the dashboard, detail page and run error", async ({ page }) => {
    await seedBaseline();
    await seedMatches(
      HOSTILE.map((name, i) => ({
        id: `hostile-${i}`,
        home: `${name} FC`,
        away: `Away ${i}`,
        homePct: 90,
        awayPct: 3,
        inHours: 2 + i,
        league: name,
      })),
    );
    await seedRun({ status: "FAILED", error: HOSTILE[0], finishedHoursAgo: 2 });
    await page.goto("/");
    await expect(page.getByText(HOSTILE[0]!, { exact: false }).first()).toBeVisible();
    await expectInert(page);
    await page.goto("/matches/hostile-1");
    await expect(page.getByText(HOSTILE[1]!, { exact: false }).first()).toBeVisible();
    await expectInert(page);
    await page.goto("/runs");
    await expectInert(page);
  });

  test("a hostile token name is shown as text on Settings", async ({ page, baseURL }) => {
    const created = await page.request.post("/api/tokens", {
      data: { label: HOSTILE[1]!.slice(0, 40) },
      headers: { Origin: baseURL! },
    });
    expect(created.status()).toBeLessThan(300);
    await page.goto("/settings");
    await expect(page.getByText("window.__xss=1", { exact: false }).first()).toBeVisible();
    await expectInert(page);
    await resetData();
  });
});
