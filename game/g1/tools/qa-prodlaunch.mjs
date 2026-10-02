// Production launch path (brief §14 / §17, 2C cp8): NO ?level= — the real
// player route with page-level clicks only: hangar -> START MISSION ->
// cockpit reveal -> briefing -> LET'S GO -> camera card -> STANDBY -> the
// automatic LAUNCH after the beat -> catapult -> breach -> playing on
// Level 1. Then flies with REAL keyboard input (no bot, no forced input) and
// checks the ship answers: strafe right / left, climb. Records the flow
// timeline, programs (constant from play start), long tasks, console.
//   node tools/qa-prodlaunch.mjs [origin] [--camera third|chase|cockpit] [--out qa/p2c]
import { chromium } from 'playwright';
import { gpuArgs, assertGpu } from './gpu.mjs';
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const origin = argv[0]?.startsWith('http') ? argv[0] : 'http://localhost:5198';
const camera = opt('camera', 'third'), out = opt('out', 'qa/p2c');
const CARD = { third: 'THIRD PERSON', chase: 'CHASE', cockpit: 'COCKPIT' }[camera];
const b = await chromium.launch({ channel: 'chrome', headless: true, args: [...gpuArgs, '--enable-precise-memory-info'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const gpu = await assertGpu(p);
const logs = [];
p.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(m.text().slice(0, 200)); });
p.on('pageerror', e => logs.push('pageerror ' + e.message));
await p.addInitScript(() => {
  if (!sessionStorage.getItem('qa-seeded')) {
    sessionStorage.setItem('qa-seeded', '1');
    localStorage.setItem('spacewar.darkedition.save.v1', JSON.stringify({ version: 1, profile: {}, settings: { graphics: { preset: 'high', autoPicked: true }, gpuHintShown: true } }));
  }
  // flow timeline (ms since navigation) for the report
  window.__flowLog = [];
  const t = setInterval(() => {
    const s = window.__G1__?.flowState?.get?.();
    if (s && window.__flowLog.at(-1)?.[0] !== s) window.__flowLog.push([s, Math.round(performance.now())]);
  }, 20);
  window.__stopFlowLog = () => clearInterval(t);
  // QA_TRACE_ALLOC=1: stacks of GL textures / buffers created once play started
  window.__allocs = [];
  for (const fn of ['createTexture', 'createBuffer']) {
    const orig = WebGL2RenderingContext.prototype[fn];
    WebGL2RenderingContext.prototype[fn] = function () {
      if (window.__G1__?.flowState?.get?.() === 'mission.playing') window.__allocs.push([fn, Math.round(performance.now()), new Error().stack.split('\n').slice(2, 9).map(l => l.trim().replace(/https?:\/\/[^)]*\//, '')).join(' < ')]);
      return orig.call(this);
    };
  }
});
await p.goto(`${origin}/game/g1/?boot=0&debug=1`);
const flow = () => p.evaluate(() => window.__G1__.flowState.get());
const until = (state, timeout = 60000) => p.waitForFunction(s => window.__G1__?.flowState?.get() === s, state, { timeout, polling: 50 });
await until('hangar.idle');
await p.waitForTimeout(2500);
const shots = [];
const shot = async name => { const f = `${out}/prod-${camera}-${name}.png`; await p.screenshot({ path: f }); shots.push(f); };
await p.click('button[aria-label^="Start mission"]');
await until('launch.briefing');
await p.waitForTimeout(1200);
await shot('1-briefing');
await p.click('button:has-text("LET\'S GO")'); // first press finishes the typewriter
await p.waitForTimeout(300);
await p.click('button:has-text("LET\'S GO")');
await until('launch.cameraSelect');
await p.waitForTimeout(500);
await shot('2-camera-select');
await p.click(`[role="radiogroup"][aria-label="Camera mode"] [role="radio"]:has-text("${CARD}")`);
await until('launch.standby');
const tStandby = Date.now();
await p.waitForTimeout(600);
await shot('3-standby');
await until('mission.launching', 15000);
const beatMs = Date.now() - tStandby;
await p.waitForTimeout(1500);
await shot('4-launching');
await until('mission.playing', 30000);
const atPlaying = await p.evaluate(() => window.__G1__.info());
const level = await p.evaluate(() => window.__G1__.mission.state().level);
await p.waitForTimeout(1500);
await shot('5-playing');
// real keyboard flight (the page has had gestures: START MISSION etc.)
const pos = () => p.evaluate(() => { const s = window.__G1__.sim.state(); return { x: +s.x.toFixed(2), y: +s.y.toFixed(2), s: Math.round(s.s), bot: !!window.__G1__.mission.state().bot }; });
const p0 = await pos();
await p.keyboard.down('KeyD');
await p.waitForTimeout(900);
await p.keyboard.up('KeyD');
const pR = await pos();
await shot('6-strafe-right');
await p.keyboard.down('KeyA');
await p.waitForTimeout(1600);
await p.keyboard.up('KeyA');
const pL = await pos();
await p.keyboard.down('KeyW');
await p.waitForTimeout(900);
await p.keyboard.up('KeyW');
const pU = await pos();
await shot('7-climb');
await p.waitForTimeout(500);
const table = await p.evaluate(() => window.__G1__.perf.table());
const after = await p.evaluate(() => window.__G1__.info());
const timeline = await p.evaluate(() => { window.__stopFlowLog(); return window.__flowLog; });
const same = ['programs', 'geometries', 'textures'].every(k => atPlaying[k] === after[k]);
const flies = pR.x > p0.x + 1 && pL.x < pR.x - 1 && pU.y > pL.y + 1;
const ok = level === 'l01' && same && flies && !logs.length && !table.longTasks.length;
const allocs = await p.evaluate(() => window.__allocs);
console.log(JSON.stringify({ gpu, camera, level, allocs, standbyBeatMs: beatMs, timeline, positions: { start: p0, right: pR, left: pL, up: pU }, flies, programsConstant: same, atPlaying, after, perf: { avgFps: table.avgFps, p95: table.p95, longTasks: table.longTasks }, shots, logs }, null, 1));
await b.close();
process.exit(ok ? 0 : 1);
