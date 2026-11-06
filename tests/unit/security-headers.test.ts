import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("next.config security headers", () => {
  it("applies the baseline headers to every path", async () => {
    const rules = await nextConfig.headers!();
    expect(rules).toHaveLength(1);
    expect(rules[0]!.source).toBe("/:path*");
    const names = rules[0]!.headers.map((h) => h.key.toLowerCase());
    for (const required of [
      "x-content-type-options",
      "x-frame-options",
      "referrer-policy",
      "permissions-policy",
      "content-security-policy",
      "cross-origin-opener-policy",
    ]) {
      expect(names).toContain(required);
    }
    const csp = rules[0]!.headers.find((h) => h.key === "Content-Security-Policy")!.value;
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });
});
