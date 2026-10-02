// World look-dev captures (Phase 2R §17): opens ?screen=worldlab, parks the
// camera at each beauty shot, waits until terrain streaming has settled
// (no pending tiles, no late tiles) and saves a frame; then flies a stretch
// at cruise speed to measure fps / tile stats. Every frame must be LOOKED AT.
//   node tools/qa-worldlab.mjs [origin] [--out qa/p2r/lab] [--tag clay] [--preset high] [--fly 12]
import { chromium } from 'playwright';
import { gpuArgs, assertGpu } from './gpu.mjs';
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const origin = argv[0]?.startsWith('http') ? argv[0] : 'http://localhost:5198';
const out = opt('out', 'qa/p2r/lab'), tag = opt('tag', 'clay'), preset = opt('preset', 'high'), flySec = +opt('fly', 12);
// ARDEN beauty shots (s, u, alt above the path, yaw / pitch deg)
const SHOTS = [
  ['river-skim', { s: 1250, u: 0, alt: -4, yaw: 0, pitch: -2 }],
  ['valley-forward', { s: 300, u: 0, alt: 10, yaw: 0, pitch: -5 }],
  ['gorge-narrows', { s: 4700, u: 0, alt: 0, yaw: 0, pitch: 2 }],
  ['panorama-climb', { s: 3500, u: 0, alt: 60, yaw: 0, pitch: -8 }],
  ['wall-side', { s: 2200, u: -40, alt: 20, yaw: 55, pitch: 6 }],
  ['look-back', { s: 6900, u: 0, alt: 40, yaw: 180, pitch: -10 }],
];
const b = await chromium.launch({ channel: 'chrome', headless: true, args: [...gpuArgs, '--enable-precise-memory-info'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const gpu = await assertGpu(p);
const logs = [];
p.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(m.text().slice(0, 200)); });
p.on('pageerror', e => logs.push('pageerror ' + e.message));
await p.addInitScript(pr => localStorage.setItem('spacewar.darkedition.save.v1', JSON.stringify({ version: 1, profile: {}, settings: { graphics: { preset: pr, autoPicked: true }, gpuHintShown: true } })), preset);
await p.goto(`${origin}/game/g1/?boot=0&debug=1&drs=0&screen=worldlab`);
await p.waitForFunction(() => !!window.__G1__?.worldlab, null, { timeout: 90000, polling: 100 });
const shots = [];
for (const [name, cam] of SHOTS) {
  await p.evaluate(c => { window.__G1__.worldlab.fly(false); window.__G1__.worldlab.set(c); }, cam);
  await p.waitForFunction(() => window.__G1__.worldlab.settled(), null, { timeout: 30000, polling: 100 }).catch(() => {});
  await p.waitForTimeout(400);
  const f = `${out}/${tag}-${name}.png`;
  await p.screenshot({ path: f });
  shots.push(f);
}
// fly a stretch at cruise speed
await p.evaluate(() => { window.__G1__.worldlab.set({ s: 100, u: 0, alt: 0, yaw: 0, pitch: -3 }); });
await p.waitForFunction(() => window.__G1__.worldlab.settled(), null, { timeout: 30000, polling: 100 }).catch(() => {});
const before = await p.evaluate(() => window.__G1__.info());
await p.evaluate(() => { window.__G1__.worldlab.fly(true, 58); window.__G1__.perf.reset('lab'); });
let lateMax = 0;
for (let t = 0; t < flySec; t++) {
  await p.waitForTimeout(1000);
  lateMax = Math.max(lateMax, await p.evaluate(() => window.__G1__.worldlab.stats().lateTiles));
}
const table = await p.evaluate(() => window.__G1__.perf.table());
const stats = await p.evaluate(() => window.__G1__.worldlab.stats());
const after = await p.evaluate(() => window.__G1__.info());
console.log(JSON.stringify({ gpu, preset, shots, lateMax, stats, perf: { avgFps: table.avgFps, p95: table.p95, calls: table.drawCalls, tris: table.triangles, render: table.sections?.render, longTasks: table.longTasks }, before: { programs: before.programs, geometries: before.geometries, textures: before.textures }, after: { programs: after.programs, geometries: after.geometries, textures: after.textures }, logs }, null, 1));
await b.close();
