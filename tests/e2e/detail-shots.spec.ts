import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { test } from "@playwright/test";
import { DETAIL_IDS_FILE } from "./seed-detail";

// Review screenshots of the detail page (opt-in: SHOTS_DIR=<dir>). Not part of the normal gates.
const dir = process.env.SHOTS_DIR;
test.skip(!dir || !existsSync(DETAIL_IDS_FILE), "set SHOTS_DIR to capture");
test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== "desktop", "one project"));

const SIZES = [360, 768, 1280, 1920].map((w) => ({ w, h: w < 600 ? 800 : w < 1000 ? 1024 : 900 }));
const CASES = ["golden", "away-strong", "stale-flag", "xss"];

test("capture detail screenshots", async ({ page }) => {
  test.setTimeout(240_000);
  mkdirSync(dir!, { recursive: true });
  const ids = JSON.parse(readFileSync(DETAIL_IDS_FILE, "utf8")) as Record<string, string>;
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const s of SIZES) {
    await page.setViewportSize({ width: s.w, height: s.h });
    for (const c of CASES) {
      await page.goto(`/matches/${ids[c]}`);
      await page.getByTestId("match-hero").waitFor();
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${dir}/${c}-${s.w}.png`, fullPage: true });
    }
    await page.goto("/matches/xyz");
    await page.getByTestId("not-found").waitFor();
    await page.screenshot({ path: `${dir}/notfound-${s.w}.png` });
    await page.goto(`/matches/${ids.golden}?force-error=1`);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${dir}/error-${s.w}.png` });
  }
});
