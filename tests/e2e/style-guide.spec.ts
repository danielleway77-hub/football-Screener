import { expect, test } from "@playwright/test";

// Step 2.1 measurable checks (docs/TEST_CATALOG.md §2.1). Runs on all four viewport projects.

test.describe("style guide — theme foundation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/style-guide");
    await expect(page.getByTestId("style-guide")).toBeVisible();
  });

  test("button heights are sm 36 / default 44 / lg 52", async ({ page }) => {
    const heightOf = async (size: string) =>
      Math.round(
        (await page
          .locator(
            `[data-slot="button"][data-variant="default"][data-size="${size}"]:not([data-force])`,
          )
          .first()
          .boundingBox())!.height,
      );
    expect(await heightOf("sm")).toBe(36);
    expect(await heightOf("default")).toBe(44);
    expect(await heightOf("lg")).toBe(52);
  });

  test("input height is 44px", async ({ page }) => {
    const box = await page.locator("#f-default").boundingBox();
    expect(Math.round(box!.height)).toBe(44);
  });

  test("body font-size is 16px and --primary is rgb(200,245,46)", async ({ page }) => {
    const body = await page.evaluate(() => getComputedStyle(document.body).fontSize);
    expect(body).toBe("16px");
    const primary = await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.style.color = "var(--primary)";
      document.body.appendChild(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    });
    expect(primary).toBe("rgb(200, 245, 46)");
  });

  test("fonts: heading Space Grotesk, body Inter, numbers JetBrains Mono are loaded", async ({
    page,
  }) => {
    // next/font/local names the families after the CSS variable (spaceGrotesk, inter, jetbrains).
    const info = await page.evaluate(async () => {
      await document.fonts.ready;
      const loaded = Array.from(document.fonts)
        .filter((face) => face.status === "loaded")
        .map((face) => face.family.toLowerCase());
      return {
        h1: getComputedStyle(document.querySelector("h1")!).fontFamily.toLowerCase(),
        body: getComputedStyle(document.body).fontFamily.toLowerCase(),
        num: getComputedStyle(document.querySelector(".num")!).fontFamily.toLowerCase(),
        loaded,
      };
    });
    expect(info.h1).toMatch(/space.?grotesk/);
    expect(info.body).toContain("inter");
    expect(info.num).toMatch(/jetbrains/);
    expect(info.loaded.join(" ")).toMatch(/space.?grotesk/);
    expect(info.loaded.join(" ")).toContain("inter");
    expect(info.loaded.join(" ")).toMatch(/jetbrains/);
  });

  test("loading button keeps its width and is aria-busy", async ({ page }) => {
    const idle = page
      .locator(
        '[data-slot="button"][data-variant="secondary"][data-size="default"]:not([aria-busy]):not([data-force]):not([disabled])',
      )
      .filter({ hasText: "Run now" })
      .first();
    const loading = page
      .locator('[data-slot="button"][data-variant="secondary"][aria-busy="true"]')
      .first();
    const a = (await idle.boundingBox())!.width;
    const b = (await loading.boundingBox())!.width;
    expect(Math.abs(a - b)).toBeLessThanOrEqual(1);
  });

  test("a disabled button cannot be clicked", async ({ page }) => {
    const disabled = page.locator('[data-slot="button"][disabled]').first();
    await expect(disabled).toBeDisabled();
  });

  test("keyboard focus shows a visible outline", async ({ page }) => {
    const button = page.locator('[data-slot="button"]:not([disabled]):not([data-force])').first();
    await button.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    const style = await button.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { width: cs.outlineWidth, style: cs.outlineStyle };
    });
    expect(style.style).toBe("solid");
    expect(parseFloat(style.width)).toBeGreaterThanOrEqual(2);
  });

  test("text on cards and inputs uses the light text colour (regression: `base` colour token vs text-base size)", async ({
    page,
  }) => {
    const colours = await page.evaluate(() => ({
      cardTitle: getComputedStyle(document.querySelector('[data-slot="card-title"]')!).color,
      input: getComputedStyle(document.querySelector("#f-default")!).color,
      body: getComputedStyle(document.body).color,
    }));
    expect(colours.cardTitle).toBe("rgb(242, 247, 244)");
    expect(colours.input).toBe("rgb(242, 247, 244)");
    expect(colours.body).toBe("rgb(242, 247, 244)");
  });

  test("selected tab uses the primary-soft pill", async ({ page }) => {
    const tab = page.getByRole("tab", { name: "Tomorrow" });
    const bg = await tab.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).toMatch(/rgba?\(200, 245, 46/);
  });
  test("rule checker reports zero violations", async ({ page }) => {
    await expect(page.getByTestId("rule-checker-count")).toHaveText("0 violations", {
      timeout: 10_000,
    });
  });
});

test("style guide has no horizontal scroll at 360px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/style-guide");
  await expect(page.getByTestId("style-guide")).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("reduced motion stops the skeleton shimmer", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/style-guide");
  const animation = await page
    .locator(".skeleton-shimmer")
    .first()
    .evaluate((el) => getComputedStyle(el, "::after").animationName);
  expect(animation).toBe("none");
});
