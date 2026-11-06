import { expect, test, type Page } from "@playwright/test";
import { seedBaseline } from "../e2e/helpers/dashboard-db";
import { limeRatio, radiusOnLadder } from "./sleek-lib";

// Step 15.5: sleek acceptance tests (UI_BLUEPRINT §28) + visual baselines.
// Intended for the PRODUCTION build:  PW_PROD=1 PW_PORT=3015 npx playwright test tests/ui/sleek.spec.ts --project=desktop --workers=1
// Refresh baselines after a deliberate design change:  ... --update-snapshots
// Each target page is loaded once (cached analysis); the 10 checks are separate tests over that cache.
test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "one project only");
});

type Target = { name: string; url: string; w: number; h: number; anon?: boolean; lime: number };
const M = { w: 390, h: 844 };
const D = { w: 1280, h: 800 };
const TARGETS: Target[] = [
  ...[M, D].flatMap((v) => [
    { name: "dashboard", url: "/", lime: 0.03, ...v },
    { name: "detail", url: "/matches/golden", lime: 0.03, ...v },
    { name: "settings", url: "/settings", lime: 0.03, ...v },
    { name: "runs", url: "/runs", lime: 0.03, ...v },
    { name: "import", url: "/import", lime: 0.03, ...v },
    { name: "login", url: "/login", anon: true, lime: 0.04, ...v },
  ]),
  { name: "dashboard", url: "/", lime: 0.03, w: 1920, h: 1080 },
];
const label = (t: Target) => `${t.name} @${t.w}`;

type Analysis = {
  badRadii: string[];
  pureColours: string[];
  outerShadows: string[];
  glowCount: number;
  numNotTabular: string[];
  cardBorders: string[];
  thickBorders: string[];
  smallText: string[];
  smallTargets: string[];
  cls: number;
  lime: number;
};
const cache = new Map<string, Analysis>();

async function analyse(
  page: Page,
  browser: import("@playwright/test").Browser,
  baseURL: string,
  t: Target,
) {
  const key = label(t);
  const hit = cache.get(key);
  if (hit) return hit;
  const ctx = await browser.newContext({
    baseURL,
    viewport: { width: t.w, height: t.h },
    isMobile: t.w < 600,
    hasTouch: t.w < 600,
    reducedMotion: "reduce",
    storageState: t.anon ? { cookies: [], origins: [] } : "tests/e2e/.auth/owner.json",
  });
  const p = await ctx.newPage();
  await p.addInitScript(() => {
    (window as unknown as { __cls: number }).__cls = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[])
        if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
    }).observe({ type: "layout-shift", buffered: true });
  });
  await p.goto(t.url);
  await expect(p.locator("main").first()).toBeVisible();
  await p.evaluate(() => document.fonts.ready);
  await p.waitForLoadState("networkidle");
  await p.waitForTimeout(1500);

  const dom = await p.evaluate(() => {
    const describe = (el: Element) =>
      `${el.tagName.toLowerCase()}.${String((el as HTMLElement).className).replace(/\s+/g, ".")}`.slice(
        0,
        90,
      );
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 1 && r.height > 1 && cs.visibility !== "hidden" && cs.display !== "none";
    };
    const out = {
      radiiRaw: [] as string[],
      pureColours: [] as string[],
      outerShadows: [] as string[],
      glowCount: 0,
      numNotTabular: [] as string[],
      cardBorders: [] as string[],
      thickBorders: [] as string[],
      smallText: [] as string[],
      smallTargets: [] as string[],
    };
    for (const el of Array.from(document.body.querySelectorAll("*"))) {
      if (!visible(el)) continue;
      const cs = getComputedStyle(el);
      for (const c of [
        cs.borderTopLeftRadius,
        cs.borderTopRightRadius,
        cs.borderBottomLeftRadius,
        cs.borderBottomRightRadius,
      ])
        out.radiiRaw.push(`${describe(el)}|${c}`);
      if (cs.backgroundColor === "rgb(0, 0, 0)" || cs.backgroundColor === "rgb(255, 255, 255)")
        out.pureColours.push(`${describe(el)}|${cs.backgroundColor}`);
      const isGlow = el.classList.contains("glow-accent");
      if (isGlow) out.glowCount++;
      if (
        !isGlow &&
        el.matches("[data-testid=match-card], [data-slot=card], .surface-1, .surface-2, input")
      ) {
        const outer = cs.boxShadow
          .split(/,(?![^(]*\))/)
          .map((s) => s.trim())
          .filter((s) => s && s !== "none" && !/inset/.test(s) && !/rgba?\(0, 0, 0, 0\)/.test(s));
        if (outer.length) out.outerShadows.push(`${describe(el)}|${outer.join(",")}`);
      }
      if (
        el.matches(".num, [data-num], .text-stat, .text-stat-xl, .text-stat-sm") &&
        !cs.fontVariantNumeric.includes("tabular-nums")
      )
        out.numNotTabular.push(describe(el));
      if (el.matches("[data-testid=match-card], [data-slot=card], .surface-1")) {
        const a = Number(cs.borderTopColor.match(/,\s*([\d.]+)\)$/)?.[1] ?? 1);
        if (cs.borderTopWidth !== "1px" || a > 0.14)
          out.cardBorders.push(`${describe(el)}|${cs.borderTopWidth} ${cs.borderTopColor}`);
      }
      for (const side of ["Top", "Right", "Bottom", "Left"] as const) {
        const w = parseFloat(cs[`border${side}Width` as "borderTopWidth"]);
        if (w >= 2 && cs[`border${side}Style` as "borderTopStyle"] !== "none")
          out.thickBorders.push(`${describe(el)}|${side} ${w}px`);
      }
      // text nodes < 12px
      const hasText = Array.from(el.childNodes).some(
        (n) => n.nodeType === 3 && n.textContent?.trim(),
      );
      if (hasText && parseFloat(cs.fontSize) < 12 && !el.closest(".sr-only"))
        out.smallText.push(`${describe(el)}|${cs.fontSize}|${el.textContent?.trim().slice(0, 24)}`);
      // touch targets (only meaningful on phones)
      if (el.matches("button, a[href], input, select, textarea, [role=tab], [role=switch]")) {
        const r = el.getBoundingClientRect();
        const inline = el.tagName === "A" && el.closest("p, li") && cs.display === "inline";
        const stretched = r.width > 300 && r.height > 150; // whole-card link
        if (
          !inline &&
          !stretched &&
          !el.closest(".sr-only") &&
          !el.matches(".skip-link, [aria-hidden=true]")
        )
          if (r.width < 44 - 0.5 || r.height < 44 - 0.5)
            out.smallTargets.push(
              `${describe(el)}|${Math.round(r.width)}x${Math.round(r.height)}|${el.textContent?.trim().slice(0, 20)}`,
            );
      }
    }
    return out;
  });
  const cls = await p.evaluate(() => (window as unknown as { __cls: number }).__cls);
  const lime = limeRatio(await p.screenshot({ fullPage: true }));
  await ctx.close();
  const result: Analysis = {
    badRadii: [...new Set(dom.radiiRaw.filter((r) => !radiusOnLadder(r.split("|")[1]!)))],
    pureColours: dom.pureColours,
    outerShadows: dom.outerShadows,
    glowCount: dom.glowCount,
    numNotTabular: dom.numNotTabular,
    cardBorders: dom.cardBorders,
    thickBorders: [...new Set(dom.thickBorders)],
    smallText: dom.smallText,
    smallTargets: dom.smallTargets,
    cls,
    lime,
  };
  cache.set(key, result);
  void page;
  return result;
}

test.beforeAll(async () => {
  await seedBaseline();
});

for (const t of TARGETS) {
  test.describe(label(t), () => {
    const get = (
      page: Page,
      browser: import("@playwright/test").Browser,
      baseURL: string | undefined,
    ) => analyse(page, browser, baseURL!, t);

    test("1 lime budget", async ({ page, browser, baseURL }) => {
      const a = await get(page, browser, baseURL);
      expect(a.lime, `lime share ${(a.lime * 100).toFixed(2)}%`).toBeLessThan(t.lime);
    });
    test("2 radius ladder", async ({ page, browser, baseURL }) => {
      expect((await get(page, browser, baseURL)).badRadii).toEqual([]);
    });
    test("3 no pure black/white backgrounds", async ({ page, browser, baseURL }) => {
      expect((await get(page, browser, baseURL)).pureColours).toEqual([]);
    });
    test("4 cards, tiles and inputs have no outer shadow at rest; glow budget <= 8", async ({
      page,
      browser,
      baseURL,
    }) => {
      const a = await get(page, browser, baseURL);
      expect(a.outerShadows).toEqual([]);
      expect(a.glowCount).toBeLessThanOrEqual(8);
    });
    test("5 tabular numerals", async ({ page, browser, baseURL }) => {
      expect((await get(page, browser, baseURL)).numNotTabular).toEqual([]);
    });
    test("6 hairlines: 1px, alpha <= .14, no 2px+ borders", async ({ page, browser, baseURL }) => {
      const a = await get(page, browser, baseURL);
      expect(a.cardBorders).toEqual([]);
      expect(a.thickBorders).toEqual([]);
    });
    test("7 no text under 12px", async ({ page, browser, baseURL }) => {
      expect((await get(page, browser, baseURL)).smallText).toEqual([]);
    });
    test("8 touch targets >= 44 at 390", async ({ page, browser, baseURL }) => {
      test.skip(t.w !== 390, "phone viewport only");
      expect((await get(page, browser, baseURL)).smallTargets).toEqual([]);
    });
    test("9 CLS < 0.05", async ({ page, browser, baseURL }) => {
      expect((await get(page, browser, baseURL)).cls).toBeLessThan(0.05);
    });
  });
}

test("4b floating layers DO have a shadow (dialog on /runs)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/runs");
  await page.getByRole("row").nth(1).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe("none");
});

// 10. visual baselines (animations off, fonts loaded, dynamic text masked, no personal data: seeded fixtures only)
const SNAP_SIZES = [
  { w: 390, h: 844 },
  { w: 1280, h: 800 },
];
for (const v of SNAP_SIZES) {
  test.describe(`10 baselines @${v.w}`, () => {
    test.use({ viewport: { width: v.w, height: v.h }, reducedMotion: "reduce" });
    const shot = async (page: Page, url: string, name: string, maskTime = true) => {
      await page.goto(url);
      await expect(page.locator("main").first()).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveScreenshot(`${name}-${v.w}.png`, {
        maxDiffPixelRatio: 0.002,
        animations: "disabled",
        mask: maskTime
          ? [
              page.locator(".num"),
              page.getByTestId("run-status-panel"),
              page.locator("[data-testid^=bento]"),
              page.locator("time"),
            ]
          : [],
        fullPage: false,
      });
    };

    test("dashboard", async ({ page }) => {
      await shot(page, "/", "dashboard");
    });
    test("match card", async ({ page }) => {
      await page.goto("/");
      const card = page.getByTestId("match-card").filter({ hasText: "Sporting Cristal" });
      await expect(card).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await expect(card).toHaveScreenshot(`match-card-${v.w}.png`, {
        maxDiffPixelRatio: 0.002,
        animations: "disabled",
        mask: [card.locator(".num")],
      });
    });
    test("detail", async ({ page }) => {
      await shot(page, "/matches/golden", "detail");
    });
    test("login", async ({ browser, baseURL }) => {
      const ctx = await browser.newContext({
        baseURL,
        viewport: { width: v.w, height: v.h },
        reducedMotion: "reduce",
        storageState: { cookies: [], origins: [] },
      });
      const page = await ctx.newPage();
      await shot(page, "/login", "login", false);
      await ctx.close();
    });
    test("style guide sections (dev server only: the route is 404 in production)", async ({
      page,
    }) => {
      test.skip(process.env.PW_PROD === "1", "/style-guide does not exist in production builds");
      await page.goto("/style-guide#elevation");
      await expect(page.getByTestId("style-guide")).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator("#elevation")).toHaveScreenshot(
        `style-guide-elevation-${v.w}.png`,
        {
          maxDiffPixelRatio: 0.002,
          animations: "disabled",
        },
      );
    });
  });
}
