import { NextResponse, type NextRequest } from "next/server";
import { sanitizeNext } from "@/lib/next-param";
import { sessionCookieName, verifySessionToken } from "@/server/auth/jwt";

/**
 * Network-boundary auth check: thin and stateless (no database). It verifies the session JWT signature
 * and expiry only; the sessionVersion comparison needs the database and happens in Node via
 * requireSession() (see src/server/auth/guard.ts).
 */
const PUBLIC_PAGES = ["/login"];
// Dev-only demo routes (they return 404 in production builds) are public so they can be inspected.
const PUBLIC_ROOTS = ["/api/auth", "/api/health", "/api/cron", "/api/ingest", "/style-guide"];

/** Exact root or a real sub-path: "/api/ingest" and "/api/ingest/x" match, "/api/ingestX" does not. */
function isPublic(pathname: string): boolean {
  return (
    PUBLIC_PAGES.includes(pathname) ||
    PUBLIC_ROOTS.some((root) => pathname === root || pathname.startsWith(root + "/"))
  );
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(sessionCookieName(process.env.NODE_ENV))?.value;
  const valid = (await verifySessionToken(token, process.env.SESSION_SECRET ?? "")) !== null;

  if (pathname === "/login") {
    // Already signed in: skip the form. `?expired=1` is set when the version no longer matches.
    if (valid && !request.nextUrl.searchParams.has("expired")) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (isPublic(pathname) || valid) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Sign in required." } },
      { status: 401 },
    );
  }
  const login = new URL("/login", request.url);
  const next = sanitizeNext(pathname + search);
  login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|robots.txt|icons/).*)",
  ],
};
