import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { resetData, seedBaseline, seedRun, setSettings } from "./helpers/dashboard-db";

// Step 16.1 accessibility sweep (docs/TEST_CATALOG.md 16.1): axe on every page and key state, at the
// mobile (390) and desktop (1280) projects, repeated under forced-colors, prefers-contrast: more and
// prefers-reduced-motion. Serious and critical violations fail; minor/moderate are attached for the log.
// Run with: --project=mobile --project=desktop --workers=1 (specs share one schema).

const signedOut = { cookies: [], origins: [] };
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

const MODES: [string, (p: Page) => Promise<void>][] = [
  ["normal", async () => undefined],
  ["forced-colors", (p) => p.emulateMedia({ forcedColors: "active" })],
  ["prefers-contrast: more", (p) => p.emulateMedia({ contrast: "more" })],
  ["reduced-motion", (p) => p.emulateMedia({ reducedMotion: "reduce" })],
];

type PageCase = {
  name: string;
  url: string;
  prepare?: () => Promise<void>;
  signedOut?: boolean;
  /** CSS selector that proves the page (or state) rendered before scanning. */
  ready: string;
};

const PAGES: PageCase[] = [
  { name: "login", url: "/login", signedOut: true, ready: "[data-testid=login-form]" },
  {
    name: "dashboard",
    url: "/",
    prepare: () => seedBaseline(),
    ready: "main h1, main [role=heading]",
  },
  {
    name: "dashboard empty",
    url: "/",
    prepare: async () => {
      await seedBaseline();
      await resetData();
      await seedRun({ finishedHoursAgo: 1, scanned: 10, qualified: 0 });
    },
    ready: "main",
  },
  {
    name: "dashboard stale",
    url: "/",
    prepare: async () => {
      await seedBaseline();
      await resetData();
      await setSettings({ accessMode: "manual_import", windowDays: 2, staleAfterHrs: 24 });
      await seedRun({ finishedHoursAgo: 60 });
    },
    ready: "main",
  },
  {
    name: "dashboard error",
    url: "/?__error=1",
    prepare: () => seedBaseline(),
    ready: "[role=alert]",
  },
  {
    name: "runs",
    url: "/runs",
    prepare: async () => {
      await seedBaseline();
      await seedRun({ status: "FAILED", error: "Provider returned 500", finishedHoursAgo: 5 });
      await seedRun({ status: "PARTIAL", failedCount: 2, finishedHoursAgo: 9 });
    },
    ready: "main",
  },
  {
    name: "runs error",
    url: "/runs?__error=1",
    prepare: () => seedBaseline(),
    ready: "[role=alert]",
  },
  { name: "match detail", url: "/matches/golden", prepare: () => seedBaseline(), ready: "main h1" },
  { name: "match not found", url: "/matches/nope", prepare: () => seedBaseline(), ready: "main" },
  { name: "settings", url: "/settings", prepare: () => seedBaseline(), ready: "main h1" },
  { name: "import", url: "/import", prepare: () => seedBaseline(), ready: "main h1" },
  { name: "404 (signed in)", url: "/no-such-page", ready: "main, h1" },
  { name: "404 (signed out)", url: "/no-such-page", signedOut: true, ready: "main, h1" },
];

for (const c of PAGES) {
  test.describe(c.name, () => {
    test.use({ storageState: c.signedOut ? signedOut : "tests/e2e/.auth/owner.json" });
    for (const [mode, apply] of MODES) {
      test(`axe: no serious/critical violations (${mode})`, async ({ page }, info) => {
        test.setTimeout(90_000);
        await c.prepare?.();
        await apply(page);
        await page.goto(c.url);
        await expect(page.locator(c.ready).first()).toBeVisible();
        // Let entrance animations and font swaps settle so contrast is measured on final colours.
        await page.evaluate(() => document.fonts.ready);
        await page.waitForFunction(() =>
          document
            .getAnimations()
            .every(
              (a) => a.playState !== "running" || a.effect?.getTiming().iterations === Infinity,
            ),
        );
        // Under forced-colors the browser replaces every author colour with system colours (guaranteed contrast),
        // and axe cannot resolve them: its colour-contrast result is a false positive there, so it is skipped.
        const builder = new AxeBuilder({ page }).withTags(TAGS);
        if (mode === "forced-colors") builder.disableRules(["color-contrast"]);
        const results = await builder.analyze();
        const bad = results.violations.filter(
          (v) => v.impact === "serious" || v.impact === "critical",
        );
        await info.attach("axe-all-violations", {
          body: JSON.stringify(
            results.violations.map((v) => ({
              id: v.id,
              impact: v.impact,
              nodes: v.nodes.map((n) => n.target.join(" ")),
            })),
            null,
            2,
          ),
          contentType: "application/json",
        });
        expect(
          bad.map(
            (v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`,
          ),
        ).toEqual([]);
      });
    }
  });
}
