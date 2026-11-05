// WCAG 2.x contrast helpers + the required token pairs from docs/ThemeGuideline.md §2.6.
// Pure functions (no I/O) so they can be unit tested; the CLI is scripts/contrast.mjs.

/** Parse the custom properties declared in the first `:root { ... }` block of a CSS string. */
export function parseRootTokens(css) {
  const start = css.indexOf(":root {");
  if (start === -1) throw new Error("No :root block found");
  const end = css.indexOf("\n}", start);
  const block = css.slice(start, end);
  const tokens = {};
  const re = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = re.exec(block))) tokens[m[1]] = m[2].trim().replace(/\s+/g, " ");
  return tokens;
}

/** Parse #rgb/#rrggbb or rgb()/rgba() into {r,g,b,a}; returns null for anything else. */
export function parseColor(value) {
  const v = value.trim();
  let m = v.match(/^#([0-9a-f]{3})$/i);
  if (m) {
    const [r, g, b] = m[1].split("").map((c) => parseInt(c + c, 16));
    return { r, g, b, a: 1 };
  }
  m = v.match(/^#([0-9a-f]{6})$/i);
  if (m) {
    const n = parseInt(m[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  m = v.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
  return null;
}

/** Resolve `var(--x)` references against the token map. */
export function resolve(value, tokens, depth = 0) {
  if (depth > 5) throw new Error("var() cycle: " + value);
  const m = value.match(/^var\((--[\w-]+)\)$/);
  if (!m) return value;
  const next = tokens[m[1]];
  if (next === undefined) throw new Error("Unknown token " + m[1]);
  return resolve(next, tokens, depth + 1);
}

/** Composite a (possibly translucent) colour over an opaque background. */
export function composite(fg, bg) {
  const a = fg.a;
  return {
    r: fg.r * a + bg.r * (1 - a),
    g: fg.g * a + bg.g * (1 - a),
    b: fg.b * a + bg.b * (1 - a),
    a: 1,
  };
}

export function luminance({ r, g, b }) {
  const [R, G, B] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

export function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT_ON = ["--bg-base", "--surface", "--surface-raised", "--surface-overlay"];

/** Required pairs. min = WCAG threshold; `info` pairs are reported but never fail. */
export function requiredPairs() {
  const pairs = [];
  for (const fg of ["--text", "--text-muted", "--text-faint"]) {
    for (const bg of TEXT_ON) pairs.push({ fg, bg, min: 4.5, kind: "text" });
  }
  for (const bg of ["--bg-base", "--surface"])
    pairs.push({ fg: "--primary", bg, min: 4.5, kind: "accent" });
  pairs.push({ fg: "--text-on-accent", bg: "--primary", min: 4.5, kind: "on accent" });
  for (const fg of ["--positive", "--negative", "--warning", "--info", "--violet"]) {
    pairs.push({ fg, bg: "--surface", min: 4.5, kind: "semantic" });
  }
  for (const bg of ["--bg-subtle", "--surface"])
    pairs.push({ fg: "--border-control", bg, min: 3, kind: "control outline" });
  pairs.push({ fg: "--primary", bg: "--bg-base", min: 3, kind: "focus ring" });
  pairs.push({
    fg: "--primary",
    bg: "--negative",
    min: 0,
    kind: "info: lime vs coral (colour alone is not enough)",
    info: true,
  });
  return pairs;
}

export function evaluate(tokens) {
  const color = (name, over) => {
    const raw = tokens[name];
    if (raw === undefined) throw new Error("Missing token " + name);
    const parsed = parseColor(resolve(raw, tokens));
    if (!parsed) throw new Error("Cannot parse colour for " + name + ": " + raw);
    return over ? composite(parsed, over) : parsed;
  };
  return requiredPairs().map((p) => {
    const bg = color(p.bg);
    const fg = color(p.fg, bg);
    const ratio = contrastRatio(fg, bg);
    const pass = p.info ? ratio < 3 : ratio >= p.min;
    return { ...p, ratio, pass };
  });
}
