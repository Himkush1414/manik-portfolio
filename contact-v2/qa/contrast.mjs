// Contrast check for the hero's small white tagline blocks over the photo.
// Hides the text, measures the brightest background pixel under each text
// box, and reports white-on-that contrast (WCAG AA for small text: 4.5).
// usage: node contact-v2/qa/contrast.mjs <site-url-with-trailing-slash> <outDir>
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(new URL('../../game/g1/package.json', import.meta.url));
const { chromium } = require('playwright');
const [url, out] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome' });
for (const [W, H] of [[360,640],[390,844],[667,375],[768,1024],[1024,768],[1366,768],[1440,900],[1920,1080],[2560,1440],[3440,1440]]) {
  const ctx = await b.newContext({ viewport: { width: W, height: H } });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('homeLoaderPlayed', '1'); } catch {} });
  const p = await ctx.newPage();
  await p.goto(url + '#contact');
  await p.waitForFunction(() => document.documentElement.classList.contains('ctv2-intro-done'));
  await new Promise(r => setTimeout(r, 600));
  // the text's own boxes, then the same area with the text made invisible
  const rects = await p.evaluate(() => [...document.querySelectorAll('#ctv2 .ctv2-hero__meta span')].map(s => { const r = s.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }));
  await p.addStyleTag({ content: '#ctv2 .ctv2-hero__meta p { color: transparent !important; text-shadow: none !important; }' });
  await new Promise(r => setTimeout(r, 100));
  let worst = 0;
  for (const [x, y, w, h] of rects) {
    const buf = await p.screenshot({ clip: { x, y, width: Math.max(1, w), height: Math.max(1, h) } });
    fs.writeFileSync(`${out}/bg.png`, buf);
    const v = await p.evaluate(async b64 => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data; let m = 0; for (let i = 0; i < d.length; i += 4) m = Math.max(m, 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]); return m; }, buf.toString('base64'));
    worst = Math.max(worst, v);
  }
  const L = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  console.log(`${W}x${H} brightest bg under tagline text: ${Math.round(worst)} -> white contrast ${(1.05 / (L(worst) + 0.05)).toFixed(2)}`);
  await ctx.close();
}
await b.close();
