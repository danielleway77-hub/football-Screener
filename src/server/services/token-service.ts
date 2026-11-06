import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { MAX_ACTIVE_TOKENS } from "@/lib/schemas/settings";
import { AppError } from "@/server/errors";
import * as tokens from "@/server/repositories/tokens";
import type { TokenRecord } from "@/server/repositories/types";

export const TOKEN_PREFIX = "scr_";

export type PublicToken = {
  id: string;
  label: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
};

export const hashToken = (plaintext: string): string =>
  createHash("sha256").update(plaintext).digest("hex");

const toPublic = (t: TokenRecord): PublicToken => ({
  id: t.id,
  label: t.label,
  createdAt: t.createdAt,
  lastUsedAt: t.lastUsedAt,
  revokedAt: t.revokedAt,
});

/** Creates a token. The plaintext is returned ONCE here; only its sha256 hash is stored. */
export async function createToken(
  label: string,
): Promise<{ id: string; label: string; token: string }> {
  const clean = label.trim();
  if (clean.length < 1 || clean.length > 40) {
    throw new AppError("VALIDATION_FAILED", "Label must be 1–40 characters.", {
      label: "Label must be 1–40 characters.",
    });
  }
  if ((await tokens.countActive()) >= MAX_ACTIVE_TOKENS) {
    throw new AppError(
      "VALIDATION_FAILED",
      `You can have up to ${MAX_ACTIVE_TOKENS} active tokens. Revoke one first.`,
      { label: `You can have up to ${MAX_ACTIVE_TOKENS} active tokens. Revoke one first.` },
    );
  }
  const token = TOKEN_PREFIX + randomBytes(32).toString("base64url");
  const row = await tokens.create(clean, hashToken(token));
  return { id: row.id, label: row.label, token };
}

export async function listTokens(): Promise<PublicToken[]> {
  return (await tokens.list()).map(toPublic);
}

/** Revokes a token. Idempotent: revoking again keeps the original time; unknown id → NOT_FOUND. */
export async function revokeToken(id: string, now: Date = new Date()): Promise<PublicToken> {
  const row = await tokens.revoke(id, now);
  if (!row) throw new AppError("NOT_FOUND", "Token not found.");
  return toPublic(row);
}

/**
 * Checks `Authorization: Bearer <token>`. Returns the token id, or throws UNAUTHORIZED with ONE generic
 * message for every failure (missing, malformed, unknown, revoked). The hash comparison is constant-time.
 */
export async function authenticateBearer(
  header: string | null,
  now: Date = new Date(),
): Promise<{ tokenId: string }> {
  const fail = () => new AppError("UNAUTHORIZED", "Invalid or missing token.");
  const match = /^Bearer (scr_[A-Za-z0-9_-]{20,100})$/.exec(header ?? "");
  if (!match) throw fail();
  const hash = hashToken(match[1]!);
  const row = await tokens.findByHash(hash);
  if (!row || row.revokedAt) throw fail();
  const a = Buffer.from(hash);
  const b = Buffer.from(row.tokenHash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw fail();
  await tokens.touch(row.id, now);
  return { tokenId: row.id };
}
