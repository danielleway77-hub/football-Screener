import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { resetData } from "./helpers/dashboard-db";
import { countRuns, resetSettingsState } from "./helpers/settings-db";

// Step 13.2 (docs/TEST_CATALOG.md §13.2 and the smart-paste addendum). One shared isolated schema:
// run with --workers=1. Every test starts without stored matches and with default settings.
test.setTimeout(90_000);

const HOUR = 3_600_000;
const futureIso = (hours = 30) =>
  new Date(Date.now() + hours * HOUR).toISOString().replace(/\.\d+Z$/, "Z");
const futureLocal = (hours = 30) => futureIso(hours).slice(0, 16);

const match = (id: string, home: string, away: string, homeForm: unknown, awayForm: unknown) => ({
  provider: "manual",
  providerMatchId: id,
  kickoffAt: futureIso(),
  home: { name: home, formPct: homeForm },
  away: { name: away, formPct: awayForm },
  formScope: "league",
});

const goldenText = () => readFileSync("tests/fixtures/predigoal-text/golden.txt", "utf8");
const golden = () => goldenText().replace("2026-11-08T19:00:00Z", futureIso());
const goldenNoKickoff = () => goldenText().replace(/2026-11-08T19:00:00Z\r?\n/, "");

const rows = (page: Page) =>
  page.locator('[data-testid="preview-row"]:visible, [data-testid="preview-card"]:visible');

async function openImport(page: Page) {
  await page.goto("/import");
  await expect(page.getByRole("heading", { level: 1, name: "Update your matches" })).toBeVisible();
  await expect(page.getByTestId("import-view")).toHaveAttribute("data-hydrated", "true");
}
const pasteData = (page: Page, text: string) => page.getByLabel("or paste data").fill(text);
const importButton = (page: Page) => page.getByRole("button", { name: /^Import \d+ matches$/ });

test.beforeEach(async () => {
  await resetSettingsState();
  await resetData();
});
test.afterEach(async () => {
  await resetData();
});

test("frame: header, tabs (the active mode is recommended), drop zone at least 160px tall", async ({
  page,
}) => {
  await openImport(page);
  await expect(page.getByText("DATA INTAKE")).toBeVisible();
  const tabs = page.getByRole("tab");
  await expect(tabs).toHaveCount(2);
  await expect(page.getByRole("tab", { name: /Paste \/ upload/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("tab", { name: /Paste \/ upload/ })).toContainText("Recommended");
  expect((await tabs.first().boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect((await page.getByTestId("drop-zone").boundingBox())!.height).toBeGreaterThanOrEqual(160);
  await expect(importButton(page)).toBeDisabled(); // nothing valid yet
  // "Choose file" is reachable with the keyboard.
  await page.getByRole("button", { name: "Choose file" }).focus();
  await expect(page.getByRole("button", { name: "Choose file" })).toBeFocused();
});

test("paste sample -> preview -> submit -> the dashboard shows the golden match", async ({
  page,
}) => {
  await openImport(page);
  await page.getByRole("button", { name: "Use sample JSON" }).click();
  await expect(page.getByTestId("preview-counts")).toContainText("Valid 2");
  await expect(page.getByTestId("preview-counts")).toContainText("Invalid 0");
  await expect(page.getByTestId("preview-counts")).toContainText("Qualifying 1");
  await expect(rows(page)).toHaveCount(2);
  await expect(page.locator('[data-testid="qualifies-chip"]:visible')).toHaveCount(1);
  await expect(importButton(page)).toHaveText("Import 2 matches");

  const responsePromise = page.waitForResponse((r) => r.url().endsWith("/api/import"));
  await importButton(page).click();
  const api = (await (await responsePromise).json()) as {
    scanned: number;
    qualified: number;
    failed: number;
  };
  const card = page.getByTestId("import-result");
  await expect(card).toBeVisible();
  // The card shows exactly what the API answered.
  await expect(page.getByTestId("result-imported")).toHaveText(String(api.scanned - api.failed));
  await expect(page.getByTestId("result-qualified")).toHaveText(String(api.qualified));
  await expect(card).toContainText("Imported 2 matches · 1 qualify.");

  await card.getByRole("link", { name: "View dashboard" }).click();
  await expect(page.getByRole("heading", { name: "Sporting Cristal" })).toBeVisible();
  await expect(page.getByText("Atletico Madrid")).toHaveCount(0); // 44/56 does not qualify
});

test("bad rows: precise reasons, invalid rows come first, valid rows stay importable", async ({
  page,
}) => {
  await openImport(page);
  const items = [
    match("ok-1", "Valid One", "Valid Away", 80, 7),
    match("bad-1", "Broken Home", "Broken Away", "0.8", 7),
    { ...match("bad-2", "Naive Home", "Naive Away", 80, 7), kickoffAt: "2026-11-08 19:00" },
    { ...match("bad-3", "Scope Home", "Scope Away", 80, 7), formScope: "overall" },
  ];
  await pasteData(page, JSON.stringify({ matches: items }));
  await expect(page.getByTestId("preview-counts")).toContainText("Valid 1");
  await expect(page.getByTestId("preview-counts")).toContainText("Invalid 3");
  const list = rows(page);
  await expect(list).toHaveCount(4);
  // Invalid rows are listed before the valid one.
  const flags = await list.evaluateAll((els) => els.map((el) => el.getAttribute("data-valid")));
  expect(flags).toEqual(["false", "false", "false", "true"]);
  const text = (await list.allTextContents()).join(" | ");
  expect(text).toContain("is ambiguous");
  expect(text).toContain("kickoff has no timezone");
  expect(text).toContain("form scope mismatch: expected league");
  expect(text).toContain("Item 2");

  await importButton(page).click();
  await expect(page.getByTestId("import-result")).toContainText(
    "1 imported, 3 skipped. See reasons below.",
  );
  await expect(page.getByTestId("result-reasons")).toContainText("Item 2");
  await expect(page.getByTestId("result-reasons")).toContainText("ambiguous");
});

test("malformed JSON and missing CSV columns are explained; nothing can be submitted", async ({
  page,
}) => {
  await openImport(page);
  await pasteData(page, '{"matches": [');
  await expect(page.getByTestId("parse-error")).toContainText("isn't valid JSON");
  await expect(importButton(page)).toBeDisabled();
  await pasteData(page, "home,away\nA,B");
  await expect(page.getByTestId("parse-error")).toContainText(
    "Missing columns: homeForm, awayForm, kickoff",
  );
  await expect(importButton(page)).toBeDisabled();
});

test("a 2 MB file is rejected with a friendly message and nothing is parsed", async ({ page }) => {
  await openImport(page);
  await page.locator('input[type="file"]').setInputFiles({
    name: "big.json",
    mimeType: "application/json",
    buffer: Buffer.alloc(2 * 1024 * 1024, "a"),
  });
  await expect(page.getByTestId("input-error")).toHaveText("That file is too large (max 1 MB).");
  await expect(page.getByTestId("preview")).toHaveCount(0);
  await expect(importButton(page)).toBeDisabled();
});

test("a CSV file with BOM, semicolons and comma decimals is read and imported", async ({
  page,
}) => {
  await openImport(page);
  const csv = `﻿kickoff;home;away;homeForm;awayForm;formScope\r\n${futureIso()};Semi Home;Semi Away;"80,5%";7 %;league\r\n`;
  await page.locator('input[type="file"]').setInputFiles({
    name: "matches.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv, "utf8"),
  });
  await expect(page.getByTestId("preview-counts")).toContainText("Valid 1");
  await expect(page.getByTestId("preview-counts")).toContainText("Qualifying 1");
  await expect(rows(page).first()).toContainText("80.5 / 7");
  await importButton(page).click();
  await expect(page.getByTestId("import-result")).toContainText("Imported 1 matches · 1 qualify.");
});

test("double submit creates one run", async ({ page }) => {
  await openImport(page);
  let posts = 0;
  await page.route("**/api/import", async (route) => {
    posts += 1;
    await new Promise((r) => setTimeout(r, 600));
    await route.continue();
  });
  await pasteData(page, JSON.stringify([match("dbl", "Double Home", "Double Away", 80, 7)]));
  await expect(importButton(page)).toBeEnabled();
  await importButton(page).dblclick();
  await expect(page.getByTestId("import-result")).toBeVisible();
  expect(posts).toBe(1);
  expect(await countRuns("IMPORT")).toBe(1);
});

test("table becomes cards on a phone and nothing scrolls sideways", async ({ page }, testInfo) => {
  await openImport(page);
  await page.getByRole("button", { name: "Use sample JSON" }).click();
  await expect(page.getByTestId("preview")).toBeVisible();
  const phone = testInfo.project.name === "mobile";
  await expect(page.getByTestId("preview-table")).toBeVisible({ visible: !phone });
  await expect(page.getByTestId("preview-cards")).toBeVisible({ visible: phone });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  if (phone) {
    const box = await importButton(page).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
});

test("offline disables the import button with a visible reason", async ({ page }) => {
  await openImport(page);
  await pasteData(page, JSON.stringify([match("off", "Off Home", "Off Away", 80, 7)]));
  await expect(importButton(page)).toBeEnabled();
  await page.context().setOffline(true);
  await expect(page.getByText("You're offline. Reconnect to import.")).toBeVisible();
  await expect(importButton(page)).toBeDisabled();
  await page.context().setOffline(false);
  await expect(importButton(page)).toBeEnabled();
});

test("assisted helper tab: honest note, form-scope reminder and the update status line", async ({
  page,
}) => {
  await openImport(page);
  await page.getByRole("tab", { name: /Assisted helper/ }).click();
  await expect(page.getByText("The one-click helper is not available yet.")).toBeVisible();
  await expect(page.getByTestId("scope-reminder")).toContainText("League form");
  await expect(page.getByTestId("last-ingest")).toHaveText("No updates received yet.");
});

test.describe("smart paste (page text)", () => {
  async function openText(page: Page) {
    await openImport(page);
    await page.getByRole("radio", { name: "Page text" }).click();
    await expect(page.getByLabel("Paste text from a match page")).toBeVisible();
  }
  const pastePage = (page: Page, text: string) =>
    page.getByLabel("Paste text from a match page").fill(text);

  test("the note says you still open the matches yourself", async ({ page }) => {
    await openText(page);
    await expect(page.getByText(/you still open the matches yourself/)).toBeVisible();
  });

  test("paste the golden text -> preview shows 80/7 qualifies -> import -> dashboard shows it", async ({
    page,
  }) => {
    await openText(page);
    await pastePage(page, golden());
    const first = page.getByTestId("text-match").first();
    await expect(first.getByLabel("Home team")).toHaveValue("Sporting Cristal");
    await expect(first.getByLabel("Home form %")).toHaveValue("80");
    await expect(first.getByLabel("Away form %")).toHaveValue("7");
    await expect(first).toContainText("Home 76% · Draw 16% · Away 8%");
    await expect(first).toContainText("Predicted 3 – 1");
    await expect(first.getByTestId("qualifies-chip")).toBeVisible();
    await expect(page.getByTestId("preview-counts")).toContainText("Qualifying 1");
    await importButton(page).click();
    await expect(page.getByTestId("import-result")).toContainText(
      "Imported 1 matches · 1 qualify.",
    );
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Sporting Cristal" })).toBeVisible();
  });

  test("inline correction of a parsed value is reflected in the import", async ({ page }) => {
    await openText(page);
    const text = readFileSync("tests/fixtures/predigoal-text/atletico.txt", "utf8").replace(
      "Atlético Madrid vs Bayern München",
      `Atlético Madrid vs Bayern München\n${futureIso()}`,
    );
    await pastePage(page, text);
    const first = page.getByTestId("text-match").first();
    await expect(first.getByLabel("Home form %")).toHaveValue("44");
    await expect(page.getByTestId("preview-counts")).toContainText("Qualifying 0");
    await first.getByLabel("Home form %").fill("90");
    await first.getByLabel("Away form %").fill("10");
    await expect(page.getByTestId("preview-counts")).toContainText("Qualifying 1");
    await importButton(page).click();
    await expect(page.getByTestId("import-result")).toContainText(
      "Imported 1 matches · 1 qualify.",
    );
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Atlético Madrid" })).toBeVisible();
  });

  test("a missing form % is shown as Unavailable and blocks the import until typed", async ({
    page,
  }) => {
    await openText(page);
    await pastePage(page, golden().replace("FC CAJAMARCA 7%", "FC CAJAMARCA"));
    const first = page.getByTestId("text-match").first();
    await expect(first.getByLabel("Away form %")).toHaveValue("");
    await expect(first.getByLabel("Away form %")).toHaveAttribute("placeholder", "Unavailable");
    await expect(first).toContainText("Form % is unavailable. Type it in to import.");
    await expect(importButton(page)).toBeDisabled();
    await expect(page.getByTestId("parse-problems")).toContainText(
      "could not find away team's form %",
    );
    await first.getByLabel("Away form %").fill("7");
    await expect(importButton(page)).toBeEnabled();
  });

  test("the kickoff date picker is required when the text has none", async ({ page }) => {
    await openText(page);
    await pastePage(page, goldenNoKickoff());
    const first = page.getByTestId("text-match").first();
    await expect(first).toContainText("Pick the kickoff time.");
    await expect(importButton(page)).toBeDisabled();
    await first.getByLabel(/Kickoff/).fill(futureLocal());
    await expect(importButton(page)).toBeEnabled();
    await importButton(page).click();
    await expect(page.getByTestId("import-result")).toContainText(
      "Imported 1 matches · 1 qualify.",
    );
  });

  test("several matches pasted back to back are listed separately", async ({ page }) => {
    await openText(page);
    const second = readFileSync("tests/fixtures/predigoal-text/atletico.txt", "utf8").replace(
      "Atlético Madrid vs Bayern München",
      `Atlético Madrid vs Bayern München\n${futureIso(40)}`,
    );
    await pastePage(page, `${golden()}\n\n${second}`);
    await expect(page.getByTestId("text-match")).toHaveCount(2);
    await expect(page.getByTestId("preview-counts")).toContainText("Valid 2");
  });
});

test("no serious accessibility violations on the import page", async ({ page }) => {
  await openImport(page);
  await page.getByRole("button", { name: "Use sample JSON" }).click();
  await expect(page.getByTestId("preview")).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${v.id}: ${v.nodes[0]?.html.slice(0, 120)}`)).toEqual([]);
});
