// Visual QA for the Contact view (contact-v2).
// usage (after `npm run build` + any static server on dist/):
//   node contact-v2/qa/shots.mjs <site-url-with-trailing-slash> <outDir> intro [W] [H] [reduce]
//   node contact-v2/qa/shots.mjs <site-url-with-trailing-slash> <outDir> views [WxH,WxH,...]
//   node contact-v2/qa/shots.mjs <site-url-with-trailing-slash> <outDir> enter [W] [H]
// intro: records the flicker as screencast frames (~every 16-60 ms) with timestamps.
// views: per viewport, waits for the intro, then shoots top / mid-hero / each
//        section, and reports horizontal overflow, wordmark span and console errors.
// enter: Home -> Contact through the real strip transition, then away and back.
// Uses the Playwright that game/g1 already depends on, with the installed Chrome.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(new URL('../../game/g1/package.json', import.meta.url));
const { chromium } = require('playwright');

const [url, out, mode = 'views', ...rest] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const DEFAULT_VIEWS = '360x640,390x844,667x375,768x1024,1024x768,1366x768,1440x900,1920x1080,2560x1440,3440x1440';

const browser = await chromium.launch({ channel: 'chrome' });

async function newPage(W, H, opts = {}) {
  const touch = W < 900 && H > W ? true : W < 640;
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    isMobile: touch,
    hasTouch: touch,
    deviceScaleFactor: opts.dpr ?? 1,
    reducedMotion: opts.reduce ? 'reduce' : 'no-preference',
  });
  // skip the once-per-session home loader so every run starts the same way
  await ctx.addInitScript(() => {
    try { sessionStorage.setItem('homeLoaderPlayed', '1'); } catch {}
  });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => ['error', 'warning'].includes(m.type()) && logs.push(`${m.type()}: ${m.text()}`));
  page.on('pageerror', e => logs.push('pageerror: ' + e.message));
  return { ctx, page, logs };
}

const introDone = page => page.waitForFunction(() => document.documentElement.classList.contains('ctv2-intro-done'), null, { timeout: 15000 });

if (mode === 'intro') {
  const W = +(rest[0] || 1440), H = +(rest[1] || 900), reduce = rest[2] === 'reduce';
  const { page, logs } = await newPage(W, H, { reduce });
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', async f => {
    frames.push({ t: f.metadata.timestamp, data: f.data });
    await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  // exact timeline: every cover state change, timed from navigation start
  await page.addInitScript(() => {
    const log = (window.__ctv2Log = []);
    new MutationObserver(muts => {
      for (const m of muts) {
        const el = m.target;
        if (m.type === 'attributes' && el.classList?.contains('ctv2-intro__cell'))
          log.push([Math.round(performance.now()), Array.from(el.parentNode.children).indexOf(el), el.dataset.s]);
        for (const n of m.removedNodes) if (n.classList?.contains('ctv2-intro')) log.push([Math.round(performance.now()), -1, 'overlay-removed']);
        for (const n of m.addedNodes) if (n.classList?.contains('ctv2-intro')) log.push([Math.round(performance.now()), -1, 'overlay-added']);
      }
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-s'] });
  });
  await page.goto(`${url}#contact`);
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 60, maxWidth: 720, everyNthFrame: 1 });
  await introDone(page).catch(() => {});
  await sleep(500);
  await cdp.send('Page.stopScreencast');
  const overlayLeft = await page.evaluate(() => !!document.querySelector('#ctv2 .ctv2-intro'));
  const timeline = await page.evaluate(() => window.__ctv2Log);
  const added = timeline.find(e => e[2] === 'overlay-added')?.[0];
  const firstLit = timeline.find(e => e[2] === 'lit')?.[0];
  const removed = timeline.find(e => e[2] === 'overlay-removed')?.[0];
  const accents = timeline.filter(e => e[2] === 'accent').map(e => e[0]);
  const loadEvt = await page.evaluate(() => Math.round(performance.getEntriesByType('navigation')[0]?.loadEventEnd || 0));
  fs.writeFileSync(`${out}/timeline.json`, JSON.stringify(timeline));
  const first = frames[0]?.t ?? 0;
  frames.forEach((f, i) => {
    const ms = Math.round((f.t - first) * 1000);
    fs.writeFileSync(`${out}/f${String(i).padStart(3, '0')}-${String(ms).padStart(4, '0')}ms.jpg`, Buffer.from(f.data, 'base64'));
  });
  const report = { W, H, reduce, frames: frames.length, loadEventMs: loadEvt, overlayAddedMs: added, firstLitMs: firstLit, overlayRemovedMs: removed, flickerMs: removed && firstLit ? removed - firstLit + 350 : null, accentAtMs: accents, changes: timeline.length, overlayLeft, logs };
  fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}

if (mode === 'views') {
  const list = (rest[0] || DEFAULT_VIEWS).split(',').map(s => s.split('x').map(Number));
  const all = [];
  for (const [W, H] of list) {
    const { ctx, page, logs } = await newPage(W, H);
    await page.goto(`${url}#contact`);
    await introDone(page).catch(() => logs.push('intro did not finish'));
    await sleep(700);
    const shots = [];
    const shoot = async name => {
      const file = `${out}/${W}x${H}-${name}.png`;
      await page.screenshot({ path: file });
      shots.push(name);
    };
    const scrollTo = async y => {
      await page.evaluate(v => window.scrollTo(0, v), y);
      await sleep(450);
    };
    await shoot('0-top');
    await scrollTo(Math.round(H * 0.5));
    await shoot('1-midhero');
    // every section after the hero, top-aligned
    const tops = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#ctv2 [data-ctv2-section]')).map(el => ({
        name: el.getAttribute('data-ctv2-section'),
        y: Math.round(el.getBoundingClientRect().top + window.scrollY),
      })),
    );
    for (const [i, s] of tops.entries()) {
      await scrollTo(s.y);
      await shoot(`${i + 2}-${s.name}`);
    }
    await scrollTo(1e6);
    await shoot('9-end');
    const metrics = await page.evaluate(() => {
      const d = document.documentElement;
      const word = document.querySelector('#ctv2 .ctv2-word__fit')?.getBoundingClientRect();
      return {
        hScroll: d.scrollWidth > d.clientWidth,
        scrollWidth: d.scrollWidth,
        clientWidth: d.clientWidth,
        wordLeft: word && Math.round(word.left),
        wordRight: word && Math.round(d.clientWidth - word.right),
        wordWidthPct: word && +((word.width / d.clientWidth) * 100).toFixed(2),
      };
    });
    const r = { W, H, ...metrics, shots, logs };
    all.push(r);
    console.log(JSON.stringify(r));
    await ctx.close();
  }
  fs.writeFileSync(`${out}/report.json`, JSON.stringify(all, null, 2));
}

if (mode === 'enter') {
  const W = +(rest[0] || 1440), H = +(rest[1] || 900);
  const { page, logs } = await newPage(W, H);
  await page.goto(url);
  await sleep(1500);
  const steps = [];
  const view = () => page.evaluate(() => (document.getElementById('proj-view-contact')?.classList.contains('is-active') ? 'contact' : 'other'));
  await page.evaluate(() => document.getElementById('lv2-footer-contact')?.click());
  await sleep(400);
  await page.screenshot({ path: `${out}/enter-0-transition.png` });
  await introDone(page).catch(() => logs.push('intro did not finish after entering'));
  steps.push({ step: 'home -> contact', view: await view() });
  await page.screenshot({ path: `${out}/enter-1-contact.png` });
  await page.evaluate(() => (document.querySelector('a[href="#projects"]'))?.click());
  await sleep(2500);
  steps.push({ step: 'contact -> projects', view: await view() });
  await page.evaluate(() => document.getElementById('lv7-contact-btn')?.click() ?? document.getElementById('lv7-book-call')?.click());
  await sleep(300);
  const replay = await page.waitForFunction(() => !!document.querySelector('#ctv2 .ctv2-intro'), null, { timeout: 5000 }).then(() => true).catch(() => false);
  await introDone(page).catch(() => {});
  steps.push({ step: 'projects -> contact (intro replays)', view: await view(), replay });
  await page.screenshot({ path: `${out}/enter-2-again.png` });
  const r = { steps, logs };
  fs.writeFileSync(`${out}/report.json`, JSON.stringify(r, null, 2));
  console.log(JSON.stringify(r));
}

if (mode === 'nav') {
  const W = +(rest[0] || 1440), H = +(rest[1] || 900);
  const { page, logs } = await newPage(W, H);
  const checks = [];
  const check = (name, ok, extra) => { checks.push({ name, ok, ...(extra ? { extra } : {}) }); };
  await page.goto(`${url}#contact`);
  const before = await page.evaluate(() => getComputedStyle(document.querySelector('#ctv2 .ctv2-navwrap')).opacity);
  check('nav hidden during intro', before === '0', before);
  await introDone(page);
  await sleep(2600); // nav entry + the orb's own 2.2 s intro
  const box = await page.evaluate(() => {
    const r = el => { const b = document.querySelector(el)?.getBoundingClientRect(); return b && { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), b: Math.round(b.bottom), w: Math.round(b.width), h: Math.round(b.height) }; };
    return { vw: innerWidth, vh: innerHeight, wrap: r('#ctv2 .ctv2-navwrap'), pill: innerWidth < 640 ? r('#ctv2 .ctv2-nav__bar') : r('#ctv2 .ctv2-nav--desk'), orb: r('#ctv2 .ctv2-orb'), canvas: !!document.querySelector('#ctv2 .ctv2-orb canvas'), lv7Logo: getComputedStyle(document.getElementById('lv7-logo')).display };
  });
  check('orb canvas mounted', box.canvas);
  check('old projects nav hidden', box.lv7Logo === 'none');
  check('pill bottom gap >= 16px', box.vh - box.pill.b >= 16, box.vh - box.pill.b);
  check('orb left of pill, ~12px gap', W < 640 ? true : Math.abs(box.pill.l - box.orb.r - 12) <= 1, box.pill.l - box.orb.r);
  const centre = W < 640 ? (box.orb.l + box.pill.r) / 2 : (box.pill.l + box.pill.r) / 2;
  check('cluster centred', Math.abs(centre - W / 2) <= 2, centre - W / 2);
  // the orb is drawing: count bright pixels in a crop of the dock
  const orbShot = await page.screenshot({ clip: { x: box.orb.l, y: box.orb.t, width: box.orb.w, height: box.orb.h } });
  fs.writeFileSync(`${out}/${W}-orb.png`, orbShot);
  await page.screenshot({ path: `${out}/${W}-nav.png`, clip: { x: 0, y: H - 160, width: W, height: 160 } });
  const canvasNode = await page.evaluateHandle(() => document.querySelector('#ctv2 .ctv2-orb canvas'));
  await sleep(2100); // two clock ticks later the orb's canvas is the same node
  check('orb not remounted by clock ticks', await page.evaluate(c => c === document.querySelector('#ctv2 .ctv2-orb canvas'), canvasNode));
  if (W >= 640) {
    const current = await page.evaluate(() => document.querySelector('#ctv2 .ctv2-nav--desk [aria-current="page"]')?.textContent);
    check('aria-current on Contact', current === 'Contact', current);
    await page.hover('#ctv2 .ctv2-nav--desk a[href="#projects"]');
    await sleep(400);
    const chipOver = await page.evaluate(() => {
      const c = document.querySelector('#ctv2 .ctv2-nav__chip').getBoundingClientRect();
      const a = document.querySelector('#ctv2 .ctv2-nav--desk a[href="#projects"]').getBoundingClientRect();
      return Math.abs(c.left - a.left) < 1.5 && Math.abs(c.width - a.width) < 1.5;
    });
    check('chip slides to hovered item', chipOver);
    await page.screenshot({ path: `${out}/${W}-nav-hover.png`, clip: { x: 0, y: H - 160, width: W, height: 160 } });
    await page.mouse.move(W / 2, 100);
    await page.keyboard.press('Tab'); // focus moves into the page; walk to the nav
    for (let i = 0; i < 12; i++) {
      const f = await page.evaluate(() => document.activeElement?.closest('.ctv2-nav--desk') ? document.activeElement.textContent : null);
      if (f === 'Skills') break;
      await page.keyboard.press('Tab');
    }
    await sleep(350);
    await page.screenshot({ path: `${out}/${W}-nav-focus.png`, clip: { x: 0, y: H - 160, width: W, height: 160 } });
    const focusOn = await page.evaluate(() => document.activeElement?.textContent);
    check('keyboard reaches nav items', focusOn === 'Skills', focusOn);
    await page.click('#ctv2 .ctv2-nav--desk a[href="#projects"]');
    await sleep(2400);
    check('Projects link goes to Projects view', await page.evaluate(() => document.getElementById('proj-view-projects').classList.contains('is-active')));
  } else {
    const btn = '#ctv2 .ctv2-nav__menu-btn';
    await page.tap(btn);
    await sleep(350);
    check('menu opens (aria-expanded)', (await page.getAttribute(btn, 'aria-expanded')) === 'true');
    const taps = await page.evaluate(() => Array.from(document.querySelectorAll('#ctv2 .ctv2-nav__mlink')).map(a => Math.round(a.getBoundingClientRect().height)));
    check('menu items >= 44px', taps.every(h => h >= 44), taps);
    await page.screenshot({ path: `${out}/${W}-menu-open.png` });
    await page.keyboard.press('Escape');
    await sleep(200);
    check('Esc closes menu', (await page.getAttribute(btn, 'aria-expanded')) === 'false');
    check('focus back on Menu button', await page.evaluate(() => document.activeElement?.classList.contains('ctv2-nav__menu-btn')));
    await page.tap(btn);
    await sleep(200);
    await page.touchscreen.tap(W / 2, 200);
    await sleep(200);
    check('outside tap closes menu', (await page.getAttribute(btn, 'aria-expanded')) === 'false');
  }
  const r = { W, H, box, checks, logs };
  fs.writeFileSync(`${out}/report-${W}.json`, JSON.stringify(r, null, 2));
  console.log(JSON.stringify({ W, fails: checks.filter(c => !c.ok), passed: checks.filter(c => c.ok).length, logs }));
}

if (mode === 'services') {
  // tabs + currency. Pass tz (e.g. Asia/Kolkata) as the 3rd arg; the build
  // must have INR prices set for the currency checks to mean anything.
  const W = +(rest[0] || 1440), H = +(rest[1] || 900), tz = rest[2] || 'America/New_York';
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, timezoneId: tz, isMobile: W < 640, hasTouch: W < 640 });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('homeLoaderPlayed', '1'); } catch {} });
  const page = await ctx.newPage();
  // optional 4th arg: mock /api/geo's answer (e.g. IN / US) as the host would send it
  if (rest[3]) await page.route('**/api/geo', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ country: rest[3] }) }));
  const logs = [];
  page.on('console', m => ['error', 'warning'].includes(m.type()) && logs.push(`${m.type()}: ${m.text()}`));
  page.on('pageerror', e => logs.push('pageerror: ' + e.message));
  const checks = [];
  const check = (name, ok, extra) => checks.push({ name, ok, ...(extra !== undefined ? { extra } : {}) });
  const go = async () => {
    await page.goto(`${url}#contact`);
    await introDone(page);
    await page.evaluate(() => document.querySelector('#ctv2 [data-ctv2-section="services"]').scrollIntoView());
    await sleep(900);
  };
  await go();
  const state = () => page.evaluate(() => ({
    toggle: !!document.querySelector('#ctv2 .ctv2-seg'),
    pressed: document.querySelector('#ctv2 .ctv2-seg__btn[aria-pressed="true"]')?.textContent ?? null,
    first: document.querySelector('#ctv2 .ctv2-price__amt')?.textContent ?? null,
    selected: document.querySelector('#ctv2 [role="tab"][aria-selected="true"]')?.textContent ?? null,
  }));
  let s1 = await state();
  check('Websites selected by default', s1.selected?.includes('Websites'), s1.selected);
  check(`currency for tz ${tz}`, true, s1);
  await page.screenshot({ path: `${out}/${W}-${tz.replace('/', '_')}-websites.png` });
  const markerY = () => page.evaluate(() => document.querySelector('#ctv2 .ctv2-svc__marker').getBoundingClientRect()[innerWidth < 768 ? 'left' : 'top']);
  const m0 = await markerY();
  await page.click('#ctv2 [data-option="apps"]');
  await sleep(650);
  const m1 = await markerY();
  s1 = await state();
  check('click Apps selects Apps', s1.selected?.includes('Apps'), s1.selected);
  check('marker slides to Apps', Math.abs(m1 - m0) > 40, Math.round(m1 - m0));
  check('Apps panel shown', await page.evaluate(() => !!document.querySelector('#ctv2 .ctv2-factors') && !!document.querySelector('#ctv2 .ctv2-btn')));
  await page.screenshot({ path: `${out}/${W}-apps.png` });
  await page.keyboard.press(W < 768 ? 'ArrowLeft' : 'ArrowUp');
  await sleep(600);
  s1 = await state();
  check('arrow key back to Websites', s1.selected?.includes('Websites'), s1.selected);
  check('focus follows selection', await page.evaluate(() => document.activeElement?.getAttribute('data-option')) === 'websites');
  if (s1.toggle) {
    const other = s1.pressed === 'USD' ? 'INR' : 'USD';
    await page.click(`#ctv2 .ctv2-seg__btn:text-is("${other}")`);
    await sleep(400);
    const s2 = await state();
    check('toggle switches currency', s2.pressed === other, s2);
    await go();
    const s3 = await state();
    check('override persists after reload', s3.pressed === other, s3);
  }
  console.log(JSON.stringify({ W, tz, geo: rest[3] || null, fails: checks.filter(c => !c.ok), checks, logs }));
}

if (mode === 'footer') {
  const W = +(rest[0] || 1440), H = +(rest[1] || 900);
  const { ctx, page, logs } = await newPage(W, H);
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(url).origin });
  const checks = [];
  const check = (name, ok, extra) => checks.push({ name, ok, ...(extra !== undefined ? { extra } : {}) });
  await page.goto(`${url}#contact`);
  await introDone(page);
  await sleep(500);
  await page.evaluate(() => window.scrollTo(0, 1e6));
  await sleep(700);
  await page.screenshot({ path: `${out}/${W}-footer-end.png` });
  const clear = await page.evaluate(() => {
    const legal = document.querySelector('#ctv2 .ctv2-foot__legal').getBoundingClientRect();
    const nav = document.querySelector('#ctv2 .ctv2-navwrap').getBoundingClientRect();
    const orb = document.querySelector('#ctv2 .ctv2-orb')?.getBoundingClientRect();
    return { legalBottom: Math.round(legal.bottom), navTop: Math.round(Math.min(nav.top, orb ? orb.top : nav.top)) };
  });
  check('nav clears the legal row at the very bottom', clear.legalBottom <= clear.navTop, clear);
  await page.evaluate(() => document.querySelector('#ctv2 .ctv2-foot__top').scrollIntoView());
  await sleep(500);
  await page.screenshot({ path: `${out}/${W}-footer-top.png` });
  await page.click('#ctv2 .ctv2-copy');
  await sleep(250);
  const clip = await page.evaluate(() => navigator.clipboard.readText().catch(e => 'ERR ' + e.message));
  check('copy puts the email on the clipboard', clip === 'manikrana831@gmail.com', clip);
  check('copy shows "Copied"', (await page.textContent('#ctv2 .ctv2-copy')).includes('Copied'));
  check('copy announced (live region)', (await page.textContent('#ctv2 .ctv2-foot [role="status"]')).includes('copied'));
  await page.click('#ctv2 .ctv2-btn--ghost');
  await sleep(500);
  check('dialog opens', await page.evaluate(() => document.querySelector('#ctv2 .ctv2-dialog').open));
  check('form re-homed into dialog', await page.evaluate(() => !!document.querySelector('#ctv2 .ctv2-dialog #lv7-contact-form')));
  check('page scroll locked', await page.evaluate(() => document.documentElement.style.overflow === 'hidden'));
  await page.screenshot({ path: `${out}/${W}-dialog.png` });
  await page.click('#ctv2 .ctv2-dialog .lv7-form__submit');
  await sleep(300);
  check('empty submit blocked by validation', await page.evaluate(() => !document.getElementById('lv7-contact-form').classList.contains('is-sent')));
  await page.fill('#lv7-contact-form [name=name]', 'QA Test');
  await page.fill('#lv7-contact-form [name=email]', 'qa@example.com');
  await page.fill('#lv7-contact-form [name=website]', 'example.com');
  await page.fill('#lv7-contact-form [name=message]', 'Hello');
  await page.click('#ctv2 .ctv2-dialog .lv7-form__submit');
  await sleep(300);
  const sent = await page.evaluate(() => ({ cls: document.getElementById('lv7-contact-form').classList.contains('is-sent'), btn: document.querySelector('#lv7-contact-form .lv7-form__submit').textContent }));
  check('valid submit shows the existing confirmation', sent.cls && sent.btn.includes('Thanks'), sent);
  await page.screenshot({ path: `${out}/${W}-dialog-sent.png` });
  await page.keyboard.press('Escape');
  await sleep(300);
  check('Esc closes dialog', await page.evaluate(() => !document.querySelector('#ctv2 .ctv2-dialog').open));
  check('scroll unlocked', await page.evaluate(() => document.documentElement.style.overflow === ''));
  await page.click('#ctv2 .ctv2-foot__top-link');
  await sleep(1800);
  check('Back to top scrolls to 0', await page.evaluate(() => window.scrollY) < 2, await page.evaluate(() => window.scrollY));
  await page.evaluate(() => document.querySelector('#ctv2 a.ctv2-foot__link[href="#projects"]').click());
  await sleep(2400);
  check('footer Projects link goes to Projects', await page.evaluate(() => document.getElementById('proj-view-projects').classList.contains('is-active')));
  check('form returned home after leaving', await page.evaluate(() => document.getElementById('lv7-contact-form')?.parentElement?.classList.contains('ctv2-form-home')));
  console.log(JSON.stringify({ W, fails: checks.filter(c => !c.ok), passed: checks.filter(c => c.ok).length, clear, logs }));
}

await browser.close();
