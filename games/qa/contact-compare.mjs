// Contact pixel-identity check for the Games work (the Contact view must not change).
//   node games/qa/contact-compare.mjs shoot <site-url/> <outDir>      screenshots of the Contact view
//   node games/qa/contact-compare.mjs diff  <dirA> <dirB> [outDir]    per-pixel diff of two shoot runs
// shoot: per viewport, opens /#contact, waits for the intro, then shoots the top, mid-hero, every
// [data-ctv2-section] and the page end, plus the nav with Projects hovered (desktop). The orb (WebGL,
// animated) and the live clocks (time) are masked: they change every frame by design.
// Reduced motion is on so scroll-linked easing settles to the same pixels on every run.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(new URL('../../game/g1/package.json', import.meta.url));
const { chromium } = require('playwright');

const [mode, a, b, c] = process.argv.slice(2);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const VIEWS = [[390, 844], [768, 1024], [1366, 768], [1920, 1080]];

const browser = await chromium.launch({ channel: 'chrome' });

if (mode === 'shoot') {
  const url = a, out = b;
  fs.mkdirSync(out, { recursive: true });
  const report = [];
  for (const [W, H] of VIEWS) {
    const touch = W < 640;
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: touch, hasTouch: touch, reducedMotion: 'reduce' });
    await ctx.addInitScript(() => {
      try { sessionStorage.setItem('homeLoaderPlayed', '1'); } catch {}
    });
    const page = await ctx.newPage();
    const logs = [];
    page.on('console', m => m.type() === 'error' && logs.push(m.text()));
    page.on('pageerror', e => logs.push('pageerror: ' + e.message));
    await page.goto(`${url}#contact`);
    await page.waitForFunction(() => document.documentElement.classList.contains('ctv2-intro-done'), null, { timeout: 20000 });
    await page.evaluate(() => document.fonts.ready);
    await sleep(1200);
    const mask = [page.locator('#ctv2 .ctv2-orb'), page.locator('#ctv2 .ctv2-clock')];
    const shoot = async name => {
      await page.screenshot({ path: `${out}/${W}x${H}-${name}.png`, mask, maskColor: '#ff00ff', animations: 'disabled' });
    };
    const scrollTo = async y => {
      await page.evaluate(v => window.scrollTo(0, v), y);
      await sleep(700);
    };
    await shoot('0-top');
    await scrollTo(Math.round(H * 0.5));
    await shoot('1-midhero');
    const tops = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#ctv2 [data-ctv2-section]')).map(el => ({ name: el.getAttribute('data-ctv2-section'), y: Math.round(el.getBoundingClientRect().top + window.scrollY) })),
    );
    for (const [i, s] of tops.entries()) {
      await scrollTo(s.y);
      await shoot(`${i + 2}-${s.name}`);
    }
    await scrollTo(1e6);
    await shoot('9-end');
    if (!touch) {
      await scrollTo(0);
      const link = page.locator('#ctv2 .ctv2-nav--desk a', { hasText: 'Projects' });
      await link.hover();
      await sleep(600);
      await shoot('a-nav-hover');
    }
    const nav = await page.evaluate(() => Array.from(document.querySelectorAll('#ctv2 .ctv2-nav a')).map(x => `${x.textContent}|${x.getAttribute('href')}|${x.getAttribute('aria-current') ?? ''}`));
    report.push({ W, H, sections: tops.map(t => t.name), nav, logs });
    await ctx.close();
  }
  fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 1));
}

if (mode === 'diff') {
  const A = a, B = b, out = c;
  if (out) fs.mkdirSync(out, { recursive: true });
  const files = fs.readdirSync(A).filter(f => f.endsWith('.png'));
  const page = await browser.newPage();
  const rows = [];
  for (const f of files) {
    if (!fs.existsSync(path.join(B, f))) {
      rows.push({ file: f, missing: true });
      continue;
    }
    const da = 'data:image/png;base64,' + fs.readFileSync(path.join(A, f)).toString('base64');
    const db = 'data:image/png;base64,' + fs.readFileSync(path.join(B, f)).toString('base64');
    const r = await page.evaluate(async ([da, db]) => {
      const load = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
      const [ia, ib] = await Promise.all([load(da), load(db)]);
      if (ia.width !== ib.width || ia.height !== ib.height) return { size: [ia.width, ia.height, ib.width, ib.height] };
      const w = ia.width, h = ia.height;
      const px = img => { const cv = new OffscreenCanvas(w, h); const g = cv.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, w, h).data; };
      const pa = px(ia), pb = px(ib);
      const cv = new OffscreenCanvas(w, h), g = cv.getContext('2d'), out = g.createImageData(w, h);
      let diff = 0, maxD = 0;
      for (let i = 0; i < pa.length; i += 4) {
        const d = Math.max(Math.abs(pa[i] - pb[i]), Math.abs(pa[i + 1] - pb[i + 1]), Math.abs(pa[i + 2] - pb[i + 2]));
        if (d > maxD) maxD = d;
        if (d > 0) { diff++; out.data[i] = 255; out.data[i + 3] = 255; } else { out.data[i] = out.data[i + 1] = out.data[i + 2] = pa[i] * 0.25; out.data[i + 3] = 255; }
      }
      g.putImageData(out, 0, 0);
      const blob = diff ? await cv.convertToBlob() : null;
      const map = blob ? await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); }) : null;
      return { diff, total: w * h, maxD, map };
    }, [da, db]);
    if (r.map && out) fs.writeFileSync(path.join(out, f.replace('.png', '-diff.png')), Buffer.from(r.map.split(',')[1], 'base64'));
    rows.push({ file: f, diffPixels: r.diff, total: r.total, maxDelta: r.maxD, size: r.size });
  }
  const changed = rows.filter(r => r.missing || r.size || r.diffPixels);
  const summary = { compared: rows.length, identical: rows.length - changed.length, changed };
  if (out) fs.writeFileSync(path.join(out, 'diff.json'), JSON.stringify({ summary, rows }, null, 2));
  console.log(JSON.stringify(summary, null, 1));
}

await browser.close();
