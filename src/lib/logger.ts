import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Structured server logger: one JSON object per line on stdout/stderr, level from LOG_LEVEL
 * (debug|info|warn|error, default info), automatic redaction, request id from async context.
 * Callers pass short messages plus small context objects; never payloads or secrets (redaction is a net,
 * not a licence).
 */
export type LogLevel = "debug" | "info" | "warn" | "error";
const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export const REDACTED = "[REDACTED]";
const SENSITIVE_KEY =
  /pass(word|wd)?|secret|token|cookie|authorization|auth|api[-_]?key|database_url|direct_url|connection[-_]?string|session|hash|credential/i;
const URL_CREDENTIALS = /\b([a-z][a-z0-9+.-]*:\/\/)[^\s/:@]+:[^\s/@]+@/gi;
const BEARER = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi;
const JWT = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/g;
const KEY_VALUE =
  /\b(password|passwd|secret|token|api[-_]?key|authorization|cookie|database_url|direct_url)\s*[=:]\s*[^\s,;&"']+/gi;

/** Scrubs secrets that appear inside free text (connection strings, bearer tokens, JWTs, key=value). */
export function redactString(value: string): string {
  return value
    .replace(URL_CREDENTIALS, `$1${REDACTED}@`)
    .replace(BEARER, `$1 ${REDACTED}`)
    .replace(JWT, REDACTED)
    .replace(KEY_VALUE, (_m, key: string) => `${key}=${REDACTED}`);
}

/** Deep, cycle-safe redaction by key name and by string content. Errors keep only name + redacted message. */
export function redact(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (typeof value === "string") return redactString(value);
  if (value === null || typeof value !== "object") return value;
  if (depth > 6) return "[Truncated]";
  if (seen.has(value)) return "[Circular]";
  seen.add(value);
  if (value instanceof Error) {
    return { name: value.name, message: redactString(value.message) };
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1, seen));
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) {
    out[key] = SENSITIVE_KEY.test(key) && v != null ? REDACTED : redact(v, depth + 1, seen);
  }
  return out;
}

const requestContext = new AsyncLocalStorage<{ requestId: string }>();

/** Runs `fn` with a request id attached to every log line written inside it. */
export function withRequestId<T>(requestId: string, fn: () => T): T {
  return requestContext.run({ requestId }, fn);
}

export function currentRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}

function threshold(): number {
  const raw = (process.env.LOG_LEVEL ?? "info").toLowerCase();
  return ORDER[raw as LogLevel] ?? ORDER.info;
}

export type LogContext = Record<string, unknown>;

function write(level: LogLevel, msg: string, context?: LogContext, requestId?: string): void {
  if (ORDER[level] < threshold()) return;
  const id = requestId ?? currentRequestId();
  const line = JSON.stringify({
    time: new Date().toISOString(),
    level,
    msg: redactString(msg),
    ...(id ? { requestId: id } : {}),
    ...(context ? (redact(context) as object) : {}),
  });
  (level === "error" || level === "warn" ? process.stderr : process.stdout).write(line + "\n");
}

export const logger = {
  debug: (msg: string, context?: LogContext) => write("debug", msg, context),
  info: (msg: string, context?: LogContext) => write("info", msg, context),
  warn: (msg: string, context?: LogContext) => write("warn", msg, context),
  error: (msg: string, context?: LogContext) => write("error", msg, context),
};
