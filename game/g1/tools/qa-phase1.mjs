// Phase 1 QA protocol (brief §18): every capture group, budgets, console.
//   npm run qa:phase1 -- [origin] [--only boot,doors,hangar,modals,cockpit,res,perf] [--out qa/phase1] [--merge]
// --merge: keep the existing manifest, replace only the groups re-run now.
// Screenshots + manifest.json (per-shot renderer info, checks, console logs)
// land in --out. Screens are reached through the REAL flow (query params +
// window.__G1__), never by faking state. Headless Chrome on the default
// (integrated) GPU for visuals; the perf group uses the discrete GPU when
// G1_DGPU=1 (DEV_NOTES §8).
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const origin = argv[0]?.startsWith('http') ? argv[0] : 'http://localhost:5199';
const out = opt('out', 'qa/phase1');
const only = opt('only', 'boot,doors,hangar,modals,cockpit,res,perf').split(',');
mkdirSync(out, { recursive: true });

const GPU = ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'];
const SHIPS = ['halcyon', 'vesper', 'basilisk', 'nocturne', 'tempest', 'obsidian'];
const M = { shots: [], checks: {}, logs: {}, errors: {}, perf: {} };
if (argv.includes('--merge') && existsSync(`${out}/manifest.json`)) {
  const prev = JSON.parse(readFileSync(`${out}/manifest.json`, 'utf8'));
  M.shots = prev.shots.filter(x => !only.includes(x.group));
  M.checks = prev.checks ?? {};
  M.perf = only.includes('perf') ? {} : prev.perf ?? {};
  for (const [g, v] of Object.entries(prev.logs ?? {})) if (!only.includes(g)) M.logs[g] = v;
  for (const [g, v] of Object.entries(prev.errors ?? {})) if (!only.includes(g)) M.errors[g] = v;
}
const log = (...a) => console.error('[qa]', ...a);

async function open(group, query, { w = 1920, h = 1080, args = GPU, init } = {}) {
  const b = await chromium.launch({ channel: 'chrome', headless: true, args });
  const p = await b.newPage({ viewport: { width: w, height: h } });
  const logs = (M.logs[group] ??= []);
  p.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(m.text().slice(0, 200)); });
  p.on('pageerror', e => logs.push('pageerror ' + (e?.message || String(e))));
  // Phase 2: a fresh profile auto-picks a preset for the GPU and the DRS
  // governor scales resolution; the Phase 1 captures are scored at HIGH, so
  // seed HIGH as already picked and freeze the governor (?drs=0)
  await p.addInitScript(() => {
    const KEY = 'spacewar.darkedition.save.v1';
    if (localStorage.getItem(KEY)) return;
    localStorage.setItem(KEY, JSON.stringify({ version: 1, profile: {}, settings: { graphics: { preset: 'high', autoPicked: true }, gpuHintShown: true } }));
  });
  if (init) await p.addInitScript(init);
  await p.goto(`${origin}/game/g1/?${query}&drs=0`);
  await p.waitForFunction(() => !!window.__G1__?.info, null, { timeout: 60000 });
  const shot = async (name, clip) => {
    const file = `${group}-${name}.png`;
    await p.screenshot({ path: `${out}/${file}`, ...(clip ? { clip } : {}) });
    M.shots.push({ group, name, file, info: await p.evaluate(() => window.__G1__.info()) });
  };
  const ev = (fn, arg) => p.evaluate(fn, arg);
  const flowIs = s => p.waitForFunction(x => window.__G1__.flowState.get() === x, s, { timeout: 30000, polling: 50 });
  return { b, p, shot, ev, flowIs };
}

async function section(name, fn) {
  if (!only.includes(name)) return;
  const t0 = Date.now();
  log(`${name}…`);
  try {
    await fn();
  } catch (err) {
    M.errors[name] = String(err?.message ?? err).slice(0, 400);
    log(`${name} FAILED`, M.errors[name]);
  }
  log(`${name} done in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}

// 1. boot frames (seeked on the master timeline)
await section('boot', async () => {
  const { b, ev, shot } = await open('boot', 'debug=1');
  await new Promise(r => setTimeout(r, 6000)); // every loader task done
  for (const t of [0.3, 0.7, 1.2, 2.0, 3.0, 4.0, 4.6, 5.3, 6.4, 7.8, 8.4, 9.2, 9.9, 10.6, 11.4]) {
    await ev(tt => window.__G1__.boot.seek(tt), t);
    await new Promise(r => setTimeout(r, 650));
    await shot(`t${t.toFixed(1)}`);
  }
  await b.close();
});

// 2. door sequence 0 / 25 / 50 / 75 / 100 %
await section('doors', async () => {
  const { b, ev, shot } = await open('doors', 'screen=doors&debug=1');
  await new Promise(r => setTimeout(r, 7000));
  for (const d of [0, 0.25, 0.5, 0.75, 1]) {
    await ev(x => window.__G1__.doors.seek(x), d);
    await new Promise(r => setTimeout(r, 1200));
    await shot(`p${Math.round(d * 100)}`);
  }
  await b.close();
});

// 3. hangar: six ships x 2 liveries, locked hologram, mid-dissolve swap, both pilots, 3 angles each
await section('hangar', async () => {
  const { b, p, ev, shot } = await open('hangar', 'boot=0&debug=1&unlock=all');
  const wait = ms => p.waitForTimeout(ms);
  await wait(10000);
  for (const id of SHIPS) {
    await ev(x => window.__G1__.setShip(x), id);
    await wait(2300);
    await ev(() => window.__G1__.setLivery(0));
    await wait(900);
    await shot(`${id}-livery0`);
    await ev(() => window.__G1__.setLivery(3));
    await wait(1100);
    await shot(`${id}-livery3`);
    await ev(() => window.__G1__.setLivery(0));
  }
  await ev(() => window.__G1__.setShip('halcyon'));
  await wait(2300);
  await ev(() => window.__G1__.setShip('basilisk'));
  await wait(330);
  await shot('swap-mid-dissolve');
  await wait(2000);
  for (const pilot of ['onyx', 'ember']) {
    await ev(x => window.__G1__.setPilot(x), pilot);
    await wait(1600);
    await shot(`pilot-${pilot}`);
  }
  for (const id of SHIPS) {
    await ev(x => window.__G1__.setShip(x), id);
    await wait(2300);
    // the player's view: the real turntable, frozen at three poses (the
    // lookdev camera.view() angles sit outside the bay — studio renders only)
    for (const [v, yaw, pitch] of [['front34', 0.75, 0], ['side', Math.PI / 2, 0], ['rear34-high', 2.45, 0.17]]) {
      await ev(o => window.__G1__.camera.turntable({ frozen: true, vel: 0, yaw: o.yaw, pitch: o.pitch }), { yaw, pitch });
      await wait(1300);
      await shot(`${id}-${v}`);
    }
    await ev(() => window.__G1__.camera.turntable({ frozen: false }));
  }
  await b.close();
  // locked: a fresh profile (only HALCYON unlocked)
  const L = await open('hangar', 'boot=0&debug=1');
  await L.p.waitForTimeout(10000);
  await L.ev(() => window.__G1__.setShip('obsidian'));
  await L.p.waitForTimeout(2500);
  await L.shot('locked-obsidian-hologram');
  M.checks.lockedIsHologram = await L.ev(() => window.__G1__.ship.isHologram());
  await L.b.close();
});

// 4. upgrades (empty, mid-purchase, maxed) + settings (each tab, rebinding capture, conflict)
await section('modals', async () => {
  const U = await open('modals', 'boot=0&debug=1&screen=upgrades');
  await U.flowIs('hangar.upgrades');
  await U.p.waitForTimeout(1500);
  await U.shot('upgrades-empty');
  await U.ev(() => window.__G1__.grantCredits(20000));
  await U.p.waitForTimeout(400);
  const btn = await U.p.$('[role="listitem"]:has-text("HULL PLATING") button:has-text("INSTALL")');
  const bb = await btn.boundingBox();
  await U.p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await U.p.mouse.down();
  await U.p.waitForTimeout(280);
  await U.shot('upgrades-mid-purchase');
  await U.p.waitForTimeout(450);
  await U.p.mouse.up();
  await U.p.waitForTimeout(900);
  await U.ev(() => window.__G1__.cheats.maxUpgrades());
  await U.p.waitForTimeout(1200);
  await U.shot('upgrades-maxed');
  M.checks.upgradesMaxed = await U.ev(() => JSON.parse(localStorage.getItem('spacewar.darkedition.save.v1')).profile.upgrades);
  await U.b.close();
  const S = await open('modals', 'boot=0&debug=1&screen=settings');
  await S.flowIs('hangar.settings');
  await S.p.waitForTimeout(1500);
  await S.shot('settings-controls');
  await S.p.click('button[aria-label^="Fire primary"]');
  await S.p.waitForTimeout(250);
  await S.shot('settings-rebind-capture');
  await S.p.keyboard.press('KeyW');
  await S.p.waitForTimeout(350);
  M.checks.conflictPrompt = !!(await S.p.$('[role="alert"]:has-text("bound to")'));
  await S.shot('settings-conflict');
  await S.p.click('button:has-text("CANCEL")');
  for (const tab of ['CAMERA', 'GRAPHICS', 'AUDIO', 'ACCESSIBILITY']) {
    await S.p.click(`[role="tab"]:has-text("${tab}")`);
    await S.p.waitForTimeout(450);
    await S.shot(`settings-${tab.toLowerCase()}`);
  }
  await S.b.close();
});

// 5. cockpit: doors closed, reveal, systems boot, briefing, camera selector, standby; live mirrors
await section('cockpit', async () => {
  const { b, p, ev, shot } = await open('cockpit', 'boot=0&debug=1');
  await p.waitForTimeout(10000);
  // the cockpit (and its mirrors) pre-warm during hangar idle: sample once registered
  await p.waitForFunction(() => !!window.__G1__.mirrors, null, { timeout: 30000 });
  await p.waitForTimeout(500);
  const idleRenders = await ev(() => window.__G1__.mirrors.rig().renders);
  await p.waitForTimeout(1000);
  M.checks.mirrorsIdleInHangar = (await ev(() => window.__G1__.mirrors.rig().renders)) === idleRenders;
  // beats like "sealed" last ~0.5 s and the swap's main-thread work can
  // swallow a poll: run the launch choreography at 0.3x (GSAP global clock)
  await ev(() => window.__G1__.launch.rate(0.3));
  // Phase 2: STANDBY auto-launches after a beat; these captures treat it as a resting state
  await ev(() => window.__G1__.launch.holdStandby?.(true));
  await p.click('button[aria-label^="Start mission"]');
  const at = async (name, cond) => {
    await p.waitForFunction(cond, null, { timeout: 40000, polling: 16 });
    await shot(name);
  };
  await at('1-doors-closing', () => { const d = window.__G1__.launch.doorsP(); return d < 0.6 && d > 0.2; });
  await at('2-doors-sealed', () => window.__G1__.launch.doorsP() < 0.001 && window.__G1__.launch.stage().cockpit === 0);
  await at('3-reveal', () => window.__G1__.launch.stage().cockpit === 1 && window.__G1__.launch.doorsP() > 0.4);
  await at('4-systems-boot', () => window.__G1__.flowState.get() === 'launch.reveal' && !window.__G1__.launch.bulkhead().active);
  await at('5-briefing-typing', () => window.__G1__.flowState.get() === 'launch.briefing');
  await ev(() => window.__G1__.launch.rate(1));
  await p.waitForTimeout(9000);
  await shot('6-briefing');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(900);
  await shot('7-camera-select');
  await p.keyboard.press('3');
  await p.waitForTimeout(1500);
  await shot('8-standby');
  const r0 = await ev(() => window.__G1__.mirrors.rig().renders);
  await p.waitForTimeout(2000);
  const r1 = await ev(() => window.__G1__.mirrors.rig().renders);
  M.checks.mirrorRefreshPerSecIGPU = (r1 - r0) / 2; // bounded by the frame rate
  await shot('9-mirror-centre', { x: 760, y: 180, width: 400, height: 140 });
  M.checks.cockpitTris = await ev(() => window.__G1__.cockpit.tris());
  await b.close();
});

// 6. resolutions: hangar + camera select, no overflow / overlap / clipping
await section('res', async () => {
  const sizes = [[1280, 720], [1366, 768], [1920, 1080], [2560, 1440], [3440, 1440]];
  M.checks.layout = {};
  for (const [w, h] of sizes) {
    const { b, p, ev, shot } = await open('res', 'boot=0&debug=1', { w, h });
    await p.waitForTimeout(10000);
    await shot(`${w}x${h}-hangar`);
    M.checks.layout[`${w}x${h}`] = await ev(() => {
      const vw = innerWidth, vh = innerHeight;
      const els = [...document.querySelectorAll('[data-enter]')].flatMap(el => (el.dataset.enter === 'under' ? [...el.children] : [el]));
      const rects = els.map(el => ({ k: el.dataset.enter ?? el.className.split(' ')[0].replace(/_[a-z0-9]+_\d+$/i, ''), r: el.getBoundingClientRect() })).filter(x => x.r.width > 0);
      const out = rects.filter(x => x.r.left < -1 || x.r.top < -1 || x.r.right > vw + 1 || x.r.bottom > vh + 1).map(x => x.k);
      const overlaps = [];
      for (let i = 0; i < rects.length; i++)
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i].r, c = rects[j].r;
          const ix = Math.min(a.right, c.right) - Math.max(a.left, c.left), iy = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top);
          if (ix > 2 && iy > 2) overlaps.push(`${rects[i].k}~${rects[j].k}`);
        }
      return { scrollX: document.documentElement.scrollWidth > vw, scrollY: document.documentElement.scrollHeight > vh, outOfView: out, overlaps };
    });
    await ev(() => window.__G1__.openScreen('camera'));
    await p.waitForFunction(() => window.__G1__.flowState.get() === 'launch.cameraSelect', null, { timeout: 30000 });
    await p.waitForTimeout(1200);
    await shot(`${w}x${h}-camera-select`);
    await b.close();
  }
  const { b, p, shot } = await open('res', 'boot=0&debug=1', { w: 800, h: 600 });
  await p.waitForTimeout(6000);
  M.checks.smallNotice = await p.evaluate(() => /BEST ON DESKTOP/.test(document.body.innerText));
  await shot('800x600-notice');
  await b.close();
});

// 7. perf: fps + renderer info + heap at the hangar rest view and in the cockpit
await section('perf', async () => {
  const args = [...GPU, ...(process.env.G1_DGPU ? ['--force_high_performance_gpu'] : [])];
  const { b, p, ev } = await open('perf', 'boot=0&debug=1', { args });
  const cdp = await p.context().newCDPSession(p);
  const sample = async () => {
    const fps = [];
    for (let i = 0; i < 6; i++) { await p.waitForTimeout(1000); fps.push(await ev(() => window.__G1__.fps())); }
    await cdp.send('HeapProfiler.collectGarbage');
    const { usedSize } = await cdp.send('Runtime.getHeapUsage');
    return { fps: +(fps.reduce((a, x) => a + x, 0) / fps.length).toFixed(1), fpsMin: Math.min(...fps), info: await ev(() => window.__G1__.info()), heapMB: +(usedSize / 1048576).toFixed(1), gpu: process.env.G1_DGPU ? 'discrete' : 'integrated' };
  };
  await p.waitForTimeout(12000);
  M.perf.hangar = await sample();
  await ev(() => window.__G1__.openScreen('cockpit'));
  await p.waitForFunction(() => window.__G1__.flowState.get() === 'launch.standby', null, { timeout: 40000 });
  await p.waitForTimeout(2000);
  const m0 = await ev(() => window.__G1__.mirrors.rig().renders);
  M.perf.cockpit = await sample();
  const m1 = await ev(() => window.__G1__.mirrors.rig().renders);
  M.perf.cockpit.mirrorRefreshPerSec = +((m1 - m0) / 6.4).toFixed(1); // 6 x 1 s fps samples + GC
  await b.close();
});

// budgets (brief §6) over every captured frame + console summary
const infos = M.shots.map(s => s.info).filter(Boolean);
M.budgets = {
  maxDrawCalls: Math.max(...infos.map(i => i.drawCalls)),
  maxTriangles: Math.max(...infos.map(i => i.triangles)),
  drawCallsOk: infos.every(i => i.drawCalls <= 220),
  trianglesOk: infos.every(i => i.triangles <= 700000),
};
M.consoleClean = Object.values(M.logs).every(l => l.length === 0);
writeFileSync(`${out}/manifest.json`, JSON.stringify(M, null, 1));
console.log(JSON.stringify({ shots: M.shots.length, budgets: M.budgets, checks: M.checks, perf: M.perf, consoleClean: M.consoleClean, logs: M.logs, errors: M.errors }, null, 1));
