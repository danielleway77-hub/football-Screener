/** CSRF defence for mutating session routes: the browser-sent Origin must match this site. */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const allowed = new Set([new URL(request.url).origin]);
    if (process.env.NEXT_PUBLIC_APP_URL) {
      allowed.add(new URL(process.env.NEXT_PUBLIC_APP_URL).origin);
    }
    return allowed.has(new URL(origin).origin);
  } catch {
    return false;
  }
}
