import { z } from "zod";
import { isSameOrigin } from "@/server/auth/origin";
import { verifyPassword } from "@/server/auth/password";
import { checkLoginRateLimit, getClientIp } from "@/server/auth/rate-limit";
import { createSession } from "@/server/auth/session";
import * as loginAttempts from "@/server/repositories/login-attempts";
import { getSettings } from "@/server/repositories/settings";
import { readLimitedText } from "@/server/http";
import { loginSchema } from "@/lib/schemas/login";

const MAX_BODY_BYTES = 1024;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function json(status: number, body: unknown, headers?: Record<string, string>) {
  return Response.json(body, { status, headers });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return json(403, { error: { code: "FORBIDDEN", message: "Cross-origin request refused." } });
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return json(415, { error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "Send JSON." } });
  }
  let text: string;
  try {
    // Capped while streaming: an oversized body is never buffered in full.
    text = await readLimitedText(request, MAX_BODY_BYTES);
  } catch {
    return json(413, { error: { code: "PAYLOAD_TOO_LARGE", message: "Request too large." } });
  }
  let parsed: z.infer<typeof loginSchema>;
  try {
    parsed = loginSchema.parse(JSON.parse(text));
  } catch {
    return json(400, { error: { code: "VALIDATION", message: "Enter your password." } });
  }

  const ip = getClientIp(request.headers);
  const now = new Date();
  const limit = await checkLoginRateLimit(ip, now);
  if (!limit.allowed) {
    return json(
      429,
      {
        error: {
          code: "RATE_LIMITED",
          message: "Too many attempts.",
          retryAfterSeconds: limit.retryAfterSeconds,
        },
      },
      { "Retry-After": String(limit.retryAfterSeconds) },
    );
  }

  const ok = await verifyPassword(parsed.password);
  await loginAttempts.record(ip, ok, now);
  // Opportunistic cleanup of old attempts (1 in 20 requests).
  if (Math.random() < 0.05) {
    await loginAttempts.purge(new Date(now.getTime() - 30 * 24 * 60 * 60_000)).catch(() => 0);
  }

  if (!ok) {
    await sleep(250 + Math.random() * 150); // uniform delay on failure
    // Same generic answer for a wrong password and for a missing configuration.
    return json(401, { error: { code: "INVALID_CREDENTIALS", message: "Incorrect password" } });
  }

  await createSession((await getSettings()).sessionVersion);
  return new Response(null, { status: 204 });
}
