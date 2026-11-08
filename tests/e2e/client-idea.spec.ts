import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { resetData } from "./helpers/dashboard-db";
import { resetSettingsState } from "./helpers/settings-db";

// Functional audit, "Client idea fit": the golden match from the client's image #2, end to end through the
// real Import page (smart paste of the page text) -> run pipeline -> dashboard -> detail, with screenshots.
test.setTimeout(120_000);
const SHOTS = "docs/reference/final-qa/functional";

test.beforeEach(async () => {
  await resetSettingsState();
  await resetData();
});
test.afterEach(async () => {
  await resetData();
});

test("golden match: paste -> import -> dashboard card -> detail with every client value", async ({
  page,
}, testInfo) => {
  const kickoff = new Date(Date.now() + 30 * 3_600_000).toISOString().replace(/\.\d+Z$/, "Z");
  const text = readFileSync("tests/fixtures/predigoal-text/golden.txt", "utf8").replace(
    "2026-11-08T19:00:00Z",
    kickoff,
  );
  await page.goto("/import");
  await expect(page.getByTestId("import-view")).toHaveAttribute("data-hydrated", "true");
  await page.getByRole("radio", { name: "Page text" }).click();
  await page.getByLabel("Paste text from a match page").fill(text);
  await page.getByRole("button", { name: /^Import \d+ matches$/ }).click();
  await expect(page.getByTestId("import-result")).toContainText("Imported 1 matches · 1 qualify.");

  await page.goto("/");
  const card = page.getByTestId("match-card").first();
  await expect(card).toContainText("Sporting Cristal");
  await expect(card).toContainText("80%");
  await expect(card).toContainText("7%");
  const w = testInfo.project.name === "mobile" ? 390 : 1280;
  await page.screenshot({ path: `${SHOTS}/dashboard-${w}.png`, fullPage: true });

  await card.click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Sporting Cristal vs FC Cajamarca",
  );
  const main = page.locator("main");
  for (const v of ["76%", "16%", "8%", "54%", "46%", "70%", "30%"]) {
    await expect(main).toContainText(v);
  }
  await expect(main).toContainText(/3\s*[–-]\s*1/);
  await expect(main).toContainText(/Sporting Cristal/);
  await page.screenshot({ path: `${SHOTS}/detail-${w}.png`, fullPage: true });
});
