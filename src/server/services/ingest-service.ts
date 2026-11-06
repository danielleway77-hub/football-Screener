import { RateLimitedError } from "@/server/errors";
import * as rateLimits from "@/server/repositories/rate-limits";

export const INGEST_LIMIT_PER_HOUR = 30;

/** Fixed-window limit per token: the 31st request inside one clock hour is refused with Retry-After. */
export async function enforceIngestRateLimit(tokenId: string, now: Date): Promise<void> {
  const windowStart = new Date(now);
  windowStart.setUTCMinutes(0, 0, 0);
  const key = `ingest:${tokenId}:${windowStart.toISOString().slice(0, 13)}`;
  const count = await rateLimits.increment(key, windowStart);
  if (count > INGEST_LIMIT_PER_HOUR) {
    const retryAfter = Math.max(
      1,
      Math.ceil((windowStart.getTime() + 3_600_000 - now.getTime()) / 1000),
    );
    throw new RateLimitedError(retryAfter);
  }
}
