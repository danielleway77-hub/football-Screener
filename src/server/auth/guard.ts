import { redirect } from "next/navigation";
import { getSettings } from "@/server/repositories/settings";
import { readSessionClaims } from "./session";

/**
 * Node-side session check: the JWT is valid AND its version equals Setting.sessionVersion (so
 * "log out all devices" works). Server components cannot modify cookies, so a mismatch redirects
 * to /login?expired=1 (the proxy does not bounce that URL back to "/"); signing in overwrites the cookie.
 */
export async function requireSession(): Promise<{ v: number }> {
  const claims = await readSessionClaims();
  if (!claims) redirect("/login");
  const settings = await getSettings();
  if (claims.v !== settings.sessionVersion) redirect("/login?expired=1");
  return claims;
}

/** For route handlers: returns false instead of redirecting. */
export async function hasValidSession(): Promise<boolean> {
  const claims = await readSessionClaims();
  if (!claims) return false;
  return claims.v === (await getSettings()).sessionVersion;
}
