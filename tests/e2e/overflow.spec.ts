import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// A page wider than the screen makes phones zoom out and hides fixed/sticky bars. Guard every route.
const ROUTES = [
  "/",
  "/login",
  "/runs",
  "/import",
  "/settings",
  "/matches/1",
  "/matches/no-such-match",
  // Seeded detail pages (isolated e2e schema); `@key` is resolved to the real id at run time.
  "/matches/@golden",
  "/matches/@xss",
  "/matches/@away-strong",
  "/nope",
  "/style-guide",
  "/style-guide/shell",
  "/style-guide/sticky",
];
const WIDTHS = [360, 390];

function detailId(key: string): string {
  const ids = JSON.parse(readFileSync("tests/e2e/.auth/detail-ids.json", "utf8")) as Record<
    string,
    string
  >;
  return ids[key] ?? key;
}

for (const route of ROUTES) {
  for (const width of WIDTHS) {
    test(`no horizontal overflow: ${route} at ${width}px`, async ({ page }) => {
      test.skip(
        route.includes("@") && !existsSync("tests/e2e/.auth/detail-ids.json"),
        "needs the isolated e2e database",
      );
      await page.setViewportSize({ width, height: 800 });
      const path = route.replace(/@([a-z-]+)$/, (_, key: string) => detailId(key));
      await page.goto(path);
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(600); // let client components render
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        // Ignore anything that lives inside a scroll container (it scrolls, it does not widen the page).
        const insideScroller = (el: Element) => {
          for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
            const ox = getComputedStyle(p).overflowX;
            if (ox === "auto" || ox === "scroll" || ox === "hidden" || ox === "clip") return true;
          }
          return false;
        };
        const wide = Array.from(document.querySelectorAll("body *"))
          .filter((el) => el.getBoundingClientRect().right > doc.clientWidth + 1)
          .filter((el) => !insideScroller(el))
          .filter((el) => !el.closest("[data-radix-popper-content-wrapper]"))
          .slice(0, 4)
          .map(
            (el) =>
              `${el.tagName.toLowerCase()}.${String((el as HTMLElement).className).slice(0, 60)}`,
          );
        return { delta: doc.scrollWidth - doc.clientWidth, wide };
      });
      expect(overflow.delta, `offenders: ${overflow.wide.join(" | ")}`).toBeLessThanOrEqual(0);
    });
  }
}
