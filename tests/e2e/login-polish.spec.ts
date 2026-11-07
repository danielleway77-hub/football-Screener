import { expect, test } from "@playwright/test";

// UI elevation: login states (expired session, caps lock, offline) and the branded 404.
test.setTimeout(120_000);

test.describe("login states (signed out)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("pitch backdrop is decorative, static and adds no overflow", async ({ page }) => {
    await page.goto("/login");
    const pitch = page.locator("[data-login-pitch]");
    await expect(pitch).toHaveAttribute("aria-hidden", "true");
    await expect(pitch).toHaveCSS("pointer-events", "none");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("?expired=1 explains why the form is showing", async ({ page }) => {
    await page.goto("/login?expired=1");
    await expect(page.getByTestId("login-form")).toHaveAttribute("data-hydrated", "true");
    await expect(page.getByText("Your session ended")).toBeVisible();
  });

  test("offline disables submit with a visible reason", async ({ page, context }) => {
    await page.goto("/login");
    await expect(page.getByTestId("login-form")).toHaveAttribute("data-hydrated", "true");
    await context.setOffline(true);
    await expect(page.getByText("You're offline. Reconnect to sign in.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeDisabled();
    await context.setOffline(false);
    await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });
});

test("404 actions are 44px touch targets and the page has one h1", async ({ page }) => {
  await page.goto("/nope");
  await expect(page.getByTestId("not-found")).toBeVisible();
  await expect(page.locator("h1:visible")).toHaveCount(1);
  for (const name of ["Back to dashboard", "View runs"]) {
    const box = await page.getByRole("link", { name }).boundingBox();
    expect(Math.round(box!.height)).toBeGreaterThanOrEqual(44);
  }
});
