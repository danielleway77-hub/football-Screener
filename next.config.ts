import type { NextConfig } from "next";
import { staticAssetHeaders } from "./src/lib/cache-headers";
import { securityHeaders } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // The dev badge floats over bottom-left buttons (save bar) and blocks e2e clicks; dev-only.
  devIndicators: false,
  partialPrefetching: true,
  // Do not advertise the framework (no `X-Powered-By: Next.js`).
  poweredByHeader: false,
  // gzip/br for HTML, JSON and static responses (Next default, stated so a reviewer sees it is deliberate).
  compress: true,
  // Sourcemaps for the browser are not shipped (smaller deploy, less source exposure).
  productionBrowserSourceMaps: false,
  // Default server output (Vercel packages it). Switch to "standalone" only for a Docker/self-host deploy.
  // optimizePackageImports was measured: Turbopack already rewrites barrel imports (identical bundle with and
  // without it), so it is deliberately not configured.
  // One header set for every response (src/lib/security-headers.ts: CSP, nosniff, Referrer-Policy, ...).
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders(process.env.NODE_ENV === "production") },
      ...staticAssetHeaders(),
    ];
  },
  turbopack: {
    // Watch only this project (sibling folders under the parent must not trigger recompiles).
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
