import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // The dev badge floats over bottom-left buttons (save bar) and blocks e2e clicks; dev-only.
  devIndicators: false,
  partialPrefetching: true,
  poweredByHeader: false,
  // One header set for every response (src/lib/security-headers.ts: CSP, nosniff, Referrer-Policy, ...).
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders(process.env.NODE_ENV === "production") }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
