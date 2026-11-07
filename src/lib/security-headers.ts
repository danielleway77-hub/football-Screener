/**
 * Security response headers (ARCHITECTURE §9). Pure so next.config.ts and the tests share one source.
 *
 * script-src keeps 'unsafe-inline' because Next injects inline bootstrap/flight scripts and nonces would force
 * every page to be dynamic (cacheComponents); framer-motion and GSAP write inline style attributes, hence
 * style-src 'unsafe-inline'. 'unsafe-eval' is added ONLY for the dev server (React refresh).
 * HSTS is emitted in production only (plain-http localhost must not pin it); Vercel also adds it at the edge.
 */
export function contentSecurityPolicy(isProd: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isProd ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export function securityHeaders(isProd: boolean): { key: string; value: string }[] {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(isProd) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    ...(isProd
      ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
      : []),
  ];
}
