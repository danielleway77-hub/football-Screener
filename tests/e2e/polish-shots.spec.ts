import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { seedBaseline } from "./helpers/dashboard-db";

// Screenshot capture for the Step 15 visual reviews (A2). Skipped unless SHOTS_DIR is set:
//   SHOTS_DIR=docs/reference/polish/after PW_PORT=3015 npx playwright test tests/e2e/polish-shots.spec.ts --project=desktop --workers=1
const dir = process.env.SHOTS_DIR;
test.skip(!dir, "set SHOTS_DIR to capture review screenshots");
test.setTimeout(240_000);

const SIZES = [
  { w: 360, h: 800 },
  { w: 768, h: 1024 },
  { w: 1280, h: 800 },
  { w: 1920, h: 1080 },
];
const ROUTES: { name: string; url: string; anon?: boolean }[] = [
  { name: "login", url: "/login", anon: true },
  { name: "dashboard", url: "/" },
  { name: "detail", url: "/matches/golden" },
  { name: "runs", url: "/runs" },
  { name: "settings", url: "/settings" },
  { name: "import", url: "/import" },
];

test("capture review screenshots", async ({ page, browser, baseURL }) => {
  mkdirSync(dir!, { recursive: true });
  await seedBaseline();
  for (const size of SIZES) {
    for (const route of ROUTES) {
      let p = page;
      let ctx;
      if (route.anon) {
        ctx = await browser.newContext({
          baseURL,
          storageState: { cookies: [], origins: [] },
          reducedMotion: "reduce",
        });
        p = await ctx.newPage();
      }
      await p.setViewportSize({ width: size.w, height: size.h });
      await p.emulateMedia({ reducedMotion: "reduce" });
      await p.goto(route.url);
      await expect(p.locator("main, [id=main]").first()).toBeVisible();
      await p.waitForLoadState("networkidle");
      await p.waitForTimeout(500);
      await p.screenshot({ path: `${dir}/${route.name}-${size.w}.png`, fullPage: false });
      await ctx?.close();
    }
  }
});
