import * as loginAttempts from "@/server/repositories/login-attempts";

export const MAX_FAILURES = 5;
export const WINDOW_MS = 15 * 60_000;

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

/**
 * Pure decision: `failures` are the timestamps (ascending) of failed attempts. With 5 failures inside
 * the window the next attempt (the 6th) is blocked until the failure that keeps the count at 5 expires.
 */
export function evaluateRateLimit(failures: Date[], now: Date): RateLimitResult {
  const inWindow = failures.filter((f) => now.getTime() - f.getTime() < WINDOW_MS);
  if (inWindow.length < MAX_FAILURES) return { allowed: true };
  const blocker = inWindow[inWindow.length - MAX_FAILURES]!;
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((blocker.getTime() + WINDOW_MS - now.getTime()) / 1000),
  );
  return { allowed: false, retryAfterSeconds };
}

export async function checkLoginRateLimit(ip: string, now: Date): Promise<RateLimitResult> {
  const since = new Date(now.getTime() - WINDOW_MS);
  const failures = await loginAttempts.recentFailureTimes(ip, since);
  const perIp = evaluateRateLimit(failures, now);
  if (!perIp.allowed) return perIp;
  if ((await loginAttempts.countAllRecentFailures(since)) >= GLOBAL_MAX_FAILURES) {
    return { allowed: false, retryAfterSeconds: 60 };
  }
  return perIp;
}

/**
 * Client IP for rate limiting. Platform-set headers win (x-vercel-forwarded-for, x-real-ip); otherwise the
 * RIGHT-most x-forwarded-for hop, which is the one our own proxy appended: a client can prepend fake hops
 * but cannot control the last one. Falls back to "unknown".
 */
export function getClientIp(headers: Headers): string {
  const platform = headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  const real = headers.get("x-real-ip")?.trim();
  const hops = headers
    .get("x-forwarded-for")
    ?.split(",")
    .map((h) => h.trim())
    .filter(Boolean);
  const candidate = platform || real || hops?.[hops.length - 1] || "unknown";
  return candidate.slice(0, 45);
}

/** Backstop against IP rotation: failures across ALL addresses in one window. */
export const GLOBAL_MAX_FAILURES = 300;
