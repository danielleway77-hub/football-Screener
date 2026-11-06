import { existsSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { resetData, seedMatches } from "./helpers/dashboard-db";
import {
  qualifiesById,
  readSettingsRow,
  resetSettingsState,
  restoreSession,
} from "./helpers/settings-db";

// Step 13.1 (docs/TEST_CATALOG.md §13.1). All specs share ONE isolated schema: run with --workers=1.
// Every test starts from default settings and puts them back, because the dashboard specs read them too.
if (existsSync(".env.test.local")) process.loadEnvFile(".env.test.local");
const PASSWORD = process.env.E2E_PASSWORD ?? "";
test.setTimeout(90_000);

const lowInput = (page: Page) => page.getByLabel("Poor form below");
const highInput = (page: Page) => page.getByLabel("Strong form above");
const saveBar = (page: Page) => page.getByTestId("save-bar");

async function openSettings(page: Page, url = "/settings") {
  await page.goto(url);
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  await expect(page.getByTestId("settings-view")).toHaveAttribute("data-hydrated", "true");
}

async function makeDirty(page: Page) {
  await lowInput(page).fill("30");
  await lowInput(page).blur();
  await expect(saveBar(page)).toBeVisible();
}

/** Presses Tab until `target` has focus (fails after `max` presses): proves keyboard reachability. */
async function tabTo(page: Page, target: Locator, max = 40) {
  for (let i = 0; i < max; i++) {
    if (await target.evaluate((el) => el === document.activeElement).catch(() => false)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error("Could not reach the element with the keyboard");
}

test.beforeEach(async () => {
  await resetSettingsState();
  await resetData();
});
test.afterEach(async () => {
  await resetSettingsState();
});

test("frame: section nav is 220px wide and the cards are at most 720px wide at 1280", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "measured at 1280");
  await openSettings(page);
  const nav = await page.getByTestId("section-nav").boundingBox();
  expect(Math.round(nav!.width)).toBe(220);
  expect(Math.round(nav!.y)).toBeGreaterThanOrEqual(0);
  const card = await page.locator("#screening > div").boundingBox();
  expect(card!.width).toBeLessThanOrEqual(720);
  expect(card!.width).toBeGreaterThan(600);
});

test("dual slider keeps low < high; numeric inputs inputmode numeric", async ({ page }) => {
  await openSettings(page);
  for (const input of [
    lowInput(page),
    highInput(page),
    page.getByLabel("Mark data as stale after"),
  ]) {
    await expect(input).toHaveAttribute("inputmode", "numeric");
    expect((await input.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await expect(page.getByTestId("threshold-sentence")).toHaveText(
    "Qualifies when one team is above 75% and the other is below 35%.",
  );

  // Typing a low value above high is clamped to high - 1 when the field loses focus.
  await lowInput(page).fill("90");
  await lowInput(page).blur();
  await expect(lowInput(page)).toHaveValue("74");
  // ... and a high value below low is clamped to low + 1.
  await highInput(page).fill("10");
  await highInput(page).blur();
  await expect(highInput(page)).toHaveValue("75");
  await highInput(page).fill("50");
  await highInput(page).blur();
  await expect(highInput(page)).toHaveValue("75");

  // Arrow keys on the field step by one but never cross.
  await lowInput(page).fill("40");
  await lowInput(page).press("ArrowUp");
  await expect(lowInput(page)).toHaveValue("41");

  // The slider thumbs cannot cross: with low at 74 and high at 75, ArrowRight on the low thumb stays at 74.
  await lowInput(page).fill("74");
  await lowInput(page).blur();
  const lowThumb = page.getByRole("slider", { name: "Poor form threshold" });
  const highThumb = page.getByRole("slider", { name: "Strong form threshold" });
  await lowThumb.focus();
  await page.keyboard.press("ArrowRight");
  await expect(lowThumb).toHaveAttribute("aria-valuenow", "74");
  await expect(highThumb).toHaveAttribute("aria-valuenow", "75");
  // Home moves the lower thumb to 0 and End the upper thumb to 100; the order is always kept.
  await page.keyboard.press("Home");
  await expect(lowInput(page)).toHaveValue("0");
  await page.keyboard.press("End");
  await expect(highInput(page)).toHaveValue("100");
  await expect(page.getByTestId("threshold-sentence")).toHaveText(
    "Qualifies when one team is above 100% and the other is below 0%.",
  );
  expect(Number(await lowThumb.getAttribute("aria-valuenow"))).toBeLessThan(
    Number(await highThumb.getAttribute("aria-valuenow")),
  );
});

test("low >= high is blocked with a message and nothing is saved", async ({ page }) => {
  await openSettings(page);
  await lowInput(page).fill("80"); // still typing: shows the error without clamping
  await expect(
    page.getByText("The lower threshold must be below the upper threshold."),
  ).toBeVisible();
  await expect(lowInput(page)).toHaveAttribute("aria-invalid", "true");
  // Enter submits without blurring first (a blur would clamp the value back into range).
  await lowInput(page).press("Enter");
  await expect(page.getByText("Fix 1 field to save.")).toBeVisible();
  expect((await readSettingsRow()).lowThreshold).toBe(35);
});

test("save at 70/40 re-screens the stored matches, says how many changed and the dashboard follows", async ({
  page,
}) => {
  await seedMatches([
    {
      id: "edge",
      home: "Edge Home",
      away: "Edge Away",
      homePct: 72,
      awayPct: 38,
      inHours: 30,
      qualifies: false,
    },
  ]);
  await openSettings(page);
  await lowInput(page).fill("40");
  await lowInput(page).blur();
  await highInput(page).fill("70");
  await highInput(page).blur();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Settings saved.").first()).toBeVisible();
  const result = page.getByTestId("save-rescreen-result");
  await expect(result).toContainText("1 changed");
  await expect(result).toContainText("1 now qualify");
  await expect(saveBar(page)).toHaveCount(0);
  expect(await qualifiesById()).toEqual({ edge: true });
  expect(await readSettingsRow()).toMatchObject({ highThreshold: 70, lowThreshold: 40 });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Edge Home" })).toBeVisible();
});

test("a changed window and stale-after value are saved without touching stored matches", async ({
  page,
}) => {
  await seedMatches([
    { id: "keep", home: "Keep Home", away: "Keep Away", homePct: 90, awayPct: 5, inHours: 30 },
  ]);
  await openSettings(page);
  await page.getByRole("radio", { name: "Tomorrow only" }).click();
  await page.getByLabel("Mark data as stale after").fill("12");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Settings saved.").first()).toBeVisible();
  expect(await readSettingsRow()).toMatchObject({ windowDays: 1, staleAfterHrs: 12 });
  expect(await qualifiesById()).toEqual({ keep: true });
  await expect(page.getByTestId("save-rescreen-result")).toHaveCount(0);
});

test("sticky save bar at 390 is fixed to the bottom with safe-area padding and every input is 44px tall", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "phone layout");
  await openSettings(page);
  await expect(saveBar(page)).toHaveCount(0);
  await makeDirty(page);
  const info = await saveBar(page).evaluate((el) => {
    const css = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    return {
      position: css.position,
      cssBottom: css.bottom,
      bottom: Math.round(box.bottom),
      viewport: window.innerHeight,
      left: Math.round(box.left),
      width: Math.round(box.width),
      paddingBottom: parseFloat(css.paddingBottom),
    };
  });
  expect(info.position).toBe("fixed");
  expect(info.cssBottom).toBe("0px");
  expect(Math.abs(info.bottom - info.viewport)).toBeLessThanOrEqual(8);
  expect(info.left).toBe(0);
  expect(info.width).toBe(390);
  expect(info.paddingBottom).toBeGreaterThanOrEqual(12); // 12px + env(safe-area-inset-bottom)

  // Nothing is hidden behind the bar: the last card ends above it once scrolled to the end.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const last = await page.locator("#maintenance > div").boundingBox();
  const bar = await saveBar(page).boundingBox();
  expect(last!.y + last!.height).toBeLessThanOrEqual(bar!.y + 1);

  const heights = await page
    .locator('#settings-view, [data-testid="settings-view"]')
    .locator("input:not([type=radio]):visible")
    .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().height)));
  expect(heights.length).toBeGreaterThan(5);
  for (const h of heights) expect(h).toBeGreaterThanOrEqual(44);
});

test("keyboard-only completion: change the rule, scope, timezone and save with Enter", async ({
  page,
}) => {
  await openSettings(page);
  await tabTo(page, lowInput(page));
  await page.keyboard.type("40");
  await page.keyboard.press("Tab");
  await expect(highInput(page)).toBeFocused();
  await page.keyboard.type("70");
  await page.keyboard.press("Tab");
  // Window segmented control: arrow keys move and select.
  await tabTo(page, page.getByRole("radio", { name: "Tomorrow + day after" }));
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("radio", { name: "Tomorrow only" })).toBeChecked();
  // Form scope radio cards: arrow keys select.
  await tabTo(page, page.getByRole("radio", { name: /League form/ }));
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("radio", { name: /Overall form/ })).toBeChecked();
  // Timezone combobox: type to filter, arrows + Enter pick.
  await tabTo(page, page.getByRole("combobox", { name: "Timezone" }));
  await page.keyboard.type("Paris");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("combobox", { name: "Timezone" })).toHaveValue(/Europe\/Paris/);
  // Reach Save through the keyboard and activate it.
  await tabTo(page, page.getByRole("button", { name: "Save changes" }), 60);
  await page.keyboard.press("Enter");
  await expect(page.getByText("Settings saved.").first()).toBeVisible();
  expect(await readSettingsRow()).toMatchObject({
    highThreshold: 70,
    lowThreshold: 40,
    windowDays: 1,
    timezone: "Europe/Paris",
  });
});

test("offline disables Save with a visible reason and loses nothing", async ({ page }) => {
  await openSettings(page);
  await makeDirty(page);
  await page.context().setOffline(true);
  await expect(page.getByText("You're offline. Reconnect to save.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save changes" })).toBeDisabled();
  await page.context().setOffline(false);
  await expect(page.getByRole("button", { name: "Save changes" })).toBeEnabled();
  await expect(lowInput(page)).toHaveValue("30");
});

test("section nav highlights the current section on scroll at 1280 and jumps on click", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop",
    "section nav is >= 1024px; measured at 1280 (at 1920 the page is too short to scroll Security to the top)",
  );
  await openSettings(page);
  const link = (name: string) => page.getByTestId("section-nav").getByRole("link", { name });
  await expect(link("Screening")).toHaveAttribute("aria-current", "location");
  await page.evaluate(() => {
    const el = document.getElementById("security")!;
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 110);
  });
  await expect(link("Security")).toHaveAttribute("aria-current", "location");
  await expect(link("Screening")).not.toHaveAttribute("aria-current", "location");
  await link("Ingest tokens").click();
  await expect(link("Ingest tokens")).toHaveAttribute("aria-current", "location");
  await expect(page).toHaveURL(/#tokens$/);
  const top = await page.locator("#tokens").evaluate((el) => el.getBoundingClientRect().top);
  expect(top).toBeLessThan(200);
});

test("tokens: the plaintext is shown once in the modal, never listed; revoke is confirmed", async ({
  page,
  request,
}) => {
  await openSettings(page);
  await expect(page.getByText("No tokens yet")).toBeVisible();
  await page.getByRole("button", { name: "Create token" }).first().click();
  await page.getByLabel("Label").fill("Home laptop");
  await page.getByRole("button", { name: "Create token" }).last().click();

  const plaintext = page.getByTestId("token-plaintext");
  await expect(plaintext).toBeVisible();
  const token = (await plaintext.textContent())!.trim();
  expect(token).toMatch(/^scr_/);
  await expect(page.getByText("Copy it now — you won't see it again.")).toBeVisible();
  const done = page.getByRole("button", { name: "Done" });
  await expect(done).toBeDisabled();
  await expect(done).toBeEnabled({ timeout: 8_000 }); // copied or after 3 s
  await done.click();
  await expect(plaintext).toHaveCount(0);

  // The token is nowhere in the page any more, also not after a reload.
  expect(await page.content()).not.toContain(token);
  await page.reload();
  await expect(page.getByTestId("settings-view")).toHaveAttribute("data-hydrated", "true");
  expect(await page.content()).not.toContain(token);
  const row = page.getByTestId("token-row");
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("Home laptop");
  await expect(row).toContainText("ACTIVE");
  await expect(row).toContainText("Last used never");

  const call = () =>
    request.post("/api/ingest", {
      headers: { authorization: `Bearer ${token}` },
      data: { matches: [] },
    });
  expect((await call()).status()).not.toBe(401); // valid token: reaches validation (422)

  await row.getByRole("button", { name: "Revoke Home laptop" }).click();
  await expect(page.getByRole("dialog")).toContainText('Revoke "Home laptop"?');
  await page.getByRole("button", { name: "Revoke", exact: true }).last().click();
  await expect(row).toContainText("REVOKED");
  expect((await call()).status()).toBe(401);
});

test("tokens: at most five active tokens", async ({ page }) => {
  await openSettings(page);
  for (let i = 1; i <= 5; i++) {
    await page.getByRole("button", { name: "Create token" }).first().click();
    await page.getByLabel("Label").fill(`Token ${i}`);
    await page.getByRole("button", { name: "Create token" }).last().click();
    await expect(page.getByTestId("token-plaintext")).toBeVisible();
    await expect(page.getByRole("button", { name: "Done" })).toBeEnabled({ timeout: 8_000 });
    await page.getByRole("button", { name: "Done" }).click();
  }
  await expect(page.getByRole("button", { name: "Create token" })).toBeDisabled();
  await expect(
    page.getByText("You have 5 active tokens. Revoke one to create another."),
  ).toBeVisible();
});

test("password: wrong current is a field error; a change keeps this session and signs another out", async ({
  page,
  browser,
}) => {
  test.skip(!PASSWORD, "E2E_PASSWORD is not set");
  const before = (await readSettingsRow()).sessionVersion;
  const second = await browser.newContext({ storageState: "tests/e2e/.auth/owner.json" });
  try {
    await openSettings(page, "/settings#security");
    const fill = async (current: string, next: string, confirm: string) => {
      await page.getByLabel("Current password").fill(current);
      await page.getByLabel("New password", { exact: true }).fill(next);
      await page.getByLabel("Confirm new password").fill(confirm);
      await page.getByRole("button", { name: "Update password" }).click();
    };

    await fill("not-the-password", "a-brand-new-pass-1", "a-brand-new-pass-1");
    await expect(page.getByText("The current password is not correct.")).toBeVisible();
    await fill(PASSWORD, "a-brand-new-pass-1", "something-else-entirely");
    await expect(page.getByText("The two passwords do not match.")).toBeVisible();
    await page.getByLabel("Confirm new password").fill("a-brand-new-pass-1");
    await page.getByLabel("New password", { exact: true }).fill("short");
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(page.getByText("Use at least 10 characters.")).toBeVisible();

    await fill(PASSWORD, "a-brand-new-pass-1", "a-brand-new-pass-1");
    await expect(page.getByText("Password updated. Other devices were signed out.")).toBeVisible();
    expect((await readSettingsRow()).sessionVersion).toBe(before + 1);

    // This browser stays signed in (the cookie was re-issued) ...
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
    // ... the other one is signed out.
    const other = await second.newPage();
    await other.goto("/settings");
    await expect(other).toHaveURL(/\/login/);
  } finally {
    await second.close();
    await restoreSession(before);
  }
});

test("unsaved changes: leaving through a link asks first and can be cancelled", async ({
  page,
}, testInfo) => {
  await openSettings(page);
  await makeDirty(page);
  const goRuns = async () => {
    if (testInfo.project.name === "mobile") {
      const menu = page.getByRole("button", { name: "Open menu" });
      if (await menu.isVisible()) await menu.click(); // the sheet may still be open after "Keep editing"
      await page.getByRole("dialog").getByRole("link", { name: "Runs" }).click();
    } else {
      await page
        .getByRole("navigation", { name: "Main" })
        .getByRole("link", { name: "Runs" })
        .click();
    }
  };
  await goRuns();
  const dialog = page.getByRole("alertdialog").or(page.getByRole("dialog")).last();
  await expect(dialog).toContainText("Leave without saving?");
  await page.getByRole("button", { name: "Keep editing" }).click();
  await expect(page).toHaveURL(/\/settings/);
  await expect(lowInput(page)).toHaveValue("30");
  await goRuns();
  await page.getByRole("button", { name: "Leave", exact: true }).click();
  await expect(page).toHaveURL(/\/runs/);
});

test("discard restores the saved values and hides the bar", async ({ page }) => {
  await openSettings(page);
  await makeDirty(page);
  await page.getByRole("button", { name: "Discard" }).click();
  await expect(lowInput(page)).toHaveValue("35");
  await expect(saveBar(page)).toHaveCount(0);
});

test("re-screen from Maintenance asks for confirmation and reports the counts", async ({
  page,
}) => {
  await seedMatches([
    { id: "m1", home: "A Home", away: "A Away", homePct: 90, awayPct: 5, inHours: 30 },
    {
      id: "m2",
      home: "B Home",
      away: "B Away",
      homePct: 50,
      awayPct: 50,
      inHours: 31,
      qualifies: true,
    },
  ]);
  await openSettings(page);
  await page.getByRole("button", { name: "Re-screen stored matches" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Re-screen 2 stored matches with 75% / 35%?",
  );
  await page.getByRole("button", { name: "Re-screen", exact: true }).click();
  const result = page.getByTestId("rescreen-result");
  await expect(result).toContainText("1 changed");
  await expect(result).toContainText("1 now qualify");
  expect(await qualifiesById()).toEqual({ m1: true, m2: false });
});

test("no serious accessibility violations on the settings page", async ({ page }) => {
  await openSettings(page);
  const results = await new AxeBuilder({ page }).analyze();
  const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${v.id}: ${v.nodes[0]?.html.slice(0, 120)}`)).toEqual([]);
});
