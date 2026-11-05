import { expect, test } from "@playwright/test";

test("all seven illustrations render in the style guide", async ({ page }) => {
  await page.goto("/style-guide#brand");
  await expect(page.locator('[data-testid="style-guide"][data-hydrated="true"]')).toBeVisible();
  const cards = page.getByTestId("illustration-card");
  await expect(cards).toHaveCount(7);
  for (const svg of await cards.locator("svg").all()) {
    const box = await svg.boundingBox();
    expect(box!.width).toBeGreaterThan(70); // 160px and 80px variants
  }
});

test("forced-colors: illustration strokes and the logo stay visible", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await page.goto("/style-guide#brand");
  await expect(page.locator('[data-testid="style-guide"][data-hydrated="true"]')).toBeVisible();
  // Every drawn shape must stay visible under forced colours via a stroke OR a fill
  // (the small dots are filled shapes with stroke="none" by design).
  const paints = await page
    .getByTestId("illustration-card")
    .locator("circle, path, rect, polyline")
    .evaluateAll((els) =>
      els.map((el) => {
        const cs = getComputedStyle(el);
        const visible = (v: string) =>
          v !== "none" && v !== "rgba(0, 0, 0, 0)" && v !== "transparent";
        return { stroke: visible(cs.stroke), fill: visible(cs.fill) };
      }),
    );
  expect(paints.length).toBeGreaterThan(20);
  expect(paints.filter((p) => !p.stroke && !p.fill)).toEqual([]);

  const logo = await page
    .getByRole("img", { name: "Screener" })
    .first()
    .locator("circle")
    .evaluate((el) => getComputedStyle(el).stroke);
  expect(logo).not.toBe("none");
});
test("app icons are served", async ({ request }) => {
  for (const url of [
    "/icon.svg",
    "/apple-icon.png",
    "/icons/icon-32.png",
    "/icons/icon-192.png",
    "/icons/icon-512.png",
  ]) {
    const res = await request.get(url);
    expect(res.status(), url).toBe(200);
  }
});

test("the page head declares the icons", async ({ page }) => {
  await page.goto("/");
  const hrefs = await page
    .locator('head link[rel~="icon"], head link[rel="apple-touch-icon"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  expect(hrefs.join(" ")).toContain("icon.svg");
  expect(hrefs.join(" ")).toContain("apple-icon");
});
