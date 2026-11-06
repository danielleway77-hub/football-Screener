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
  const failures = await loginAttempts.recentFailureTimes(ip, new Date(now.getTime() - WINDOW_MS));
  return evaluateRateLimit(failures, now);
}

/** First hop of x-forwarded-for (set by the platform), then x-real-ip, else "unknown". */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const candidate = forwarded || headers.get("x-real-ip")?.trim() || "unknown";
  return candidate.slice(0, 45);
}
