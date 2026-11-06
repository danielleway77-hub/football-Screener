import { expect, test, type Page } from "@playwright/test";

// Step 3.3 checks (docs/TEST_CATALOG.md §3.3) in a real browser.

async function open(page: Page) {
  await page.goto("/style-guide#motion");
  await expect(page.locator('[data-testid="style-guide"][data-hydrated="true"]')).toBeVisible();
}

const visibleCounts = (page: Page) =>
  page.getByTestId("motion-stage").getByTestId("countup-visible");

test("no hydration warnings or console errors on the style guide", async ({ page }) => {
  const problems: string[] = [];
  page.on("console", (msg) => {
    if (
      ["error", "warning"].includes(msg.type()) &&
      /hydrat|did not match|server rendered/i.test(msg.text())
    ) {
      problems.push(msg.text());
    }
  });
  page.on("pageerror", (error) => problems.push(error.message));
  await open(page);
  await page.getByRole("button", { name: "Replay" }).click();
  await page.waitForTimeout(500);
  expect(problems).toEqual([]);
});

test("first server paint shows final values (nothing hidden waiting for JS)", async ({ page }) => {
  await page.goto("/style-guide#motion");
  await expect(visibleCounts(page).first()).toHaveText("80%");
  await expect(page.getByTestId("bar-fill").first()).toHaveCSS("width", /.+/);
  const widthPx = await page
    .getByTestId("bar-fill")
    .first()
    .evaluate((el) => el.getBoundingClientRect().width);
  expect(widthPx).toBeGreaterThan(10);
});

test("CountUp counts up after Replay and ends on the exact value", async ({ page }) => {
  await open(page);
  // CountUp starts when it is on screen; the smooth hash-scroll may still be running, so bring it into view first.
  await page.getByTestId("motion-stage").scrollIntoViewIfNeeded();
  await expect(page.getByTestId("motion-stage")).toBeInViewport();
  await page.getByRole("button", { name: "Replay" }).click();
  await expect(visibleCounts(page).nth(0)).toHaveText("80%", { timeout: 4000 });
  await expect(visibleCounts(page).nth(1)).toHaveText("76%");
  await expect(visibleCounts(page).nth(2)).toHaveText("3");
  // the accessible text holds the final value regardless of animation state
  await expect(page.getByTestId("motion-stage").locator(".sr-only").first()).toHaveText("80%");
});

test("bars animate to the right proportion and finish", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Replay" }).click();
  await page.waitForTimeout(1600);
  const ratios = await page.getByTestId("bar-track").evaluateAll((tracks) =>
    tracks.map((t) => {
      const fill = t.querySelector('[data-testid="bar-fill"]') as HTMLElement;
      return Math.round(
        (fill.getBoundingClientRect().width / t.getBoundingClientRect().width) * 100,
      );
    }),
  );
  expect(ratios).toEqual([76, 16, 8]);
});

test("exactly 8 of 10 staggered items animate", async ({ page }) => {
  await open(page);
  const stage = page.getByTestId("motion-stage");
  await expect(stage.locator('[data-motion="animated"]')).toHaveCount(8);
  await expect(stage.locator('[data-motion="static"]')).toHaveCount(2);
});

test("reduced motion: final values appear immediately after Replay", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  await page.getByRole("button", { name: "Replay" }).click();
  await expect(visibleCounts(page).nth(0)).toHaveText("80%", { timeout: 300 });
  const ratios = await page.getByTestId("bar-track").evaluateAll((tracks) =>
    tracks.map((t) => {
      const fill = t.querySelector('[data-testid="bar-fill"]') as HTMLElement;
      return Math.round(
        (fill.getBoundingClientRect().width / t.getBoundingClientRect().width) * 100,
      );
    }),
  );
  expect(ratios).toEqual([76, 16, 8]);
  await expect(page.getByTestId("motion-stage").locator('[data-motion="animated"]')).toHaveCount(0);
});

test("web animations only touch opacity, transform and width (no layout properties)", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Replay" }).click();
  const props = await page.evaluate(async () => {
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) {
      for (const a of document.getAnimations()) {
        const effect = a.effect as KeyframeEffect | null;
        effect?.getKeyframes().forEach((k) => Object.keys(k).forEach((key) => seen.add(key)));
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    return [...seen];
  });
  const layout = props.filter((p) =>
    ["height", "top", "left", "right", "bottom", "margin", "padding", "inset"].some((x) =>
      p.toLowerCase().startsWith(x),
    ),
  );
  expect(layout).toEqual([]);
});

test("first load never hides or animates Reveal/Stagger content, even after hydration", async ({
  page,
}) => {
  await page.goto("/style-guide#motion");
  await expect(page.locator('[data-testid="style-guide"][data-hydrated="true"]')).toBeVisible();
  // sample for a while after hydration: opacity must stay 1 and the count must stay final
  const samples = await page.evaluate(async () => {
    const out: { reveal: string; stagger: string; count: string }[] = [];
    for (let i = 0; i < 12; i++) {
      const stage = document.querySelector('[data-testid="motion-stage"]')!;
      out.push({
        reveal: getComputedStyle(stage.querySelector('[data-motion="reveal"]')!).opacity,
        stagger: getComputedStyle(stage.querySelector('[data-motion="animated"]')!).opacity,
        count: stage.querySelector('[data-testid="countup-visible"]')!.textContent ?? "",
      });
      await new Promise((r) => setTimeout(r, 60));
    }
    return out;
  });
  for (const s of samples) {
    expect(s.reveal).toBe("1");
    expect(s.stagger).toBe("1");
    expect(s.count).toBe("80%");
  }
});
