import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Step 15.6 guards for the §30 micro-details that live in CSS/markup (see
// docs/reference/ui-review/15.6/microdetails.md). Plain source reads: fast and deterministic.
const css = readFileSync("src/app/globals.css", "utf8");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? sourceFiles(p) : /\.(tsx?|css)$/.test(name) ? [p] : [];
  });
}
const files = sourceFiles("src").filter((f) => !f.includes("generated"));
const grep = (re: RegExp) =>
  files.filter((f) => re.test(readFileSync(f, "utf8"))).map((f) => f.replaceAll("\\", "/"));

describe("§30 global details present in globals.css", () => {
  const must: [string, RegExp][] = [
    ["#2 tap highlight", /-webkit-tap-highlight-color:\s*transparent/],
    ["#3 touch-action", /touch-action:\s*manipulation/],
    ["#5 scroll padding", /scroll-padding-top:\s*88px/],
    ["#6 scrollbar gutter", /scrollbar-gutter:\s*stable/],
    ["#6 thin scrollbars", /scrollbar-width:\s*thin/],
    ["#7 balance", /text-wrap:\s*balance/],
    ["#7 pretty", /text-wrap:\s*pretty/],
    ["#8 optical sizing", /font-optical-sizing:\s*auto/],
    ["#8 no synthesis", /font-synthesis:\s*none/],
    ["#8 legibility", /text-rendering:\s*optimizeLegibility/],
    ["#11 accent-color", /accent-color:\s*var\(--primary\)/],
    ["#11 caret-color", /caret-color:\s*var\(--primary\)/],
    ["#13 selection", /::selection/],
    ["#14 overscroll", /overscroll-behavior:\s*contain/],
    ["#20 not-allowed", /cursor:\s*not-allowed/],
    ["#21 underline offset", /text-underline-offset:\s*4px/],
    ["#23 reduced transparency", /@media \(prefers-reduced-transparency: reduce\)/],
    ["#28 content-visibility", /content-visibility:\s*auto/],
    ["#29 print", /@media print/],
    ["§31 prefers-contrast", /@media \(prefers-contrast: more\)/],
    ["§31 forced-colors", /@media \(forced-colors: active\)/],
    ["§35 ultra-wide", /@media \(min-width: 120rem\)/],
  ];
  for (const [name, re] of must) it(name, () => expect(css).toMatch(re));

  it("#24 smooth scroll only inside no-preference", () => {
    const smooth = [...css.matchAll(/scroll-behavior:\s*smooth/g)];
    expect(smooth).toHaveLength(1);

    expect(css).toMatch(
      /@media \(prefers-reduced-motion: no-preference\)\s*\{\s*html\s*\{\s*scroll-behavior:\s*smooth/,
    );
  });

  it("#10 focus styling only through :focus-visible (no bare :focus outline rule)", () => {
    expect(css).not.toMatch(/:focus\s*\{[^}]*outline/);
    expect(css).not.toMatch(/:focus(?!-)[^{,]*\{[^}]*outline:/);
  });

  it("§31 prefers-contrast values", () => {
    const block = css.slice(css.indexOf("@media (prefers-contrast: more)"));
    expect(block).toMatch(/--hairline:\s*rgba\(255, 255, 255, 0\.3\)/);
    expect(block).toMatch(/--hairline-strong:\s*rgba\(255, 255, 255, 0\.45\)/);
    expect(block).toMatch(/--border-control:\s*#8fa79b/);
    expect(block).toMatch(/--text-muted:\s*var\(--text\)/);
    expect(block).toMatch(/outline-width:\s*3px/);
  });

  it("§31 forced-colors uses system colours and an outline focus ring", () => {
    const block = css.slice(css.indexOf("@media (forced-colors: active)"));
    for (const c of ["Highlight", "CanvasText", "Canvas", "GrayText", "ButtonText"])
      expect(block).toContain(c);
    expect(block).toMatch(/outline:\s*3px solid Highlight/);
  });

  it("#29 print uses system colours, not hex", () => {
    const block = css.slice(css.indexOf("@media print"));
    expect(block).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});

describe("§30 grep guards over src/", () => {
  it("#16 no transition: all / transition-all", () => {
    expect(grep(/transition-all|transition:\s*all\b/)).toEqual([]);
  });
  it("#19 no 100vh / h-screen / min-h-screen", () => {
    expect(grep(/100vh|\bh-screen\b|\bmin-h-screen\b/)).toEqual([]);
  });
  it("#17 will-change only on the running sheen beam", () => {
    expect(grep(/will-change|willChange/)).toEqual(["src/app/globals.css"]);
    expect(css.match(/will-change/g)).toHaveLength(1);
    expect(css).toMatch(
      /\.card-sheen\[data-active="true"\] \.card-sheen-beam\s*\{[^}]*will-change/,
    );
  });
  it("#26 no user-select: all", () => {
    expect(grep(/user-select:\s*all|\bselect-all\b/)).toEqual([]);
  });
  it("no colour literals outside globals.css (tokens only)", () => {
    const allowed = new Set(["src/app/globals.css", "src/lib/brand.ts", "src/app/icon.svg"]);
    const hits = grep(/#[0-9a-fA-F]{6}\b|rgba?\(/).filter((f) => !allowed.has(f));
    expect(hits.filter((f) => !f.includes("(dev)"))).toEqual([]);
  });
  it("login GSAP is imported dynamically and only from LoginEntrance", () => {
    const users = grep(/from\s+["']gsap["']|import\(["']gsap["']\)|require\(["']gsap["']\)/);
    expect(users).toEqual(["src/components/auth/LoginEntrance.tsx"]);
    const src = readFileSync("src/components/auth/LoginEntrance.tsx", "utf8");
    expect(src).toMatch(/import\("gsap"\)/);
    expect(src).not.toMatch(/from\s+["']gsap["']/);
  });
});
