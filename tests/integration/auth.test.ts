import { beforeEach, describe, expect, it, vi } from "vitest";
import { signSessionToken } from "@/server/auth/jwt";
import { checkLoginRateLimit } from "@/server/auth/rate-limit";
import * as loginAttempts from "@/server/repositories/login-attempts";
import * as settings from "@/server/repositories/settings";
import { setupTestDb } from "./helpers";

const SECRET = "s".repeat(40);
let cookieValue: string | undefined;
const redirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (cookieValue ? { value: cookieValue } : undefined),
    set: vi.fn(),
  }),
}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => undefined, // outside a Next request scope in unit tests
}));
vi.mock("next/navigation", () => ({ redirect: (u: string) => redirect(u) }));

setupTestDb();

beforeEach(() => {
  vi.stubEnv("SESSION_SECRET", SECRET);
  vi.stubEnv("NODE_ENV", "development");
  cookieValue = undefined;
  redirect.mockClear();
});

describe("requireSession", () => {
  it("passes when the JWT version equals Setting.sessionVersion", async () => {
    const { requireSession } = await import("@/server/auth/guard");
    const s = await settings.ensureSettings();
    cookieValue = await signSessionToken(s.sessionVersion, SECRET);
    await expect(requireSession()).resolves.toEqual({ v: s.sessionVersion });
  });

  it("logs out (redirects) when sessionVersion changed", async () => {
    const { requireSession } = await import("@/server/auth/guard");
    const s = await settings.ensureSettings();
    cookieValue = await signSessionToken(s.sessionVersion, SECRET);
    await settings.bumpSessionVersion();
    await expect(requireSession()).rejects.toThrow("REDIRECT:/login?expired=1");
  });

  it("redirects to /login when there is no cookie", async () => {
    const { requireSession } = await import("@/server/auth/guard");
    await expect(requireSession()).rejects.toThrow("REDIRECT:/login");
  });
});

describe("login rate limit against the database", () => {
  const NOW = new Date("2026-11-03T12:00:00Z");
  const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);

  it("blocks the 6th attempt after 5 failures in 15 min and recovers after the window", async () => {
    for (let i = 1; i <= 4; i++) await loginAttempts.record("7.7.7.7", false, minutesAgo(i));
    expect((await checkLoginRateLimit("7.7.7.7", NOW)).allowed).toBe(true);
    await loginAttempts.record("7.7.7.7", false, new Date(NOW.getTime() - 30_000));
    expect((await checkLoginRateLimit("7.7.7.7", NOW)).allowed).toBe(false);
    const later = new Date(NOW.getTime() + 15 * 60_000);
    expect((await checkLoginRateLimit("7.7.7.7", later)).allowed).toBe(true);
    expect((await checkLoginRateLimit("8.8.8.8", NOW)).allowed).toBe(true);
  });
});
