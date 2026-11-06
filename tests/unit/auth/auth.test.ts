import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { sanitizeNext } from "@/lib/next-param";
import { sessionCookieName, signSessionToken, verifySessionToken } from "@/server/auth/jwt";
import { isSameOrigin } from "@/server/auth/origin";
import { verifyPasswordAgainst } from "@/server/auth/password";
import { evaluateRateLimit, getClientIp } from "@/server/auth/rate-limit";

const SECRET = "x".repeat(40);
const NOW = new Date("2026-11-03T12:00:00Z");
const b64 = (value: string) => Buffer.from(value).toString("base64url");

describe("password", () => {
  it("bcrypt verify accepts the right password and rejects the wrong one", async () => {
    const hash = await bcrypt.hash("correct horse", 4);
    expect(await verifyPasswordAgainst("correct horse", hash)).toBe(true);
    expect(await verifyPasswordAgainst("wrong", hash)).toBe(false);
  });

  it("returns false when no hash is configured or the hash is garbage", async () => {
    expect(await verifyPasswordAgainst("anything", null)).toBe(false);
    expect(await verifyPasswordAgainst("anything", "not-a-hash")).toBe(false);
  });
});

describe("session JWT", () => {
  it("round-trips the version claim", async () => {
    const token = await signSessionToken(3, SECRET, NOW);
    expect(await verifySessionToken(token, SECRET, NOW)).toEqual({ v: 3 });
  });

  it("rejects tampering (payload edit, wrong secret, alg none, garbage)", async () => {
    const token = await signSessionToken(1, SECRET, NOW);
    const [h, , s] = token.split(".");
    const forged = b64(JSON.stringify({ v: 99, iat: 1, exp: 9999999999 }));
    expect(await verifySessionToken(`${h}.${forged}.${s}`, SECRET, NOW)).toBeNull();
    expect(await verifySessionToken(token, "y".repeat(40), NOW)).toBeNull();
    expect(
      await verifySessionToken(`${b64(JSON.stringify({ alg: "none" }))}.${forged}.`, SECRET, NOW),
    ).toBeNull();
    expect(await verifySessionToken("garbage", SECRET, NOW)).toBeNull();
    expect(await verifySessionToken(undefined, SECRET, NOW)).toBeNull();
  });

  it("expired JWT is rejected; valid before expiry", async () => {
    const token = await signSessionToken(1, SECRET, NOW);
    const day = 24 * 3600_000;
    expect(
      await verifySessionToken(token, SECRET, new Date(NOW.getTime() + 29 * day)),
    ).not.toBeNull();
    expect(await verifySessionToken(token, SECRET, new Date(NOW.getTime() + 31 * day))).toBeNull();
  });

  it("rejects a token without a numeric version claim", async () => {
    const t = await new SignJWT({ v: "1" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(SECRET));
    expect(await verifySessionToken(t, SECRET)).toBeNull();
  });

  it("cookie name is __Host-session in production and session otherwise", () => {
    expect(sessionCookieName("production")).toBe("__Host-session");
    expect(sessionCookieName("development")).toBe("session");
    expect(sessionCookieName(undefined)).toBe("session");
  });
});

describe("sanitizeNext", () => {
  it('allows "/" and "/runs?x=1"', () => {
    expect(sanitizeNext("/")).toBe("/");
    expect(sanitizeNext("/runs?x=1")).toBe("/runs?x=1");
    expect(sanitizeNext("/matches/abc#top")).toBe("/matches/abc#top");
  });

  it.each([
    "//evil.com",
    "https://evil.com",
    "/\\evil.com",
    "javascript:alert(1)",
    "",
    "evil.com",
    "/ok\n//x",
  ])("rejects %j", (value) => {
    expect(sanitizeNext(value)).toBe("/");
  });

  it("handles null and undefined", () => {
    expect(sanitizeNext(null)).toBe("/");
    expect(sanitizeNext(undefined)).toBe("/");
  });
});

describe("rate limit", () => {
  const ago = (m: number) => new Date(NOW.getTime() - m * 60_000);

  it("allows 4 failures and blocks once 5 are recorded (the 6th attempt)", () => {
    expect(evaluateRateLimit([ago(5), ago(4), ago(3), ago(2)], NOW).allowed).toBe(true);
    expect(evaluateRateLimit([ago(5), ago(4), ago(3), ago(2), ago(1)], NOW).allowed).toBe(false);
  });

  it("reports how long to wait and recovers after the window", () => {
    const five = [ago(14), ago(13), ago(12), ago(11), ago(10)];
    expect(evaluateRateLimit(five, NOW)).toEqual({ allowed: false, retryAfterSeconds: 60 });
    expect(evaluateRateLimit(five, new Date(NOW.getTime() + 61_000)).allowed).toBe(true);
  });

  it("a failure exactly 15 minutes old no longer counts", () => {
    expect(evaluateRateLimit([ago(15), ago(4), ago(3), ago(2), ago(1)], NOW).allowed).toBe(true);
  });

  it("uses the first x-forwarded-for hop, then x-real-ip, then unknown", () => {
    expect(getClientIp(new Headers({ "x-forwarded-for": " 1.2.3.4 , 5.6.7.8" }))).toBe("1.2.3.4");
    expect(getClientIp(new Headers({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
    expect(getClientIp(new Headers())).toBe("unknown");
  });
});

describe("isSameOrigin", () => {
  const req = (origin?: string) =>
    new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: origin ? { origin } : {},
    });

  it("accepts the same origin and rejects others or a missing Origin", () => {
    expect(isSameOrigin(req("http://localhost:3000"))).toBe(true);
    expect(isSameOrigin(req("https://evil.com"))).toBe(false);
    expect(isSameOrigin(req("http://localhost:3001"))).toBe(false);
    expect(isSameOrigin(req())).toBe(false);
    expect(isSameOrigin(req("not a url"))).toBe(false);
  });
});

describe("proxy", () => {
  async function run(path: string, cookie?: string) {
    vi.stubEnv("SESSION_SECRET", SECRET);
    vi.stubEnv("NODE_ENV", "development");
    const { proxy } = await import("@/proxy");
    const headers = cookie ? { cookie: `session=${cookie}` } : undefined;
    return proxy(new NextRequest(`http://localhost:3000${path}`, { headers }));
  }

  it("redirects a logged-out page request to /login?next=", async () => {
    const res = await run("/runs?x=1");
    expect(res.status).toBe(307);
    const loc = new URL(res.headers.get("location")!);
    expect(loc.pathname).toBe("/login");
    expect(loc.searchParams.get("next")).toBe("/runs?x=1");
  });

  it("answers 401 JSON for a logged-out API call", async () => {
    const res = await run("/api/run");
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHORIZED");
  });

  it("lets public routes through", async () => {
    for (const p of [
      "/login",
      "/api/auth/login",
      "/api/health",
      "/api/cron/daily",
      "/api/ingest",
    ]) {
      expect((await run(p)).status, p).toBe(200);
    }
  });

  it("lets a valid session through and bounces /login to /", async () => {
    const token = await signSessionToken(1, SECRET);
    expect((await run("/runs", token)).status).toBe(200);
    const bounce = await run("/login", token);
    expect(bounce.status).toBe(307);
    expect(new URL(bounce.headers.get("location")!).pathname).toBe("/");
  });

  it("does not bounce /login?expired=1 (a version mismatch would loop)", async () => {
    const token = await signSessionToken(1, SECRET);
    expect((await run("/login?expired=1", token)).status).toBe(200);
  });

  it("treats a tampered cookie as logged out", async () => {
    const token = await signSessionToken(1, SECRET);
    expect((await run("/runs", token.slice(0, -3) + "abc")).status).toBe(307);
  });
});
