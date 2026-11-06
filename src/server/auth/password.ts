import bcrypt from "bcryptjs";
import * as credentials from "@/server/repositories/credentials";

/** A real bcrypt hash (cost 12) of a random string, built once; compared against when no hash is configured so timing matches. */
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= bcrypt.hash(crypto.randomUUID(), 12));

export const BCRYPT_COST = 12;

/** Pure: compare a plaintext password with a hash (or run a dummy compare when there is none). */
export async function verifyPasswordAgainst(
  plain: string,
  hash: string | null | undefined,
): Promise<boolean> {
  if (!hash) {
    await bcrypt.compare(plain, await getDummyHash());
    return false;
  }
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

/** The Credential row (set on password change) wins over APP_PASSWORD_HASH from the environment. */
export async function verifyPassword(plain: string): Promise<boolean> {
  const override = await credentials.getPasswordHash();
  return verifyPasswordAgainst(plain, override ?? process.env.APP_PASSWORD_HASH ?? null);
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}
