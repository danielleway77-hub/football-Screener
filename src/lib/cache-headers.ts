/**
 * Cache-Control for static files served from /public (unhashed names, so never `immutable`).
 * `/_next/static/*` is hashed and already gets `public, max-age=31536000, immutable` from Next itself.
 * HTML/API responses are NOT touched here (API handlers send `no-store` themselves).
 */
export const STATIC_ASSET_CACHE_CONTROL = "public, max-age=86400, stale-while-revalidate=604800";

export const STATIC_ASSET_SOURCES = [
  "/icons/:path*",
  "/icon.svg",
  "/apple-icon.png",
  "/opengraph-image.png",
  "/twitter-image.png",
] as const;

export function staticAssetHeaders(): {
  source: string;
  headers: { key: string; value: string }[];
}[] {
  return STATIC_ASSET_SOURCES.map((source) => ({
    source,
    headers: [{ key: "Cache-Control", value: STATIC_ASSET_CACHE_CONTROL }],
  }));
}
