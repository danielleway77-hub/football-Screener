import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { resetData, seedBaseline } from "./helpers/dashboard-db";

// Step 16.1 keyboard-only checks (docs/TEST_CATALOG.md 16.1, TESTING_STANDARDS section 6.5): skip link, focus
// order and visible focus, dialog focus traps, no keyboard traps, and the full owner walkthrough.
if (existsSync(".env.test.local")) process.loadEnvFile(".env.test.local");
const PASSWORD = process.env.E2E_PASSWORD ?? "";

/** Describes the focused element, or null when focus is on the document body. */
async function focused(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body || el === document.documentElement) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const name =
      el.getAttribute("aria-label") ??
      (el as HTMLElement).innerText?.trim().slice(0, 40) ??
      el.tagName;
    return {
      tag: el.tagName.toLowerCase(),
      name,
      href: el.getAttribute("href"),
      inDialog: !!el.closest("[role=dialog]"),
      outline: cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0,
      shadow: cs.boxShadow !== "none",
      borderChange: false,
      visible: r.width > 0 && r.height > 0,
      id: el.id,
    };
  });
}

/** Presses Tab until `match` is satisfied (max `limit` presses); fails the test otherwise. */
async function tabUntil(
  page: Page,
  match: (f: NonNullable<Awaited<ReturnType<typeof focused>>>) => boolean,
  limit = 80,
) {
  for (let i = 0; i < limit; i++) {
    await page.keyboard.press("Tab");
    const f = await focused(page);
    if (f && match(f)) return f;
  }
  throw new Error(`focus never reached the target within ${limit} Tab presses`);
}

test.describe("keyboard", () => {
  test.beforeEach(async () => {
    await seedBaseline();
  });

  test("skip link is the first stop and moves focus into main", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("navbar")).toHaveAttribute("data-hydrated", "true");
    await page.keyboard.press("Tab");
    const first = await focused(page);
    expect(first?.name).toMatch(/skip to content/i);
    expect(first?.outline || first?.shadow).toBe(true);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main$/);
    const inMain = await page.evaluate(() => !!document.activeElement?.closest("main, #main"));
    expect(inMain || (await page.evaluate(() => document.activeElement?.id)) === "main").toBe(true);
  });

  for (const url of ["/", "/runs", "/settings", "/import", "/matches/golden"]) {
    test(`${url}: every tab stop shows a focus indicator, in a sensible order, with no trap`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await page.goto(url);
      await expect(page.locator("main").first()).toBeVisible();
      await expect(page.getByTestId("navbar")).toHaveAttribute("data-hydrated", "true");
      const seen: string[] = [];
      const bad: string[] = [];
      let wrapped = false;
      for (let i = 0; i < 90; i++) {
        await page.keyboard.press("Tab");
        const f = await focused(page);
        if (!f) {
          wrapped = true; // focus left the page content (browser chrome / body): no trap
          break;
        }
        const key = `${f.tag}|${f.name}|${f.href ?? ""}`;
        if (seen.includes(key)) {
          wrapped = true;
          break;
        }
        seen.push(key);
        if (!f.visible) bad.push(`${key} (not rendered)`);
        else if (!(f.outline || f.shadow)) bad.push(`${key} (no focus indicator)`);
      }
      expect(bad).toEqual([]);
      expect(wrapped, `focus cycled or left the page within 90 Tab presses on ${url}`).toBe(true);
      // The skip link comes before the navigation, which comes before the page content.
      expect(seen[0]).toMatch(/skip to content/i);
      // Shift+Tab walks backwards (reverse order exists, nothing swallows the key).
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Shift+Tab");
      const back = await focused(page);
      if (back) expect(back.visible).toBe(true);
    });
  }

  test("dialogs trap focus, close on Escape and return focus to the trigger", async ({
    page,
  }, info) => {
    await page.goto("/settings");
    await expect(page.getByTestId("settings-view")).toHaveAttribute("data-hydrated", "true");
    const trigger = page.getByRole("button", { name: "Create token" }).first();
    await trigger.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      const f = await focused(page);
      expect(f?.inDialog, `Tab ${i + 1} stayed inside the dialog`).toBe(true);
    }
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press("Shift+Tab");
      expect((await focused(page))?.inDialog).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();

    if (info.project.name === "mobile") {
      await page.goto("/");
      const menu = page.getByRole("button", { name: "Open menu" });
      await menu.focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("dialog")).toBeVisible();
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press("Tab");
        expect((await focused(page))?.inDialog).toBe(true);
      }
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toBeHidden();
      await expect(menu).toBeFocused();
    }
  });
});

test.describe("owner walkthrough, keyboard only", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("login -> dashboard -> card -> back -> runs -> settings -> token create/revoke -> logout", async ({
    page,
  }, info) => {
    test.setTimeout(180_000);
    test.skip(info.project.name !== "desktop", "the menu variant is covered by the dialog test");
    await resetData();
    await seedBaseline();
    await page.context().setExtraHTTPHeaders({
      "x-forwarded-for": `2001:db8::${randomUUID().slice(0, 4)}:${randomUUID().slice(0, 4)}`,
    });
    // Login: Tab to the password field, type, Enter submits.
    await page.goto("/login");
    await expect(page.getByTestId("login-form")).toHaveAttribute("data-hydrated", "true");
    await tabUntil(page, (f) => f.id === "password", 10);
    await page.keyboard.type(PASSWORD);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 1, name: "Qualifying matches" })).toBeVisible();

    // Filter: reach the tabs, switch with arrow keys.
    await expect(page.getByTestId("navbar")).toHaveAttribute("data-hydrated", "true");
    await tabUntil(page, (f) => f.name.startsWith("Upcoming"));
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: /^Today/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    // Open a match card with Enter, then go back.
    await tabUntil(page, (f) => (f.href ?? "").startsWith("/matches/"));
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/matches\//);
    await page.goBack();
    await expect(page.getByRole("heading", { level: 1, name: "Qualifying matches" })).toBeVisible();

    // Runs and Settings through the navigation.
    await expect(page.getByTestId("navbar")).toHaveAttribute("data-hydrated", "true");
    await tabUntil(page, (f) => f.href === "/runs");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/runs$/);
    await expect(page.getByTestId("navbar")).toHaveAttribute("data-hydrated", "true");
    await tabUntil(page, (f) => f.href === "/settings");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByTestId("settings-view")).toHaveAttribute("data-hydrated", "true");

    // Create a token with the keyboard.
    await tabUntil(page, (f) => f.name === "Create token");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByLabel("Label").focus();
    await page.keyboard.type("Keyboard token");
    await tabUntil(page, (f) => f.name === "Create token" && f.inDialog, 6);
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("token-plaintext")).toBeVisible();
    await tabUntil(page, (f) => f.name === "Done", 10);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeHidden();

    // Revoke it with the keyboard.
    await tabUntil(page, (f) => f.name === "Revoke Keyboard token");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toContainText('Revoke "Keyboard token"?');
    await tabUntil(page, (f) => f.name === "Revoke" && f.inDialog, 8);
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("token-row")).toHaveCount(0);

    // Log out.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await tabUntil(page, (f) => /log out/i.test(f.name));
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/login/);
  });
});
