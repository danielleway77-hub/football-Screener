import { jwtVerify, SignJWT } from "jose";

/**
 * Session token primitives. Edge-safe: only `jose`, no Node APIs, no database, no Next imports,
 * so `proxy.ts` can use them. HS256 signed with SESSION_SECRET; claims { v, iat, exp }.
 */
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export function sessionCookieName(nodeEnv: string | undefined): string {
  // `__Host-` requires Secure + Path=/, which plain http://localhost cannot provide (Safari).
  return nodeEnv === "production" ? "__Host-session" : "session";
}

const key = (secret: string) => new TextEncoder().encode(secret);

export async function signSessionToken(
  version: number,
  secret: string,
  now: Date = new Date(),
): Promise<string> {
  const iat = Math.floor(now.getTime() / 1000);
  return new SignJWT({ v: version })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(iat)
    .setExpirationTime(iat + SESSION_MAX_AGE_SECONDS)
    .sign(key(secret));
}

/** Returns the session version claim, or null for anything invalid (bad signature, expired, malformed). */
export async function verifySessionToken(
  token: string | undefined,
  secret: string,
  now: Date = new Date(),
): Promise<{ v: number } | null> {
  if (!token || !secret) return null;
  try {
    const { payload } = await jwtVerify(token, key(secret), {
      algorithms: ["HS256"],
      currentDate: now,
    });
    return typeof payload.v === "number" && Number.isInteger(payload.v) ? { v: payload.v } : null;
  } catch {
    return null;
  }
}
