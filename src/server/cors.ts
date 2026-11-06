/**
 * CORS for /api/ingest only. Exact-match allow-list from INGEST_ALLOWED_ORIGINS; the Origin header is echoed
 * ONLY when it is on the list (never "*", never reflected blindly); no credentials. A request without an Origin
 * (userscript, curl) simply gets no CORS headers: the bearer token is the credential.
 */
export function allowedOrigins(): string[] {
  return (process.env.INGEST_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

export function corsHeaders(origin: string | null): Record<string, string> {
  const base = { Vary: "Origin" };
  if (origin && allowedOrigins().includes(origin)) {
    return { ...base, "Access-Control-Allow-Origin": origin };
  }
  return base;
}

export function preflight(request: Request): Response {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);
  if (!headers["Access-Control-Allow-Origin"]) {
    return new Response(null, {
      status: 403,
      headers: { ...headers, "Cache-Control": "no-store" },
    });
  }
  return new Response(null, {
    status: 204,
    headers: {
      ...headers,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "authorization, content-type",
      "Access-Control-Max-Age": "600",
      "Cache-Control": "no-store",
    },
  });
}
