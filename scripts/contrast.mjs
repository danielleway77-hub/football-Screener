// `pnpm contrast` — checks the WCAG contrast of the theme tokens in src/app/globals.css.
// Exit code 1 if any required pair fails. See docs/ThemeGuideline.md §2.6.
import { readFileSync } from "node:fs";
import { evaluate, parseRootTokens } from "./contrast-lib.mjs";

const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const results = evaluate(parseRootTokens(css));

const pad = (s, n) => String(s).padEnd(n);
console.log(
  pad("foreground", 20) + pad("background", 20) + pad("ratio", 9) + pad("needs", 8) + "result",
);
for (const r of results) {
  const needs = r.info ? "< 3" : `>= ${r.min}`;
  console.log(
    pad(r.fg, 20) +
      pad(r.bg, 20) +
      pad(r.ratio.toFixed(2), 9) +
      pad(needs, 8) +
      (r.pass ? "PASS" : "FAIL") +
      (r.info ? `  (${r.kind})` : ""),
  );
}
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} pairs pass`);
if (failed.length) {
  console.error(`${failed.length} pair(s) FAILED`);
  process.exit(1);
}
