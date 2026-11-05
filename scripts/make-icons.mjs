// `pnpm make-icons` — renders src/app/icon.svg to PNG favicons with the Chromium that Playwright
// already installed (no extra dependency).
//   src/app/apple-icon.png (180)  · public/icons/icon-192.png · public/icons/icon-512.png
//   public/icons/icon-32.png
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const root = new URL("../", import.meta.url);
const svg = readFileSync(new URL("src/app/icon.svg", root), "utf8");
const targets = [
  ["src/app/apple-icon.png", 180],
  ["public/icons/icon-32.png", 32],
  ["public/icons/icon-192.png", 192],
  ["public/icons/icon-512.png", 512],
];

mkdirSync(new URL("public/icons/", root), { recursive: true });
const browser = await chromium.launch();
try {
  for (const [file, size] of targets) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(
      `<html><body style="margin:0;background:transparent">` +
        svg.replace("<svg ", `<svg style="display:block;width:${size}px;height:${size}px" `) +
        `</body></html>`,
    );
    const png = await page.screenshot({
      omitBackground: true,
      clip: { x: 0, y: 0, width: size, height: size },
    });
    writeFileSync(new URL(file, root), png);
    console.log(`wrote ${file} (${size}×${size}, ${png.length} bytes)`);
    await page.close();
  }
} finally {
  await browser.close();
}
