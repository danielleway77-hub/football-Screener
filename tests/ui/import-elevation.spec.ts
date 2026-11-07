import { expect, test, type Page } from "@playwright/test";
import { resetData } from "../e2e/helpers/dashboard-db";
import { resetSettingsState } from "../e2e/helpers/settings-db";

// UI elevation of the Import screen: stepper, drop-zone states, sticky action bar, touch targets, CLS.
// Screenshots (SHOTS=1) go to docs/screenshots/ui-import. Run with --workers=1 (shared schema).
test.setTimeout(90_000);

const SHOTS = process.env.SHOTS === "1";
const WIDTHS = [
  [360, 780],
  [768, 1024],
  [1280, 800],
  [1920, 1080],
] as const;
const shot = (page: Page, name: string, w: number) =>
  SHOTS
    ? page.screenshot({ path: `docs/screenshots/ui-import/${name}-${w}.png`, fullPage: true })
    : Promise.resolve(null);

const future = () => new Date(Date.now() + 30 * 3_600_000).toISOString().replace(/\.\d+Z$/, "Z");
const item = (id: string, form: unknown, extra: object = {}) => ({
  provider: "manual",
  providerMatchId: id,
  kickoffAt: future(),
  home: { name: `Home ${id}`, formPct: form },
  away: { name: `Away ${id}`, formPct: 7 },
  formScope: "league",
  ...extra,
});

async function open(page: Page) {
  await page.goto("/import");
  await expect(page.getByTestId("import-view")).toHaveAttribute("data-hydrated", "true");
}

test.beforeEach(async () => {
  await resetSettingsState();
  await resetData();
});
test.afterEach(async () => {
  await resetData();
});

test("stepper follows the flow and every control is a 44px target", async ({ page }) => {
  await open(page);
  const stepper = page.getByTestId("import-stepper");
  await expect(stepper).toHaveAttribute("data-step", "0");
  await expect(stepper.locator('[aria-current="step"]')).toContainText("Choose");

  await page.getByLabel("or paste data").fill(JSON.stringify([item("a", 80), item("b", "0.8")]));
  await expect(stepper).toHaveAttribute("data-step", "2");
  await expect(page.getByTestId("action-summary")).toContainText("1 ready to import");
  await expect(page.getByTestId("action-summary")).toContainText("1 need fixing");
  await expect(page.getByTestId("paste-size")).toBeVisible();

  for (const name of [
    "Clear",
    /^Import \d+ matches$/,
    "Replace file",
    "Choose file",
    "JSON",
    "CSV",
  ]) {
    const el = page.getByRole("button", { name, exact: typeof name === "string" }).first();
    if (await el.count()) expect((await el.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole("button", { name: /^Import \d+ matches$/ }).click();
  await expect(page.getByTestId("import-result")).toBeVisible();
  await expect(stepper).toHaveAttribute("data-step", "3");
  await expect(page.getByTestId("import-result")).toHaveAttribute("data-tone", "warning");
});

test("file upload shows the loaded-file chip and replaces it on clear", async ({ page }) => {
  await open(page);
  await page.locator('input[type="file"]').setInputFiles({
    name: "round-12.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify([item("f", 80)])),
  });
  await expect(page.getByTestId("loaded-file")).toHaveText("round-12.json");
  await expect(page.getByTestId("drop-zone")).toHaveAttribute("data-state", "loaded");
  await page.getByRole("button", { name: "Clear" }).click();
  await expect(page.getByTestId("drop-zone")).toHaveAttribute("data-state", "idle");
});

test("layout is stable (CLS) on first paint", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { cls: number }).cls = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[])
        if (!e.hadRecentInput) (window as unknown as { cls: number }).cls += e.value;
    }).observe({ type: "layout-shift", buffered: true });
  });
  await open(page);
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => (window as unknown as { cls: number }).cls)).toBeLessThan(0.01);
});

test("screens: empty, preview with errors, result", async ({ page }) => {
  test.skip(!SHOTS, "set SHOTS=1 to capture screenshots");
  for (const [w, h] of WIDTHS) {
    await page.setViewportSize({ width: w, height: h });
    await open(page);
    await shot(page, "1-empty", w);
    await page
      .getByLabel("or paste data")
      .fill(
        JSON.stringify([item("a", 80), item("b", "0.8"), item("c", 75, { formScope: "overall" })]),
      );
    await expect(page.getByTestId("preview")).toBeVisible();
    await page.waitForTimeout(700);
    await shot(page, "2-preview", w);
    await page.getByRole("button", { name: /^Import \d+ matches$/ }).click();
    await expect(page.getByTestId("import-result")).toBeVisible();
    await page.waitForTimeout(1200);
    await shot(page, "3-result", w);
    await resetData();
  }
});
