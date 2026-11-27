// Visual + behaviour QA for the Games library (/games).
//   node games/qa/games-shots.mjs <site-url/> <outDir> <mode> [args]
// modes:
//   views [WxH,...]   per viewport: top + full-page shots for both games, layout metrics, console errors
//   keys              keyboard: Tab to the selector, arrows switch games (cross-fade), Enter plays
//   player [WxH]      space game: Play -> player dialog, fullscreen, Esc / Back / Exit, teardown
//   rotate            phone portrait -> rotate overlay, landscape -> game starts
//   demo              space game played to the ejection: end card, Replay, Back to library
//   nav               the Skills & Fun "Game" box -> /games, every nav link on /games resolves
// Uses game/g1's Playwright with the installed Chrome (see contact-v2/qa/shots.mjs).
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(new URL('../../game/g1/package.json', import.meta.url));
const { chromium } = require('playwright');

const [url, out, mode = 'views', ...rest] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const VIEWS = '390x844,430x932,844x390,932x430,768x1024,1024x768,1366x768,1920x1080,2560x1440';
const gpu = ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'];
const browser = await chromium.launch({ channel: 'chrome', args: gpu });

async function newPage(W, H, opts = {}) {
  // phones / small tablets in either orientation get touch + mobile emulation
  const touch = opts.touch ?? Math.min(W, H) <= 500;
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    isMobile: touch,
    hasTouch: touch,
    deviceScaleFactor: opts.dpr ?? 1,
    reducedMotion: opts.reduce ? 'reduce' : 'no-preference',
  });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => ['error', 'warning'].includes(m.type()) && logs.push(`${m.type()}: ${m.text()}`));
  page.on('pageerror', e => logs.push('pageerror: ' + e.message));
  return { ctx, page, logs };
}
const ready = page => page.waitForFunction(() => document.querySelector('#ctv2.gm .gm-play') && Array.from(document.querySelectorAll('.gm-cover.is-on img')).every(i => i.complete), null, { timeout: 20000 });

if (mode === 'views') {
  const list = (rest[0] || VIEWS).split(',').map(s => s.split('x').map(Number));
  const report = [];
  for (const [W, H] of list) {
    const { ctx, page, logs } = await newPage(W, H);
    await page.goto(`${url}games/`);
    await ready(page);
    await page.evaluate(() => document.fonts.ready);
    await sleep(900);
    const row = { W, H, games: {} };
    for (const slug of ['mindtier', 'space-game']) {
      await page.click(`#gm-tab-${slug}`);
      await sleep(700);
      await page.evaluate(() => window.scrollTo(0, 0));
      await sleep(250);
      await page.screenshot({ path: `${out}/${W}x${H}-${slug}-top.png` });
      await page.screenshot({ path: `${out}/${W}x${H}-${slug}-full.png`, fullPage: true });
      row.games[slug] = await page.evaluate(() => {
        const d = document.documentElement;
        const r = el => { const b = el?.getBoundingClientRect(); return b && { x: Math.round(b.left), y: Math.round(b.top + scrollY), w: Math.round(b.width), h: Math.round(b.height) }; };
        const play = document.querySelector('#ctv2 .gm-play');
        // scroll the Play button into view (centre) and check nothing (e.g. the floating nav) covers it
        play.scrollIntoView({ block: 'center' });
        const pb = play.getBoundingClientRect();
        const pts = [[pb.left + 8, pb.top + pb.height / 2], [pb.left + pb.width / 2, pb.top + pb.height / 2], [pb.right - 8, pb.top + pb.height / 2]];
        const covered = pts.some(([x, y]) => { const hit = document.elementFromPoint(x, y); return hit && !play.contains(hit); });
        // last content above the nav at the very end of the page
        window.scrollTo(0, d.scrollHeight);
        const nav = Array.from(document.querySelectorAll('#ctv2 .ctv2-navwrap .ctv2-nav--desk, #ctv2 .ctv2-navwrap .ctv2-nav__bar, #ctv2 .ctv2-orb')).map(e => e.getBoundingClientRect()).filter(b => b.width > 0);
        const navTop = Math.min(...nav.map(b => b.top));
        const legal = document.querySelector('#ctv2 .ctv2-foot__legal')?.getBoundingClientRect();
        const small = Array.from(document.querySelectorAll('#ctv2 a, #ctv2 button, #ctv2 [role="tab"]'))
          .filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.height < 44 || b.width < 44) && !e.closest('.ctv2-foot'); })
          .map(e => `${e.className || e.tagName}:${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`);
        window.scrollTo(0, 0);
        return {
          hScroll: d.scrollWidth > d.clientWidth,
          feature: r(document.querySelector('#ctv2 .gm-feature')),
          detail: r(document.querySelector('#ctv2 .gm-detail')),
          select: r(document.querySelector('#ctv2 .gm-select')),
          play: r(play),
          playCovered: covered,
          legalBottomVsNavTop: legal ? Math.round(navTop - legal.bottom) : null,
          smallTargets: small,
          tabs: Array.from(document.querySelectorAll('[role="tab"]')).map(t => `${t.id}:${t.getAttribute('aria-selected')}`),
          soonCards: document.querySelectorAll('.gm-card--soon').length,
          coverOn: document.querySelector('.gm-cover.is-on img')?.currentSrc.split('/').pop(),
          font: getComputedStyle(document.querySelector('#ctv2 .gm-title')).fontFamily,
        };
      });
    }
    row.logs = logs;
    report.push(row);
    await ctx.close();
  }
  fs.writeFileSync(`${out}/views.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.map(r => ({ v: `${r.W}x${r.H}`, h: Object.values(r.games).map(g => g.hScroll), covered: Object.values(r.games).map(g => g.playCovered), legal: Object.values(r.games).map(g => g.legalBottomVsNavTop), small: r.games.mindtier.smallTargets, logs: r.logs }))));
}

if (mode === 'nav') {
  const report = {};
  // 1) the Skills & Fun "Game" box (scroll the Skills view to its section, then click the box)
  {
    const { ctx, page, logs } = await newPage(1440, 900);
    await ctx.addInitScript(() => { try { sessionStorage.setItem('homeLoaderPlayed', '1'); } catch {} });
    await page.goto(`${url}#skills`);
    await page.waitForSelector('[data-sf3-root]', { timeout: 20000 });
    for (let i = 0; i < 80; i++) {
      if (await page.evaluate(() => document.querySelector('[data-sf3-root]')?.getAttribute('data-mode') === 'section')) break;
      await page.mouse.wheel(0, 900);
      await sleep(120);
    }
    const box = page.locator('a.skillsfun-navgrid__box--games');
    await box.scrollIntoViewIfNeeded();
    await sleep(800);
    report.gameBox = await box.evaluate(a => ({ tag: a.tagName, href: a.getAttribute('href'), label: a.getAttribute('aria-label'), cursor: getComputedStyle(a).cursor }));
    await page.screenshot({ path: `${out}/skills-navgrid.png` });
    await box.hover();
    await sleep(500);
    await page.screenshot({ path: `${out}/skills-navgrid-hover.png` });
    await Promise.all([page.waitForURL(/\/games\/?$/, { timeout: 15000 }), box.click()]);
    await ready(page);
    report.afterClick = page.url();
    report.sameTab = ctx.pages().length === 1;
    report.logs = logs;
    await ctx.close();
  }
  // 2) every nav link on /games points at a page that loads
  {
    const { ctx, page, logs } = await newPage(1440, 900);
    await page.goto(`${url}games/`);
    await ready(page);
    const links = await page.$$eval('#ctv2 .ctv2-nav--desk a', as => as.map(a => ({ label: a.textContent, href: a.getAttribute('href'), current: a.getAttribute('aria-current') })));
    report.navLinks = [];
    for (const l of links) {
      const res = await page.request.get(new URL(l.href, url).href);
      report.navLinks.push({ ...l, status: res.status() });
    }
    report.titles = await page.evaluate(() => ({ title: document.title, desc: document.querySelector('meta[name=description]')?.content, og: document.querySelector('meta[property="og:image"]')?.content }));
    report.navLogs = logs;
    await ctx.close();
  }
  fs.writeFileSync(`${out}/nav.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 1));
}

await browser.close();
