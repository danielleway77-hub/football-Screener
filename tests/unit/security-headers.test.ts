import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, securityHeaders } from "@/lib/security-headers";

// Step 16.1: header policy (the served headers are asserted on real pages/APIs in tests/e2e/security.spec.ts).
describe("security headers", () => {
  const map = (prod: boolean) =>
    Object.fromEntries(securityHeaders(prod).map((h) => [h.key, h.value]));

  it("CSP carries every ARCHITECTURE §9 directive", () => {
    const csp = contentSecurityPolicy(true);
    for (const d of [
      "default-src 'self'",
      "img-src 'self' data: https:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ]) {
      expect(csp).toContain(d);
    }
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toMatch(/\*(?![^;]*https:)/);
  });

  it("allows unsafe-eval only in dev", () => {
    expect(contentSecurityPolicy(false)).toContain("'unsafe-eval'");
  });

  it("sets nosniff, referrer, permissions and frame headers; HSTS only in production", () => {
    const prod = map(true);
    expect(prod["X-Content-Type-Options"]).toBe("nosniff");
    expect(prod["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(prod["Permissions-Policy"]).toContain("camera=()");
    expect(prod["X-Frame-Options"]).toBe("DENY");
    expect(prod["Strict-Transport-Security"]).toContain("max-age=");
    expect(map(false)["Strict-Transport-Security"]).toBeUndefined();
  });
});
