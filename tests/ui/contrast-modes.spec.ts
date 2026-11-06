import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { seedBaseline } from "../e2e/helpers/dashboard-db";

// Step 15.6 (UI_BLUEPRINT §31): forced-colors, prefers-contrast: more, reduced transparency.
// Playwright cannot emulate prefers-reduced-transparency, so that one is verified by reading the stylesheet rule.
test.setTimeout(120_000);
test.skip(({ isMobile }) => isMobile, "contrast modes are viewport independent: run once");

const OUT = "docs/reference/ui-review/15.6";
const ROUTES = [
  { name: "dashboard", url: "/" },
  { name: "detail", url: "/matches/golden" },
  { name: "settings", url: "/settings" },
];
const emulate = (page: Page, media: Parameters<Page["emulateMedia"]>[0]) =>
  page.emulateMedia(media);

test.beforeAll(async () => {
  await seedBaseline();
  mkdirSync(OUT, { recursive: true });
});

test.describe("forced-colors: active", () => {
  for (const route of ROUTES) {
    test(`${route.name}: nothing is invisible, boundaries are borders, focus is an outline`, async ({
      page,
    }) => {
      await emulate(page, { forcedColors: "active", contrast: "more", reducedMotion: "reduce" });
      await page.goto(route.url);
      await expect(page.locator("main").first()).toBeVisible();
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${OUT}/${route.name}-forced-colors.png` });

      // 1. no text drawn in the same colour as its (resolved) background
      const clashes = await page.evaluate(() => {
        const bgOf = (el: Element) => {
          for (let n: Element | null = el; n; n = n.parentElement) {
            const c = getComputedStyle(n).backgroundColor;
            if (c && c !== "rgba(0, 0, 0, 0)" && c !== "transparent") return c;
          }
          return "rgb(0, 0, 0)";
        };
        const out: string[] = [];
        for (const el of Array.from(document.body.querySelectorAll("*"))) {
          const hasText = Array.from(el.childNodes).some(
            (n) => n.nodeType === 3 && n.textContent?.trim(),
          );
          if (!hasText) continue;
          const r = (el as HTMLElement).getBoundingClientRect();
          if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === "hidden")
            continue;
          if (getComputedStyle(el).color === bgOf(el))
            out.push(`${el.tagName}.${(el as HTMLElement).className}`.slice(0, 80));
        }
        return out;
      });
      expect(clashes).toEqual([]);

      // 2. surfaces keep a real border (box-shadow is stripped in forced colours)
      const shadowOnly = await page.evaluate(() => {
        const out: string[] = [];
        for (const el of Array.from(
          document.querySelectorAll(
            ".surface-1, .surface-2, .surface-3, [data-slot='card'], input",
          ),
        )) {
          const cs = getComputedStyle(el);
          const r = (el as HTMLElement).getBoundingClientRect();
          if (r.width === 0) continue;
          if (parseFloat(cs.borderTopWidth) < 1 || cs.borderTopStyle === "none")
            out.push(`${el.tagName}.${(el as HTMLElement).className}`.slice(0, 80));
        }
        return out;
      });
      expect(shadowOnly).toEqual([]);

      // 3. every focusable element shows an OUTLINE when reached with the keyboard
      const missing: string[] = [];
      for (let i = 0; i < 24; i++) {
        await page.keyboard.press("Tab");
        const info = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          if (!el || el === document.body || el.tagName === "NEXTJS-PORTAL") return null; // dev overlay
          const cs = getComputedStyle(el);
          return {
            label: `${el.tagName} ${el.getAttribute("aria-label") ?? el.textContent?.slice(0, 20) ?? ""}`,
            outlined: cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2,
          };
        });
        if (info && !info.outlined) missing.push(info.label);
      }
      expect(missing).toEqual([]);
    });
  }

  test("status text survives: the qualifies chip keeps its label and icon", async ({ page }) => {
    await emulate(page, { forcedColors: "active" });
    await page.goto("/");
    await expect(page.getByText("Qualifies").first()).toBeVisible();
    await expect(page.getByTestId("match-card").first().locator("svg").first()).toBeVisible();
  });

  test("login (signed out) is readable and keeps the scan line", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
      forcedColors: "active",
      reducedMotion: "reduce",
    });
    const page = await ctx.newPage();
    await page.goto("/login");
    await expect(page.locator("#password")).toBeVisible();
    await page.screenshot({ path: `${OUT}/login-forced-colors.png` });
    const lineVisible = await page
      .locator("[data-login-glyph] line")
      .first()
      .evaluate((el) => {
        const cs = getComputedStyle(el);
        return cs.stroke !== "none" && parseFloat(cs.strokeWidth) > 0;
      });
    expect(lineVisible).toBe(true);
    await ctx.close();
  });
});

test.describe("prefers-contrast: more", () => {
  test("hairlines and borders get stronger, muted text brightens", async ({ page }) => {
    await page.goto("/");
    const normal = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--hairline").trim(),
    );
    await emulate(page, { contrast: "more" });
    await page.goto("/");
    await expect(page.getByTestId("match-card").first()).toBeVisible();
    await page.screenshot({ path: `${OUT}/dashboard-contrast-more.png` });
    const more = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      const card = getComputedStyle(document.querySelector("[data-testid='match-card']")!);
      return {
        hairline: cs.getPropertyValue("--hairline").trim(),
        text: cs.getPropertyValue("--text").trim(),
        muted: cs.getPropertyValue("--text-muted").trim(),
        cardBorder: card.borderTopColor,
      };
    });
    expect(normal).not.toBe(more.hairline);
    const alpha = Number(more.cardBorder.match(/,\s*([\d.]+)\)$/)?.[1] ?? 1);
    expect(alpha).toBeGreaterThanOrEqual(0.3);
    expect(more.muted).toBe(more.text);
  });
});

test.describe("reduced transparency", () => {
  test("the stylesheet makes .glass solid and blur-free (read from the CSSOM)", async ({
    page,
  }) => {
    await page.goto("/");
    const rule = await page.evaluate(() => {
      for (const sheet of Array.from(document.styleSheets)) {
        let rules: CSSRuleList;
        try {
          rules = sheet.cssRules;
        } catch {
          continue;
        }
        for (const r of Array.from(rules)) {
          if (r instanceof CSSMediaRule && /prefers-reduced-transparency/.test(r.conditionText)) {
            for (const inner of Array.from(r.cssRules)) {
              if (inner instanceof CSSStyleRule && inner.selectorText.includes(".glass"))
                return {
                  bg: inner.style.getPropertyValue("background"),
                  blur: inner.style.getPropertyValue("backdrop-filter"),
                };
            }
          }
        }
      }
      return null;
    });
    expect(rule).toEqual({ bg: "var(--bg-base)", blur: "none" });
  });
});
