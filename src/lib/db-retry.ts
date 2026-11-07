import { logger } from "@/lib/logger";

/**
 * Retry-once wrapper for READ queries only. Never use it for writes or transactions: a write that failed
 * after the server applied it would be applied twice. Only transient connection failures are retried
 * (reset/refused/timeout/terminated connections, Prisma P1001/P1002/P1008/P1017/P2024); logic errors
 * (constraint, validation, syntax) fail immediately.
 */
const TRANSIENT_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EPIPE",
  "ENOTFOUND",
  "EAI_AGAIN",
  "57P01", // admin_shutdown
  "57P03", // cannot_connect_now
  "08000",
  "08003",
  "08006",
  "P1001",
  "P1002",
  "P1008",
  "P1017",
  "P2024", // pool timeout
]);
const TRANSIENT_MESSAGE =
  /connection (terminated|timeout|refused|reset|closed)|terminating connection|server closed the connection|timeout exceeded when trying to connect|ECONNRESET/i;

export function isTransientDbError(error: unknown, depth = 0): boolean {
  if (!error || typeof error !== "object" || depth > 3) return false;
  const e = error as { code?: unknown; message?: unknown; cause?: unknown };
  if (typeof e.code === "string" && TRANSIENT_CODES.has(e.code)) return true;
  if (typeof e.message === "string" && TRANSIENT_MESSAGE.test(e.message)) return true;
  return isTransientDbError(e.cause, depth + 1);
}

export const READ_RETRY_DELAY_MS = 150;

export async function readQuery<T>(
  run: () => Promise<T>,
  opts: { delayMs?: number } = {},
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (!isTransientDbError(error)) throw error;
    logger.warn("Transient database error on a read; retrying once", {
      name: error instanceof Error ? error.name : "unknown",
    });
    await new Promise((resolve) => setTimeout(resolve, opts.delayMs ?? READ_RETRY_DELAY_MS));
    return run();
  }
}
