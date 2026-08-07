// Generate public/og.png (1200x630) for social + AI link previews.
// Rendered with Playwright from inline HTML so it uses the real brand colours and
// the actual logo asset, rather than being hand-drawn in a canvas API.
//
// Re-run after a brand change:  node scripts/make-og.mjs
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const logo = readFileSync("public/brand/logo-full.png").toString("base64");

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1200px;height:630px;font-family:Inter,system-ui,sans-serif;
       background:linear-gradient(135deg,#0B1E3A 0%,#123159 55%,#0B1E3A 100%);
       color:#fff;position:relative;overflow:hidden}
  .glow{position:absolute;inset:0;
        background:radial-gradient(circle at 78% 18%,rgba(10,91,224,.42),transparent 58%)}
  .wrap{position:relative;height:100%;display:flex;flex-direction:column;
        justify-content:center;padding:76px 84px}
  .plate{background:#fff;border-radius:20px;padding:16px 22px;display:inline-flex;
         align-self:flex-start;box-shadow:0 12px 40px rgba(0,0,0,.28)}
  .plate img{height:76px;display:block}
  h1{font-size:64px;line-height:1.06;font-weight:800;margin-top:40px;letter-spacing:-1.4px;max-width:960px}
  .accent{background:linear-gradient(90deg,#0A5BE0,#4D93FF);-webkit-background-clip:text;
          -webkit-text-fill-color:transparent}
  p{font-size:27px;color:rgba(255,255,255,.82);margin-top:24px;max-width:900px;line-height:1.45}
  .row{display:flex;gap:14px;margin-top:40px;flex-wrap:wrap}
  .chip{background:rgba(255,255,255,.11);border:1px solid rgba(255,255,255,.2);
        border-radius:999px;padding:11px 22px;font-size:20px;font-weight:600}
  .bar{position:absolute;left:0;right:0;bottom:0;height:10px;
       background:linear-gradient(90deg,#0A5BE0,#4D93FF,#0A5BE0)}
</style></head><body>
  <div class="glow"></div>
  <div class="wrap">
    <div class="plate"><img src="data:image/png;base64,${logo}" alt=""></div>
    <h1>Shipping from the USA<br><span class="accent">to Nigeria &amp; across Africa</span></h1>
    <p>Sea cargo, air freight and vehicle (RORO) shipping. Tracked through 8 stages, with digital invoices.</p>
    <div class="row">
      <div class="chip">FMC Licensed since 2017</div>
      <div class="chip">Door-to-door pickup</div>
      <div class="chip">Live tracking</div>
    </div>
  </div>
  <div class="bar"></div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html, { waitUntil: "networkidle" });
await page.waitForTimeout(1200); // let the webfont settle
await page.screenshot({ path: "public/og.png" });
await browser.close();
console.log("wrote public/og.png (1200x630)");
