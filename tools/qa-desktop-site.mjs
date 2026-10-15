// Phone "Desktop site" QA — emulates Chrome's Desktop site on a phone and
// checks the layout fixes that only that mode needs (see tall-touch.ts).
//
//   npm run build && npm run preview          (serves dist/ on :4173)
//   node tools/qa-desktop-site.mjs [origin] [--out dir]
//
// Desktop site = a 390x844 DPR-3 touch phone, a desktop Chrome UA, and the
// viewport meta ignored (stripped from every HTML response here), so the
// page is laid out 980px wide and scaled down to fit the screen — portrait
// (980 x ~2120) and landscape (980 x ~450). Playwright comes from
// game/g1's install (npm ci --prefix game/g1).
//
// Checks, per orientation: <html> gets ds-zoomed; no horizontal overflow; no
// console errors; the footer SIGN UP button clears the link columns; the
// Skill & Fun headline clears the MOVE NEXT rail; About's Chapter I portrait
// sits inside its panel (landscape). Screenshots go to --out.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('../game/g1/node_modules/playwright');

const argv = process.argv.slice(2);
const origin = argv[0]?.startsWith('http') ? argv[0] : 'http://localhost:4173';
const out = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : 'qa-desktop-site';
mkdirSync(out, { recursive: true });

const DESKTOP_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const fails = [];
const check = (ok, msg) => {
  if (!ok) fails.push(msg);
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${msg}`);
};

let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
} catch {
  browser = await chromium.launch({ headless: true });
}

for (const orient of ['portrait', 'landscape']) {
  const viewport = orient === 'portrait' ? { width: 390, height: 844 } : { width: 844, height: 390 };
  const ctx = await browser.newContext({
    viewport,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: DESKTOP_UA
  });
  await ctx.route('**/*', async route => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const res = await route.fetch();
    const body = (await res.text()).replace(/<meta\s+name="viewport"[^>]*>/gi, '');
    await route.fulfill({ response: res, body });
  });
  await ctx.addInitScript(() => {
    try {
      sessionStorage.setItem('homeLoaderPlayed', '1');
    } catch {
      /* ignore */
    }
  });

  const open = async path => {
    const p = await ctx.newPage();
    p.errors = [];
    p.on('console', m => m.type() === 'error' && p.errors.push(m.text().slice(0, 200)));
    p.on('pageerror', e => p.errors.push(e.message));
    await p.goto(origin + path, { waitUntil: 'networkidle' });
    await p.waitForTimeout(1200);
    return p;
  };
  const common = async (p, label) => {
    const m = await p.evaluate(() => ({
      cls: document.documentElement.className,
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
      ch: document.documentElement.clientHeight
    }));
    check(m.cls.includes('ds-zoomed'), `${orient} ${label}: html.ds-zoomed (layout ${m.cw}x${m.ch})`);
    check(m.sw <= m.cw, `${orient} ${label}: no horizontal overflow (${m.sw} <= ${m.cw})`);
    check(p.errors.length === 0, `${orient} ${label}: no console errors ${p.errors.join(' / ')}`);
  };

  console.log(`\n${orient}`);

  // home — footer
  {
    const p = await open('/');
    await common(p, 'home');
    await p.evaluate(() => document.getElementById('lv2-footer')?.scrollIntoView({ block: 'end' }));
    await p.waitForTimeout(1500);
    const g = await p.evaluate(() => {
      const btn = document.querySelector('#lv2-footer .btn-signup')?.getBoundingClientRect();
      const link = document.querySelector('#lv2-footer .col--links')?.getBoundingClientRect();
      const title = document.querySelector('#lv2-footer .signup__title');
      const lh = title ? parseFloat(getComputedStyle(title).lineHeight) : 0;
      return { btnR: btn?.right, linkL: link?.left, titleLines: title ? Math.round(title.getBoundingClientRect().height / lh) : 0 };
    });
    check(g.linkL - g.btnR >= 12, `${orient} footer: SIGN UP clears the link column (gap ${Math.round(g.linkL - g.btnR)}px)`);
    check(g.titleLines === 1, `${orient} footer: sign-up title on one line`);
    await p.screenshot({ path: `${out}/${orient}-home-footer.png` });
    await p.close();
  }

  // Skill & Fun hero
  {
    const p = await open('/#skills');
    await common(p, 'skills');
    const g = await p.evaluate(() => {
      const spans = [...document.querySelectorAll('.skillsfun-hero__headline span')];
      const right = Math.max(...spans.map(s => {
        const r = document.createRange();
        r.selectNodeContents(s);
        return r.getBoundingClientRect().right;
      }));
      const rail = document.getElementById('skillsfun-move-next')?.getBoundingClientRect();
      const h = document.querySelector('.skillsfun-hero__headline')?.getBoundingClientRect();
      const hero = document.querySelector('.skillsfun-hero')?.getBoundingClientRect();
      return { right, railL: rail?.left, hBottom: h?.bottom, heroBottom: hero?.bottom };
    });
    check(g.right < g.railL, `${orient} skills: headline clears MOVE NEXT (${Math.round(g.right)} < ${Math.round(g.railL)})`);
    check(g.hBottom <= g.heroBottom, `${orient} skills: headline inside the hero`);
    await p.screenshot({ path: `${out}/${orient}-skills.png` });
    await p.close();
  }

  // About — Chapter I portrait
  {
    const p = await open('/about/');
    await common(p, 'about');
    await p.mouse.move(viewport.width / 2, viewport.height / 2);
    for (let i = 0; i < 12; i++) {
      await p.mouse.wheel(0, 160);
      await p.waitForTimeout(40);
    }
    await p.waitForTimeout(2200);
    const g = await p.evaluate(() => {
      const fig = document.querySelector('.panel--about .panel__portrait')?.getBoundingClientRect();
      const panel = document.querySelector('.panel--about')?.getBoundingClientRect();
      return { figB: fig?.bottom, figT: fig?.top, panelB: panel?.bottom, panelT: panel?.top };
    });
    check(g.figT >= g.panelT && g.figB <= g.panelB + 1, `${orient} about: Chapter I portrait inside its panel`);
    await p.screenshot({ path: `${out}/${orient}-about-ch1.png` });
    await p.close();
  }
  await ctx.close();
}

await browser.close();
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall checks passed');
process.exit(fails.length ? 1 : 0);
