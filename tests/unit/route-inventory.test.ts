import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Step 16.1: a NEW route handler or page that is not guarded fails this test (docs/TESTING_STANDARDS §5b).
const APP = path.resolve(import.meta.dirname, "../../src/app");
const rel = (f: string) => path.relative(APP.replaceAll("\\", "/"), f).replaceAll("\\", "/");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}
const files = walk(APP).map((f) => f.replaceAll("\\", "/"));

/** Guards a handler may use: owner session, ingest bearer token, cron secret. */
const GUARDS = ["requireOwner(", "authenticateBearer(", "isValidCronAuth("];

/** Handlers that are public on purpose, each with the reason and the control that replaces a session. */
const PUBLIC_HANDLERS: Record<string, string> = {
  "api/auth/login/route.ts:POST": "login: same-origin + rate limit + password",
  "api/auth/logout/route.ts:POST": "logout: same-origin check, only clears the caller's cookie",
  "api/health/route.ts:GET": "health: {ok, db} only; details need a session",
  "api/ingest/route.ts:OPTIONS": "CORS preflight, answers only allow-listed origins",
};

/** Splits a route file into its exported HTTP handlers and their source text. */
export function handlersOf(source: string): { method: string; body: string }[] {
  const re = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\b/g;
  const hits = [...source.matchAll(re)];
  return hits.map((m, i) => ({
    method: m[1]!,
    body: source.slice(m.index!, hits[i + 1]?.index ?? source.length),
  }));
}

describe("route inventory", () => {
  const routes = files.filter((f) => /[\/]route\.ts$/.test(f));

  it("finds the API surface (guards against the scanner silently matching nothing)", () => {
    expect(routes.length).toBeGreaterThanOrEqual(12);
    expect(routes.flatMap((f) => handlersOf(readFileSync(f, "utf8"))).length).toBeGreaterThan(14);
  });

  it("no route exports handlers through patterns the scanner cannot see", () => {
    for (const f of routes) {
      const src = readFileSync(f, "utf8");
      expect(src, rel(f)).not.toMatch(/export\s+const\s+(GET|POST|PUT|PATCH|DELETE)\b/);
      expect(src, rel(f)).not.toMatch(/export\s*\{[^}]*\b(GET|POST|PUT|PATCH|DELETE)\b/);
      expect(handlersOf(src).length, rel(f)).toBeGreaterThan(0);
    }
  });

  it("every route handler uses requireOwner / bearer / cron-secret auth, or is allow-listed as public", () => {
    const unguarded: string[] = [];
    const seenPublic = new Set<string>();
    for (const f of routes) {
      for (const h of handlersOf(readFileSync(f, "utf8"))) {
        const key = `${rel(f)}:${h.method}`;
        if (key in PUBLIC_HANDLERS) seenPublic.add(key);
        else if (!GUARDS.some((g) => h.body.includes(g))) unguarded.push(key);
      }
    }
    expect(unguarded).toEqual([]);
    expect([...seenPublic].sort()).toEqual(Object.keys(PUBLIC_HANDLERS).sort()); // no stale entries
  });

  it("mutating session handlers require the same-origin check", () => {
    for (const f of routes) {
      for (const h of handlersOf(readFileSync(f, "utf8"))) {
        if (!h.body.includes("requireOwner(") || h.method === "GET") continue;
        expect(h.body, `${rel(f)}:${h.method}`).toMatch(/requireOwner\([^)]*mutating:\s*true/);
      }
    }
  });

  it("every page outside (app) is explicitly public; (app) pages sit behind the session layout", () => {
    const pages = files.filter((f) => /[\/]page\.tsx$/.test(f)).map(rel);
    const outside = pages.filter((p) => !p.startsWith("(app)/"));
    expect(outside.sort()).toEqual(
      [
        "(auth)/login/page.tsx",
        ...pages.filter((p) => p.startsWith("(dev)/style-guide")), // 404 in production
      ].sort(),
    );
    const layout = readFileSync(path.join(APP, "(app)/layout.tsx"), "utf8");
    expect(layout).toContain("requireSession()");
    expect(pages.filter((p) => p.startsWith("(app)/")).length).toBeGreaterThanOrEqual(5);
    for (const p of pages.filter((p) => p.startsWith("(dev)/"))) {
      // The index page and every sub-page of the style guide must 404 in production.
      expect(readFileSync(path.join(APP, p), "utf8"), p).toMatch(
        /NODE_ENV === "production"\) notFound\(\)|notFound\(\)/,
      );
    }
  });

  it("the proxy exposes only the expected public roots", () => {
    const proxy = readFileSync(path.resolve(APP, "../proxy.ts"), "utf8");
    const roots = /PUBLIC_ROOTS = \[([^\]]*)\]/.exec(proxy)![1]!;
    expect(roots.replace(/\s/g, "")).toBe(
      '"/api/auth","/api/health","/api/cron","/api/ingest","/style-guide"',
    );
  });
});
