import { expect, test, type Page } from "@playwright/test";
import { baselineMatches, seedBaseline, seedMatches } from "./helpers/dashboard-db";

// Step 15.1 / 15.4 checks (docs/TEST_CATALOG.md §15.1): login timeline, reduced motion, CLS,
// animated properties, sheen visibility rules, icons/OG/manifest. Shares ONE schema: --workers=1.
test.setTimeout(120_000);

const addClsObserver = (page: Page) =>
  page.addInitScript(() => {
    (window as unknown as { __cls: number }).__cls = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[])
        if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
    }).observe({ type: "layout-shift", buffered: true });
  });
const cls = (page: Page) => page.evaluate(() => (window as unknown as { __cls: number }).__cls);

test.describe("login (signed out)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("timeline plays once and finishes in under 1.3 s, leaving the final state", async ({
    page,
  }) => {
    await page.goto("/login"); // warm the dev server (and the gsap chunk)
    await expect(page.locator("main")).toHaveAttribute("data-login-entrance", /done|skipped/, {
      timeout: 15_000,
    });
    await page.reload();
    const main = page.locator("main");
    await expect(main).toHaveAttribute("data-login-entrance", "done", { timeout: 6000 });
    const ms = Number(await main.getAttribute("data-entrance-ms"));
    expect(ms).toBeGreaterThan(900); // it really animated (timeline is 1.2 s)
    expect(ms).toBeLessThan(1300);
    // final state: nothing left transparent or displaced, no inline leftovers
    for (const sel of ["[data-login-logo]", "[data-login-card]", "[data-login-glow]"]) {
      const s = await page
        .locator(sel)
        .first()
        .evaluate((el) => ({
          opacity: getComputedStyle(el).opacity,
          transform: getComputedStyle(el).transform,
          inline: el.getAttribute("style"),
        }));
      expect(s.opacity).toBe("1");
      expect(s.transform).toBe("none");
      expect(s.inline || null).toBeNull();
    }
    for (const f of await page.locator("[data-login-field]").all()) {
      await expect(f).toHaveCSS("opacity", "1");
      await expect(f).toHaveCSS("transform", "none");
    }
  });

  test("first server paint already shows every element (nothing hidden waiting for JS)", async ({
    browser,
    baseURL,
  }) => {
    const ctx = await browser.newContext({ baseURL, javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto("/login");
    for (const sel of ["[data-login-logo]", "[data-login-card]", "[data-login-field]"]) {
      await expect(page.locator(sel).first()).toBeVisible();
      await expect(page.locator(sel).first()).toHaveCSS("opacity", "1");
    }
    await ctx.close();
  });

  test("reduced motion: static final state, no timeline, no drift", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/login");
    const main = page.locator("main");
    await expect(main).toHaveAttribute("data-login-entrance", "skipped");
    await page.waitForTimeout(300);
    expect((await page.locator("[data-login-logo]").getAttribute("style")) || null).toBeNull();
    await expect(page.locator(".login-glow-blob")).toHaveCSS("animation-name", "none");
    await expect(page.locator("#password")).toBeVisible();
  });

  test("ambient glow drifts only with motion allowed and is 480px at 8% opacity", async ({
    page,
  }) => {
    await page.goto("/login");
    const blob = page.locator(".login-glow-blob");
    await expect(blob).toHaveCSS("animation-name", "login-drift");
    await expect(blob).toHaveCSS("animation-duration", "14s");
    await expect(blob).toHaveCSS("opacity", "0.08");
    expect(
      await page.locator("[data-login-glow]").evaluate((e) => e.getBoundingClientRect().width),
    ).toBe(480);
    // hidden tab pauses the drift
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(blob).toHaveCSS("animation-play-state", "paused");
  });

  test("CLS stays under 0.05 on /login", async ({ page }) => {
    await addClsObserver(page);
    await page.goto("/login");
    await page.waitForTimeout(2200);
    expect(await cls(page)).toBeLessThan(0.05);
  });

  test("no hydration warnings on /login, also under reduced motion", async ({ page }) => {
    const bad: string[] = [];
    page.on("console", (m) => {
      if (/hydrat|did not match/i.test(m.text())) bad.push(m.text());
    });
    page.on("pageerror", (e) => bad.push(e.message));
    await page.goto("/login");
    await page.waitForTimeout(1500);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/login");
    await page.waitForTimeout(800);
    expect(bad).toEqual([]);
  });
});

test.describe("dashboard", () => {
  test.beforeEach(async () => {
    await seedBaseline();
    await seedMatches(
      Array.from({ length: 9 }, (_, i) => ({
        id: `extra${i}`,
        home: `Extra Home ${i}`,
        away: `Extra Away ${i}`,
        homePct: 80,
        awayPct: 9,
        inHours: 30 + i,
      })),
    );
  });

  test("CLS stays under 0.05 on the dashboard", async ({ page }) => {
    await addClsObserver(page);
    await page.goto("/");
    await expect(page.getByTestId("match-card").first()).toBeVisible();
    await page.waitForTimeout(2200);
    expect(await cls(page)).toBeLessThan(0.05);
  });

  test("entrance animations (client navigation) only touch transform, opacity and bar width", async ({
    page,
  }) => {
    await page.goto("/runs");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.evaluate(() => {
      const w = window as unknown as { __props: string[] };
      w.__props = [];
      const sample = () => {
        for (const a of document.getAnimations()) {
          // scope: the page entrance choreography (framer-driven [data-motion] wrappers, cards, bars, sheen);
          // chrome hover/active colour transitions (navbar, tabs) are not entrance motion.
          const target = (a.effect as KeyframeEffect | null)?.target as Element | null;
          if (!target) continue;
          if (!target.matches("[data-motion]") && !target.closest(".card-sheen")) continue;
          const frames = (a.effect as KeyframeEffect | null)?.getKeyframes?.() ?? [];
          for (const f of frames)
            for (const k of Object.keys(f))
              if (!["offset", "easing", "composite", "computedOffset"].includes(k))
                w.__props.push(k);
        }
        requestAnimationFrame(sample);
      };
      sample();
    });
    await page.getByRole("link", { name: "Dashboard" }).first().click();
    await expect(page.getByTestId("match-card").first()).toBeVisible();
    await page.waitForTimeout(1500);
    const props = await page.evaluate(() => [
      ...new Set((window as unknown as { __props: string[] }).__props),
    ]);
    expect(props.length).toBeGreaterThan(0); // something really animated
    const allowed = new Set(["transform", "opacity", "width", "translate", "scale", "rotate"]);
    expect(props.filter((p) => !allowed.has(p))).toEqual([]);
  });

  test("qualifying cards sheen only while on screen; non-qualifying cards have none", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await expect(page.getByTestId("match-card").first()).toBeVisible();
    const sheens = page.getByTestId("card-sheen");
    expect(await sheens.count()).toBeGreaterThanOrEqual(10);
    // first card is on screen -> active and running; the last one is far below -> paused
    await expect(sheens.first()).toHaveAttribute("data-active", "true");
    const first = await sheens
      .first()
      .locator(".card-sheen-beam")
      .evaluate((el) => {
        const cs = getComputedStyle(el);
        return [cs.animationDuration, cs.animationPlayState, cs.animationTimingFunction];
      });
    expect(first).toEqual(["6s", "running", "linear"]);
    await expect(sheens.last()).toHaveAttribute("data-active", "false");
    await expect(sheens.last().locator(".card-sheen-beam")).toHaveCSS(
      "animation-play-state",
      "paused",
    );
    // scrolling the last one into view starts it
    await sheens.last().scrollIntoViewIfNeeded();
    await expect(sheens.last()).toHaveAttribute("data-active", "true");
    // the non-qualifying baseline card (Atletico) never has one
    const atletico = page.getByTestId("match-card").filter({ hasText: "Atletico Madrid" });
    await expect(atletico).toHaveCount(0); // not qualifying -> not listed; assert no sheen on any non-qualifier
    expect(
      await page
        .locator('[data-testid="match-card"][data-qualifies="false"] [data-testid="card-sheen"]')
        .count(),
    ).toBe(0);
  });

  test("reduced motion: sheen hidden, cards fully visible, no hydration warning", async ({
    page,
  }) => {
    const bad: string[] = [];
    page.on("console", (m) => {
      if (/hydrat|did not match/i.test(m.text())) bad.push(m.text());
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.getByTestId("match-card").first()).toBeVisible();
    await expect(page.getByTestId("card-sheen").first()).toHaveCSS("display", "none");
    await page.waitForTimeout(800);
    expect(bad).toEqual([]);
  });

  test("hover lifts a card 2px in 180-200 ms on hover-capable pointers", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "touch devices have no hover");
    await page.goto("/");
    const card = page.getByTestId("match-card").first();
    await expect(card).toBeVisible();
    await expect(card).toHaveCSS("transition-duration", /0\.2s/);
    await card.hover();
    // Tailwind v4 lifts with the `translate` property (not `transform`)
    await expect.poll(() => card.evaluate((el) => getComputedStyle(el).translate)).toBe("0px -2px");
  });

  test("baseline fixtures are what the checks assume (guard)", async () => {
    expect(baselineMatches().filter((m) => m.qualifies !== false).length).toBeGreaterThan(2);
  });
});

test.describe("brand assets", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("manifest: name Screener, theme colour from the token", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest");
    expect(res.status()).toBe(200);
    const m = await res.json();
    expect(m.name).toBe("Screener");
    expect(m.theme_color).toBe("#070A09");
    expect(m.background_color).toBe("#070A09");
    expect(m.icons.map((i: { sizes: string }) => i.sizes)).toEqual(
      expect.arrayContaining(["192x192", "512x512"]),
    );
  });

  test("head carries theme-color, og:image (1200x630 PNG), icons and apple touch icon", async ({
    page,
    request,
  }) => {
    await page.goto("/login");
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#070A09");
    await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute("content", /dark/);
    const og = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(og).toBeTruthy();
    const res = await request.get(new URL(og!).pathname + new URL(og!).search);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("image/png");
    const buf = await res.body();
    expect(buf.readUInt32BE(16)).toBe(1200);
    expect(buf.readUInt32BE(20)).toBe(630);
    await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute(
      "content",
      "1200",
    );
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
    expect((await request.get("/icon.svg")).status()).toBe(200);
    for (const p of ["/icons/icon-32.png", "/icons/icon-192.png", "/icons/icon-512.png"])
      expect((await request.get(p)).status()).toBe(200);
  });

  test("GSAP is not loaded by the dashboard", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({
      baseURL,
      storageState: "tests/e2e/.auth/owner.json",
    });
    const page = await ctx.newPage();
    const bodies: string[] = [];
    page.on("response", async (r) => {
      if (r.url().endsWith(".js") || r.url().includes("/_next/static/chunks/")) {
        try {
          bodies.push(await r.text());
        } catch {
          /* ignore */
        }
      }
    });
    await seedBaseline();
    await page.goto("/");
    await expect(page.getByTestId("match-card").first()).toBeVisible();
    await page.waitForTimeout(500);
    expect(bodies.length).toBeGreaterThan(3);
    expect(bodies.filter((b) => /_gsap|GreenSock|gsap\.registerPlugin/.test(b))).toHaveLength(0);
    await ctx.close();
  });
});
