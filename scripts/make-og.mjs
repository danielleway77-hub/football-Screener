// `pnpm make-og` — renders the 1200x630 Open Graph image (dark, glyph left, wordmark + tagline)
// with the Chromium Playwright already installed. Output: src/app/opengraph-image.png (+ twitter-image.png).
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const root = new URL("../", import.meta.url);
const font = readFileSync(
  new URL(
    "node_modules/@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2",
    root,
  ),
).toString("base64");
const inter = readFileSync(
  new URL("node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2", root),
).toString("base64");

const html = `<html><head><style>
@font-face{font-family:SG;src:url(data:font/woff2;base64,${font});font-weight:300 700}
@font-face{font-family:IN;src:url(data:font/woff2;base64,${inter});font-weight:100 900}
html,body{margin:0}
body{width:1200px;height:630px;background:#070A09;color:#F2F7F4;display:flex;align-items:center;gap:56px;padding:0 96px;box-sizing:border-box;
background-image:radial-gradient(60% 70% at 12% 0%,rgba(200,245,46,.10),transparent 70%)}
h1{font:700 64px/1.05 SG;letter-spacing:-.02em;margin:0}
p{font:400 28px/1.3 IN;color:#9AABA4;margin:16px 0 0}
</style></head><body>
<svg viewBox="0 0 24 24" width="240" height="240" fill="none">
<circle cx="12" cy="12" r="8" stroke="#F2F7F4" stroke-width="1.75"/>
<line x1="12" y1="2.5" x2="12" y2="21.5" stroke="#F2F7F4" stroke-opacity=".4" stroke-width="1.75"/>
<g stroke="#C8F52E" stroke-width="2" stroke-linecap="round"><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="9.5" x2="2" y2="14.5"/><line x1="22" y1="9.5" x2="22" y2="14.5"/></g></svg>
<div><h1>Football Match Screener</h1><p>Private match screening</p></div></body></html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: 1200, height: 630 } });
  writeFileSync(new URL("src/app/opengraph-image.png", root), png);
  copyFileSync(
    new URL("src/app/opengraph-image.png", root),
    new URL("src/app/twitter-image.png", root),
  );
  writeFileSync(
    new URL("src/app/opengraph-image.alt.txt", root),
    "Football Match Screener: private match screening",
  );
  console.log(`wrote opengraph-image.png (1200x630, ${png.length} bytes)`);
} finally {
  await browser.close();
}
