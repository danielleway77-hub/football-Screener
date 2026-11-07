import { RateLimitedError } from "@/server/errors";
import { checkLoginRateLimit, getClientIp } from "@/server/auth/rate-limit";
import { createSession } from "@/server/auth/session";
import { handle, noContent, parseJson, readLimitedText, requireOwner } from "@/server/http";
import * as loginAttempts from "@/server/repositories/login-attempts";
import { changePassword } from "@/server/services/password-service";

/**
 * Changes the owner password. Wrong current passwords count against a separate rate-limit bucket
 * ("pw:" + ip). On success every other session is invalidated and THIS device gets a fresh cookie.
 */
export function POST(request: Request) {
  return handle(async () => {
    await requireOwner(request, { mutating: true });
    const body = parseJson(await readLimitedText(request, 2048));
    const key = `pw:${getClientIp(request.headers)}`;
    const now = new Date();
    const limit = await checkLoginRateLimit(key, now);
    if (!limit.allowed) {
      throw new RateLimitedError(limit.retryAfterSeconds);
    }
    // Count the attempt BEFORE verifying so parallel guesses cannot all slip under the limit.
    await loginAttempts.record(key, false, now);
    const { sessionVersion } = await changePassword(body);
    await loginAttempts.record(key, true, now);
    await createSession(sessionVersion);
    return noContent();
  });
}
