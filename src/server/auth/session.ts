import { cookies } from "next/headers";
import {
  SESSION_MAX_AGE_SECONDS,
  sessionCookieName,
  signSessionToken,
  verifySessionToken,
} from "./jwt";

const secret = () => process.env.SESSION_SECRET ?? "";
const cookieName = () => sessionCookieName(process.env.NODE_ENV);

const baseOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
});

/** Sets the session cookie: httpOnly, SameSite=Lax, Path=/, Secure in production. */
export async function createSession(sessionVersion: number): Promise<void> {
  const token = await signSessionToken(sessionVersion, secret());
  (await cookies()).set(cookieName(), token, {
    ...baseOptions(),
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSession(): Promise<void> {
  (await cookies()).set(cookieName(), "", { ...baseOptions(), maxAge: 0 });
}

export async function readSessionClaims(): Promise<{ v: number } | null> {
  const token = (await cookies()).get(cookieName())?.value;
  return verifySessionToken(token, secret());
}
