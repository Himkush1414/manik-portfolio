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

// state of the player as the page sees it
const playerState = page => page.evaluate(() => {
  const host = document.querySelector('#ctv2 .gm-player');
  const fr = host?.querySelector('iframe');
  return {
    open: !!host && !host.hidden,
    fullscreen: document.fullscreenElement === host,
    iframes: document.querySelectorAll('iframe').length,
    src: fr?.getAttribute('src') ?? null,
    pageCanvases: Array.from(document.querySelectorAll('canvas')).length,
    history: history.state?.gmPlayer ?? null,
    url: location.pathname + location.search,
    active: document.activeElement?.className || document.activeElement?.tagName,
    htmlPlaying: document.documentElement.classList.contains('gm-playing'),
    inertMain: document.querySelector('#ctv2 > .gm-main')?.hasAttribute('inert'),
    selected: document.querySelector('[role=tab][aria-selected=true]')?.id,
    exit: (() => { const b = document.querySelector('#ctv2 .gm-exit')?.getBoundingClientRect(); return b ? [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)] : null; })(),
  };
});

if (mode === 'player') {
  const [W, H] = (rest[0] || '1920x1080').split('x').map(Number);
  const { ctx, page, logs } = await newPage(W, H, { touch: false });
  const steps = [];
  await page.goto(`${url}games/?game=space-game`);
  await ready(page);
  await sleep(1200);
  steps.push(['library', await playerState(page)]);
  const open = async label => {
    await page.click('#ctv2 .gm-play');
    await page.waitForSelector('#ctv2 .gm-player iframe', { timeout: 10000 });
    await sleep(500);
    steps.push([`${label}:open`, await playerState(page)]);
  };
  // 1) Play -> fullscreen player, game loads; then Esc (focus is inside the game)
  await open('esc');
  await page.waitForFunction(() => !document.querySelector('.gm-player__loading'), null, { timeout: 60000 });
  await sleep(6000);
  await page.screenshot({ path: `${out}/${W}x${H}-player-game.png` });
  steps.push(['esc:loaded', await playerState(page)]);
  await page.keyboard.press('Escape');
  await sleep(900);
  steps.push(['esc:closed', await playerState(page)]);
  await page.screenshot({ path: `${out}/${W}x${H}-after-esc.png` });
  // 2) Back button
  await open('back');
  await page.goBack();
  await sleep(900);
  steps.push(['back:closed', await playerState(page)]);
  // 3) Exit button
  await open('exit');
  await sleep(1500);
  await page.screenshot({ path: `${out}/${W}x${H}-player-loading-exit.png` });
  await page.click('#ctv2 .gm-exit');
  await sleep(900);
  steps.push(['exit:closed', await playerState(page)]);
  // history must not have grown: one Back leaves /games entirely (to about:blank here)
  steps.push(['historyLength', await page.evaluate(() => history.length)]);
  fs.writeFileSync(`${out}/player-${W}x${H}.json`, JSON.stringify({ steps, logs }, null, 2));
  console.log(JSON.stringify({ steps, logs }, null, 1));
  await ctx.close();
}

if (mode === 'rotate') {
  const { ctx, page, logs } = await newPage(390, 844, { touch: true, dpr: 2 });
  const steps = [];
  await page.goto(`${url}games/?game=space-game`);
  await ready(page);
  steps.push(['media', await page.evaluate(() => ({ coarse: matchMedia('(hover: none) and (pointer: coarse)').matches, portrait: matchMedia('(orientation: portrait)').matches }))]);
  await page.locator('#ctv2 .gm-play').scrollIntoViewIfNeeded();
  await page.tap('#ctv2 .gm-play');
  await sleep(800);
  const rot = () => page.evaluate(() => ({ overlay: !!document.querySelector('.gm-rotate'), text: document.querySelector('.gm-rotate')?.innerText.replace(/\s+/g, ' '), role: document.querySelector('.gm-rotate')?.getAttribute('role'), iframes: document.querySelectorAll('iframe').length, exit: (() => { const b = document.querySelector('.gm-exit')?.getBoundingClientRect(); return b && [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; })(), scrollY, hScroll: document.documentElement.scrollWidth > innerWidth }));
  steps.push(['portrait', await rot()]);
  await page.screenshot({ path: `${out}/390x844-rotate.png` });
  await page.setViewportSize({ width: 844, height: 390 });
  await sleep(1500);
  steps.push(['landscape', await rot()]);
  await page.waitForFunction(() => !document.querySelector('.gm-player__loading'), null, { timeout: 60000 }).catch(() => {});
  await sleep(5000);
  await page.screenshot({ path: `${out}/844x390-playing.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await sleep(800);
  steps.push(['portrait-again', await rot()]);
  await page.screenshot({ path: `${out}/390x844-paused.png` });
  await page.setViewportSize({ width: 844, height: 390 });
  await sleep(800);
  steps.push(['landscape-again', await rot()]);
  await page.tap('.gm-exit');
  await sleep(800);
  steps.push(['exited', await playerState(page)]);
  fs.writeFileSync(`${out}/rotate.json`, JSON.stringify({ steps, logs }, null, 2));
  console.log(JSON.stringify({ steps, logs }, null, 1));
  await ctx.close();
}

await browser.close();
