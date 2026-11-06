import { passwordChangeSchema } from "@/lib/schemas/settings";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { AppError } from "@/server/errors";
import * as credentials from "@/server/repositories/credentials";

/**
 * Changes the owner password. Verifies the current one first, stores a bcrypt hash in the Credential row
 * (it overrides APP_PASSWORD_HASH) and bumps Setting.sessionVersion in the same transaction, so every
 * OTHER session stops working. Returns the new session version: the caller re-issues the current cookie.
 * Passwords are never logged or returned.
 */
export async function changePassword(input: unknown): Promise<{ sessionVersion: number }> {
  const parsed = passwordChangeSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0] ?? "password")] ??= issue.message;
    }
    throw new AppError("VALIDATION_FAILED", "Check the highlighted fields.", fieldErrors);
  }
  const { currentPassword, newPassword } = parsed.data;
  if (!(await verifyPassword(currentPassword))) {
    throw new AppError("VALIDATION_FAILED", "The current password is not correct.", {
      currentPassword: "The current password is not correct.",
    });
  }
  const sessionVersion = await credentials.replacePasswordAndBumpSessions(
    await hashPassword(newPassword),
  );
  return { sessionVersion };
}
