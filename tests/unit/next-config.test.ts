import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("next.config hardening", () => {
  it("hides the framework and keeps compression on", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
    expect(nextConfig.compress).toBe(true);
    expect(nextConfig.productionBrowserSourceMaps).toBe(false);
  });
  it("sends security headers for every path and a revalidating cache for unhashed static assets", async () => {
    const rules = await nextConfig.headers!();
    const all = rules.find((r) => r.source === "/:path*")!;
    expect(all.headers.map((h) => h.key)).toEqual(
      expect.arrayContaining([
        "Content-Security-Policy",
        "X-Content-Type-Options",
        "X-Frame-Options",
      ]),
    );
    const icons = rules.find((r) => r.source === "/icons/:path*")!;
    const cache = icons.headers.find((h) => h.key === "Cache-Control")!.value;
    expect(cache).toContain("max-age=86400");
    expect(cache).not.toContain("immutable");
  });
});
