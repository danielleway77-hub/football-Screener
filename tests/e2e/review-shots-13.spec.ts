import { mkdirSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { resetData, seedBaseline } from "./helpers/dashboard-db";
import { resetSettingsState } from "./helpers/settings-db";

// Visual review captures for Step 13 (docs/reference/ui-review/step-13). Opt-in: SHOTS=1 npx playwright test ...
test.skip(!process.env.SHOTS, "set SHOTS=1 to capture review screenshots");
test.setTimeout(120_000);

const DIR = "docs/reference/ui-review/step-13";
const SIZES = [
  { name: "360", width: 360, height: 800 },
  { name: "768", width: 768, height: 1024 },
  { name: "1280", width: 1280, height: 800 },
  { name: "1920", width: 1920, height: 1080 },
];

test.beforeAll(() => mkdirSync(DIR, { recursive: true }));
test.beforeEach(async () => {
  await resetSettingsState();
  await seedBaseline("manual_import");
});
test.afterAll(async () => {
  await resetSettingsState();
  await resetData();
});

for (const size of SIZES) {
  test.describe(`viewport ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test(`settings ${size.name}`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "desktop", "one project drives all sizes");
      await page.goto("/settings");
      await expect(page.getByTestId("settings-view")).toHaveAttribute("data-hydrated", "true");
      await page.screenshot({ path: `${DIR}/settings-${size.name}.png`, fullPage: true });
      // Dirty state (save bar) and a created token modal.
      await page.getByLabel("Poor form below").fill("40");
      await page.getByLabel("Poor form below").blur();
      await expect(page.getByTestId("save-bar")).toBeVisible();
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${DIR}/settings-${size.name}-dirty.png` });
      await page.getByRole("button", { name: "Discard" }).click();
      await page.getByRole("button", { name: "Create token" }).first().click();
      await page.getByLabel("Label").fill("Home laptop");
      await page.getByRole("button", { name: "Create token" }).last().click();
      await expect(page.getByTestId("token-plaintext")).toBeVisible();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${DIR}/settings-${size.name}-token.png` });
    });

    test(`import ${size.name}`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "desktop", "one project drives all sizes");
      await page.goto("/import");
      await expect(page.getByTestId("import-view")).toHaveAttribute("data-hydrated", "true");
      await page.screenshot({ path: `${DIR}/import-${size.name}.png`, fullPage: true });
      await page.getByRole("button", { name: "Use sample JSON" }).click();
      await expect(page.getByTestId("preview")).toBeVisible();
      await page.screenshot({ path: `${DIR}/import-${size.name}-preview.png`, fullPage: true });
      await page.getByRole("radio", { name: "Page text" }).click();
      const fs = await import("node:fs");
      const text = fs
        .readFileSync("tests/fixtures/predigoal-text/golden.txt", "utf8")
        .replace("2026-11-08T19:00:00Z", new Date(Date.now() + 30 * 3_600_000).toISOString());
      await page.getByLabel("Paste text from a match page").fill(text);
      await expect(page.getByTestId("text-match")).toBeVisible();
      await page.screenshot({ path: `${DIR}/import-${size.name}-text.png`, fullPage: true });
    });
  });
}
