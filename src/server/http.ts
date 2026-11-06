import { hasValidSession } from "@/server/auth/guard";
import { isSameOrigin } from "@/server/auth/origin";
import { AppError, RateLimitedError, toErrorBody } from "@/server/errors";

/** Shared helpers for thin route handlers: consistent JSON, error mapping, auth and body limits. */

export const NO_STORE = { "Cache-Control": "no-store" } as const;

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { ...NO_STORE, ...headers } });
}

export function noContent(headers: Record<string, string> = {}): Response {
  return new Response(null, { status: 204, headers: { ...NO_STORE, ...headers } });
}

export function errorResponse(error: AppError, headers: Record<string, string> = {}): Response {
  return json(toErrorBody(error), error.status, headers);
}

/** Runs a handler and maps failures to the standard error body. Never leaks messages or stack traces of unknown errors. */
export async function handle(run: () => Promise<Response>, headers: Record<string, string> = {}) {
  try {
    return await run();
  } catch (error) {
    if (error instanceof AppError) {
      const retry: Record<string, string> =
        error instanceof RateLimitedError ? { "Retry-After": String(error.retryAfterSeconds) } : {};
      return errorResponse(error, { ...headers, ...retry });
    }
    console.error("Unhandled API error", { name: error instanceof Error ? error.name : "unknown" });
    return errorResponse(new AppError("INTERNAL", "Something went wrong. Try again."), headers);
  }
}

/**
 * Session-protected route guard. The proxy only checks the JWT signature; here the sessionVersion is
 * compared too (so "log out everywhere" works). Mutating routes also require a same-origin request.
 */
export async function requireOwner(request: Request, opts: { mutating: boolean }): Promise<void> {
  if (!(await hasValidSession())) throw new AppError("UNAUTHORIZED", "Sign in required.");
  if (opts.mutating && !isSameOrigin(request)) {
    throw new AppError("FORBIDDEN", "Cross-origin request refused.");
  }
}

/** Reads a request body with a hard cap, checking content-length first AND counting streamed bytes. */
export async function readLimitedText(request: Request, maxBytes: number): Promise<string> {
  const tooLarge = () => new AppError("PAYLOAD_TOO_LARGE", "That request is too large.");
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > maxBytes) throw tooLarge();
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw tooLarge();
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

/** Maps a finished run to the HTTP answer for ingest/import (409 busy, 422 nothing usable, 500 storage failure). */
export function runResponse(
  result: {
    runId: string;
    status: string;
    scanned: number;
    qualified: number;
    failed: number;
    error?: string | null;
    reasons?: { index: number; id?: string; reason: string }[];
    alreadyRunning?: boolean;
  },
  headers: Record<string, string> = {},
): Response {
  if (result.alreadyRunning) {
    throw new AppError("RUN_IN_PROGRESS", "Another update is running. Try again in a minute.");
  }
  if (result.status === "FAILED") {
    if (result.failed > 0) {
      return json(
        {
          error: { code: "VALIDATION_FAILED", message: result.error ?? "No valid matches." },
          runId: result.runId,
          scanned: result.scanned,
          failed: result.failed,
          reasons: result.reasons ?? [],
        },
        422,
        headers,
      );
    }
    throw new AppError("INTERNAL", result.error ?? "Something went wrong. Try again.");
  }
  return json(
    {
      runId: result.runId,
      status: result.status,
      scanned: result.scanned,
      qualified: result.qualified,
      failed: result.failed,
      reasons: result.reasons ?? [],
    },
    200,
    headers,
  );
}

export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError("VALIDATION_FAILED", "The request body is not valid JSON.");
  }
}
