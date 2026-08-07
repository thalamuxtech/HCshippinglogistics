// Resize public/brand/logo.png for web display.
//
// The source is 945x629 / 305KB, but the largest on-page render is h-36 (144px
// tall). At 2x for retina that needs 288px, so the full-size file was shipping
// roughly 10x more pixels than any screen used, and it was HALF the homepage's
// total weight.
//
// The original is kept as logo-full.png for print and the OG generator.
// Re-run after a brand change:  node scripts/optimize-logo.mjs
import { chromium } from "playwright";
import { readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs";

const SRC = "public/brand/logo.png";
const FULL = "public/brand/logo-full.png";
if (!existsSync(FULL)) copyFileSync(SRC, FULL);

const b64 = readFileSync(FULL).toString("base64");
// 2x the largest render (144px) with headroom, preserving the 945:629 ratio.
const W = 480, H = Math.round(480 * 629 / 945);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H },
  deviceScaleFactor: 1 });
await page.setContent(
  `<style>html,body{margin:0;padding:0;background:transparent}
   img{width:${W}px;height:${H}px;display:block;image-rendering:auto}</style>
   <img src="data:image/png;base64,${b64}">`,
  { waitUntil: "load" }
);
await page.waitForTimeout(400);
const shot = await page.screenshot({ omitBackground: true, type: "png" });
writeFileSync(SRC, shot);
await browser.close();

const before = readFileSync(FULL).length, after = shot.length;
console.log(`logo.png: ${W}x${H}`);
console.log(`  ${Math.round(before/1024)}KB -> ${Math.round(after/1024)}KB `
  + `(${Math.round((1-after/before)*100)}% smaller)`);
console.log("  original preserved at public/brand/logo-full.png");
