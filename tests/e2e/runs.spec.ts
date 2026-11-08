import { expect, test, type Page } from "@playwright/test";

// The e2e dev server always reads the isolated schema (playwright.config.ts), so seeding is safe.
test.describe.configure({ mode: "serial", timeout: 120_000 });

import { randomUUID } from "node:crypto";
import pg from "pg";
import { normalizeSsl, schemaOf } from "../../src/lib/pg-url";

async function connect() {
  const url = process.env.DIRECT_URL_TEST!;
  const client = new pg.Client({ connectionString: normalizeSsl(url) });
  await client.connect();
  await client.query(`SET search_path TO "${schemaOf(url)}"`);
  return client;
}
type Status = "RUNNING" | "SUCCESS" | "PARTIAL" | "FAILED" | "SKIPPED";

async function seed(
  rows: {
    status: Status;
    minutesAgo?: number;
    error?: string | null;
    details?: unknown;
    failedCount?: number;
  }[],
) {
  const client = await connect();
  await client.query(`DELETE FROM "ScreeningRun"`);
  const now = Date.now();
  for (const [i, r] of rows.entries()) {
    const start = new Date(now - (r.minutesAgo ?? i + 1) * 60_000);
    await client.query(
      `INSERT INTO "ScreeningRun" (id, trigger, provider, status, "startedAt", "finishedAt", scanned, qualified, "failedCount", error, details)
       VALUES ($1, $2, $3, $4, $5, $6, 12, 3, $7, $8, $9)`,
      [
        randomUUID(),
        "MANUAL",
        "official_api",
        r.status,
        start.toISOString(),
        r.status === "RUNNING" ? null : new Date(start.getTime() + 4000).toISOString(),
        r.failedCount ?? 0,
        r.error ?? null,
        r.details ? JSON.stringify(r.details) : null,
      ],
    );
  }
  await client.end();
}

async function open(page: Page, url = "/runs") {
  await page.goto(url);
  await page
    .locator("[data-testid=run-row], [data-testid=run-card], [data-testid=empty-state]")
    .first()
    .waitFor();
  await page.waitForTimeout(2500); // dev-server hydration slack
}
const isMobile = (w: number) => w < 768;

test("pagination: 45 runs give 3 pages via the URL param", async ({ page }) => {
  await seed(Array.from({ length: 45 }, () => ({ status: "SUCCESS" as const })));
  await open(page);
  const rows = page.locator("[data-testid=run-row], [data-testid=run-card]");
  await expect(rows).toHaveCount(20);
  const nav = page.getByRole("navigation", { name: "Pagination" });
  await nav.locator("a[rel=next]:visible").click();
  await expect(page).toHaveURL(/page=2/);
  await page.goto("/runs?page=3");
  await expect(rows).toHaveCount(5);
});

test("status filter and show-skipped toggle", async ({ page }) => {
  await seed([
    { status: "SUCCESS" },
    { status: "FAILED", error: "boom" },
    { status: "SKIPPED" },
    { status: "PARTIAL", failedCount: 1 },
  ]);
  await open(page);
  const rows = page.locator("[data-testid=run-row], [data-testid=run-card]");
  await expect(rows).toHaveCount(3); // SKIPPED hidden by default
  await page.getByTestId("show-skipped").click();
  await expect(page).toHaveURL(/showSkipped=1/);
  await expect(rows).toHaveCount(4);
  await page.getByTestId("status-filter").click();
  await page.getByRole("option", { name: "Failed" }).click();
  await expect(page).toHaveURL(/status=FAILED/);
  await expect(rows).toHaveCount(1);
});

test("empty state when there are no runs", async ({ page }) => {
  await seed([]);
  await open(page);
  await expect(page.getByText("No runs yet")).toBeVisible();
});

test("forced list error shows ErrorState with Retry", async ({ page }) => {
  test.skip(
    process.env.PW_PROD === "1",
    "the ?__error test hooks are compiled out of production builds (covered in dev mode)",
  );
  await page.goto("/runs?__error=list");
  await expect(page.getByTestId("error-state")).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});

test("detail dialog: Enter opens, Esc closes and focus returns; reasons and long error", async ({
  page,
}) => {
  const longError = "Provider said: " + "very-long-unbroken-error-text-".repeat(12);
  await seed([
    {
      status: "PARTIAL",
      failedCount: 2,
      error: longError,
      details: [
        { index: 3, id: "m-3", reason: "Home form is not a percentage" },
        { index: 7, id: "m-7", reason: "Kickoff has no timezone" },
      ],
    },
  ]);
  await open(page);
  const width = page.viewportSize()!.width;
  const trigger = isMobile(width)
    ? page.getByTestId("run-details-button").first()
    : page.getByTestId("run-row").first();
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByTestId("run-detail");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Home form is not a percentage")).toBeVisible();
  await expect(dialog.getByText("Kickoff has no timezone")).toBeVisible();
  if (width >= 640)
    await expect.poll(async () => Math.round((await dialog.boundingBox())!.width)).toBe(560);
  else
    expect((await dialog.boundingBox())!.height).toBeLessThanOrEqual(
      page.viewportSize()!.height * 0.85 + 1,
    );
  // long error wraps: no horizontal overflow inside the dialog
  const overflow = await dialog.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("layout: row 56 / header 44 at 1280; cards only on mobile with Details >= 44", async ({
  page,
}) => {
  await seed([{ status: "SUCCESS" }, { status: "FAILED", error: "x", failedCount: 1 }]);
  await open(page);
  const width = page.viewportSize()!.width;
  if (isMobile(width)) {
    await expect(page.locator("table")).toHaveCount(0);
    for (const b of await page.getByTestId("run-details-button").all()) {
      const bb = (await b.boundingBox())!;
      expect(bb.width).toBeGreaterThanOrEqual(44);
      expect(bb.height).toBeGreaterThanOrEqual(44);
    }
  } else {
    const row = (await page.getByTestId("run-row").first().boundingBox())!;
    expect(Math.abs(row.height - 56)).toBeLessThanOrEqual(1);
    const head = (await page.locator("thead tr").boundingBox())!;
    expect(Math.abs(head.height - 44)).toBeLessThanOrEqual(1);
    const align = await page
      .locator("tbody tr")
      .first()
      .locator("td")
      .nth(4)
      .evaluate((el) => getComputedStyle(el).textAlign);
    expect(align).toBe("right");
  }
});

test("RUNNING row updates to SUCCESS without reload and polling stops", async ({ page }) => {
  await seed([{ status: "RUNNING", minutesAgo: 1 }]);
  const polls: string[] = [];
  page.on("request", (r) => {
    if (/\/api\/runs\/[^/?]+$/.test(new URL(r.url()).pathname)) polls.push(r.url());
  });
  await open(page);
  await expect(page.getByTestId("status-chip").first()).toHaveAttribute("data-status", "RUNNING");
  const client = await connect();
  await client.query(
    `UPDATE "ScreeningRun" SET status = $1, "finishedAt" = now(), scanned = 9 WHERE status = $2`,
    ["SUCCESS", "RUNNING"],
  );
  await client.end();
  await expect(page.getByTestId("status-chip").first()).toHaveAttribute("data-status", "SUCCESS", {
    timeout: 12_000,
  });
  await page.waitForTimeout(500);
  const after = polls.length;
  expect(after).toBeGreaterThan(0);
  await page.waitForTimeout(7000);
  expect(polls.length).toBe(after);
});

test("outcome strip and status rail reflect run statuses", async ({ page }) => {
  await seed([{ status: "SUCCESS" }, { status: "FAILED", error: "x", failedCount: 1 }]);
  await open(page);
  await expect(page.getByTestId("runs-outcomes")).toContainText("1 of 2 recent runs");
  await expect(
    page.locator("[data-testid=run-row], [data-testid=run-card]").first(),
  ).toHaveAttribute("data-status", "SUCCESS");
});
