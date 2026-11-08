/**
 * Typed client-side fetch wrapper (docs/ApplicationFlow.md §9–§10, CODING_STANDARDS §7).
 *  - 15 s timeout via AbortController
 *  - retries ONLY idempotent GETs on network errors and 502/503/504 (max 2, exponential + jitter)
 *  - maps `{ error: { code, message, fieldErrors } }` bodies into `AppClientError`
 *  - detects "offline" without hammering the network
 *  - 401 → login redirect (injectable so it can be tested)
 *  - never logs request/response bodies
 */

export type FieldErrors = Record<string, string[]>;

export type ClientErrorCode =
  | "OFFLINE"
  | "TIMEOUT"
  | "ABORTED"
  | "NETWORK"
  | "UNAUTHORIZED"
  | "VALIDATION_FAILED"
  | "RATE_LIMITED"
  | "PAYLOAD_TOO_LARGE"
  | "MODE_NOT_SUPPORTED"
  | "PROVIDER_NOT_CONFIGURED"
  | "RUN_IN_PROGRESS"
  | "NOT_FOUND"
  | "INTERNAL"
  | (string & {});

export class AppClientError extends Error {
  constructor(
    readonly code: ClientErrorCode,
    message: string,
    readonly status?: number,
    readonly fieldErrors?: FieldErrors,
    readonly retryAfterSeconds?: number,
    /** The parsed JSON error body (e.g. the per-item `reasons` of a 422 import), when there was one. */
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "AppClientError";
  }
}

export type FetchOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Max retries for idempotent GETs (default 2). */
  retries?: number;
  /** Delay before retry n (ms). Default [400, 1200] + jitter; tests pass [0, 0]. */
  retryDelaysMs?: number[];
};

const DEFAULT_TIMEOUT_MS = 15_000;
const RETRY_STATUSES = new Set([502, 503, 504]);

let redirecting = false;
let unauthorizedHandler: () => void = () => {
  if (typeof window === "undefined" || redirecting) return; // several 401s at once redirect once
  redirecting = true;
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  // Intentional hard navigation: a full page load clears all client state after the session ends.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`/login?next=${next}`);
};

/** Replace the 401 behaviour (tests, or the app shell). Returns the previous handler. */
export function setUnauthorizedHandler(handler: () => void): () => void {
  const previous = unauthorizedHandler;
  unauthorizedHandler = handler;
  return previous;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** "Try again in 3 minutes." from a Retry-After value in seconds (falls back to "in a few minutes"). */
export function waitText(retryAfterSeconds?: number): string {
  if (!retryAfterSeconds || retryAfterSeconds <= 0) return "in a few minutes";
  if (retryAfterSeconds < 60) return `in ${Math.ceil(retryAfterSeconds)} seconds`;
  const minutes = Math.ceil(retryAfterSeconds / 60);
  return `in ${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}

function friendlyMessage(
  code: ClientErrorCode,
  status?: number,
  retryAfterSeconds?: number,
): string {
  switch (code) {
    case "OFFLINE":
      return "You're offline. Reconnect and try again.";
    case "TIMEOUT":
      return "This is taking longer than usual. Try again.";
    case "NETWORK":
      return "Couldn't reach the server. Check your connection and try again.";
    case "UNAUTHORIZED":
      return "Your session has expired. Sign in again.";
    case "RATE_LIMITED":
      return `Too many attempts. Try again ${waitText(retryAfterSeconds)}.`;
    case "PAYLOAD_TOO_LARGE":
      return "That file is too large (max 1 MB).";
    case "VALIDATION_FAILED":
      return "Some details aren't valid. Check the highlighted fields and try again.";
    case "NOT_FOUND":
      return "That item no longer exists.";
    default:
      return status && status >= 500
        ? "Something went wrong on our side. Try again."
        : "We couldn't complete that. Try again.";
  }
}

async function toError(res: Response): Promise<AppClientError> {
  let code: ClientErrorCode = "INTERNAL";
  let message: string | undefined;
  let fieldErrors: FieldErrors | undefined;
  let parsedBody: unknown;
  try {
    const body = (await res.json()) as {
      error?: { code?: string; message?: string; fieldErrors?: FieldErrors };
    };
    parsedBody = body;
    if (body?.error) {
      code = body.error.code ?? code;
      message = body.error.message;
      // The server sends `{ field: "message" }`; accept `{ field: ["message"] }` too.
      const raw = body.error.fieldErrors as Record<string, string | string[]> | undefined;
      if (raw && typeof raw === "object") {
        fieldErrors = Object.fromEntries(
          Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v : [String(v)]]),
        );
      }
    }
  } catch {
    // Non-JSON error body: fall back to the status code.
  }
  if (res.status === 401) code = "UNAUTHORIZED";
  else if (res.status === 429) code = "RATE_LIMITED";
  else if (res.status === 413) code = "PAYLOAD_TOO_LARGE";
  else if (res.status === 404 && code === "INTERNAL") code = "NOT_FOUND";
  else if (res.status === 422 && code === "INTERNAL") code = "VALIDATION_FAILED";
  const retryHeader = Number(res.headers.get("retry-after"));
  const retryAfter = Number.isFinite(retryHeader) && retryHeader > 0 ? retryHeader : undefined;
  // 429 always uses the readable wait time (the server's own wording may be generic).
  const text = code === "RATE_LIMITED" ? friendlyMessage(code, res.status, retryAfter) : message;
  return new AppClientError(
    code,
    text ?? friendlyMessage(code, res.status, retryAfter),
    res.status,
    fieldErrors,
    retryAfter,
    parsedBody,
  );
}

export async function fetchJson<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  const idempotent = method === "GET";
  const maxRetries = idempotent ? (options.retries ?? 2) : 0;
  const delays = options.retryDelaysMs ?? [400, 1200];
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new AppClientError("OFFLINE", friendlyMessage("OFFLINE"));
  }

  for (let attempt = 0; ; attempt++) {
    if (options.signal?.aborted) throw new AppClientError("ABORTED", "The request was cancelled.");
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const onAbort = () => controller.abort();
    options.signal?.addEventListener("abort", onAbort);

    try {
      const res = await fetch(url, {
        method,
        headers: {
          ...(options.body !== undefined ? { "content-type": "application/json" } : {}),
          ...options.headers,
        },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      if (res.ok) {
        return (res.status === 204 ? undefined : await res.json()) as T;
      }
      if (RETRY_STATUSES.has(res.status) && attempt < maxRetries) {
        await sleep((delays[attempt] ?? 1200) + (delays[attempt] ? Math.random() * 100 : 0));
        continue;
      }
      const error = await toError(res);
      if (error.code === "UNAUTHORIZED") unauthorizedHandler();
      throw error;
    } catch (error) {
      if (error instanceof AppClientError) throw error;
      if (timedOut) throw new AppClientError("TIMEOUT", friendlyMessage("TIMEOUT"));
      if (options.signal?.aborted)
        throw new AppClientError("ABORTED", "The request was cancelled.");
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        throw new AppClientError("OFFLINE", friendlyMessage("OFFLINE"));
      }
      if (attempt < maxRetries) {
        await sleep((delays[attempt] ?? 1200) + (delays[attempt] ? Math.random() * 100 : 0));
        continue;
      }
      throw new AppClientError("NETWORK", friendlyMessage("NETWORK"));
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onAbort);
    }
  }
}
