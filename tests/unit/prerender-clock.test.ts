import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Cache Components rule (found by the functional audit: /runs logged "unstable value new Date() while
 * prerendering" on every request): a server component under src/app that reads the clock must first reach
 * request-time work, either `await connection()` before it or a database read before it.
 */
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) ? [p] : [];
  });
}

describe("server components that read the clock", () => {
  const roots = files(path.join(process.cwd(), "src", "app")).filter(
    (f) => !f.includes(`${path.sep}api${path.sep}`) && !f.includes("(dev)"),
  );
  for (const file of roots) {
    const src = readFileSync(file, "utf8");
    if (src.includes('"use client"') || !/new Date\(\)/.test(src)) continue;
    it(`${path.relative(process.cwd(), file)} reaches request time before new Date()`, () => {
      const clock = src.indexOf("new Date()");
      const marker = Math.min(
        ...[
          "await connection()",
          "await getSettings()",
          "await Promise.all(",
          "await ",
          "after the DB read",
        ]
          .map((m) => src.indexOf(m))
          .filter((i) => i >= 0),
      );
      expect(marker, "no request-time work before the clock read").toBeLessThan(clock);
      // A bare `await searchParams` is not enough on its own: /runs proved it.
      const before = src.slice(0, clock);
      const onlySearchParams =
        !/await connection\(\)|await get[A-Z]|await Promise\.all|await [a-z]+\.[a-zA-Z]+\(/.test(
          before,
        );
      expect(onlySearchParams, "only `await searchParams` precedes new Date()").toBe(false);
    });
  }
});
