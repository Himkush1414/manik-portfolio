// Time of day + grade QA (Creative Bible AC5.1 / AC5.3, W2b): flies a level and
// saves stills at its time-of-day points (default: start, middle, end), reads
// the sun elevation / exposure the mission applied, and checks programs /
// textures / geometries stay constant across the whole timeline (a sunrise is
// uniforms only), console clean, perf while flying. Then sweeps the WHOLE level
// (every --sweep m, 4 frames each) and fails on any black frame: one NaN / Inf
// pixel in the HDR buffer is smeared over the screen by bloom (found 2026-10-03
// in late Level 1, never covered by the test-level gates).
//   node tools/qa-tod.mjs [origin] [--level l01] [--at 200,4000,9800] [--mode third] [--out qa/w2b] [--sweep 500] [--length 10200]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { gpuArgs, assertGpu } from './gpu.mjs';
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const origin = argv[0]?.startsWith('http') ? argv[0] : 'http://localhost:5198';
const level = opt('level', 'l01');
const at = opt('at', '200,4000,9800').split(',').map(Number);
const mode = opt('mode', 'third');
const out = opt('out', 'qa/w2b');
const sweep = Number(opt('sweep', '500'));
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true, args: [...gpuArgs, '--enable-precise-memory-info'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const gpu = await assertGpu(p);
const logs = [];
p.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(m.text().slice(0, 200)); });
p.on('pageerror', e => logs.push('pageerror ' + e.message));
await p.addInitScript(([m]) => localStorage.setItem('spacewar.darkedition.save.v1', JSON.stringify({ version: 2, profile: {}, settings: { graphics: { preset: 'high', autoPicked: true }, gpuHintShown: true, camera: { mode: m, shake: 0 } } })), [mode]);
await p.goto(`${origin}/game/g1/?level=${level}&debug=1&drs=0&god=1&launch=skip`);
await p.waitForFunction(() => window.__G1__?.flowState?.get() === 'mission.playing', null, { timeout: 120000, polling: 100 });
const info0 = await p.evaluate(() => window.__G1__.info());
const points = [];
for (const s of at) {
  await p.evaluate(m => window.__G1__.mission.jump(m), s);
  await p.waitForTimeout(1600); // tiles stream in around the new position
  await p.evaluate(() => window.__G1__.perf.reset('tod'));
  await p.waitForTimeout(1000);
  const tb = await p.evaluate(() => window.__G1__.perf.table());
  const tod = await p.evaluate(() => window.__G1__.tod?.state() ?? null);
  const file = `${out}/tod-${level}-${mode}-${s}.png`;
  await p.screenshot({ path: file });
  points.push({ s, tod, fps: tb.avgFps, p95: tb.p95, file });
}
// continuous flight through the sunrise (keyframe env probes recapture as the sun climbs): frame times
await p.evaluate(m => window.__G1__.mission.jump(m), 600);
await p.waitForTimeout(1500);
const cap0 = (await p.evaluate(() => window.__G1__.tod.state())).probeCaptures;
await p.evaluate(() => window.__G1__.perf.reset('tod-fly'));
await p.waitForTimeout(12000);
const fly = await p.evaluate(() => window.__G1__.perf.table());
const cap1 = (await p.evaluate(() => window.__G1__.tod.state())).probeCaptures;
const flight = { avgFps: fly.avgFps, p95: fly.p95, p99: fly.p99, max: fly.max ?? null, longTasks: fly.longTasks.length, probeCaptures: cap1 - cap0 };
// whole-level black-frame sweep (an all-black 1920x1080 PNG is ~20 kB; a real frame is > 500 kB)
const lengthM = Number(opt('length', '10200'));
const blackAt = [];
let sweptFrames = 0;
for (let s = 0; s < lengthM - 200; s += sweep) {
  await p.evaluate(m => window.__G1__.mission.jump(m), s);
  await p.waitForTimeout(700);
  for (let k = 0; k < 4; k++) {
    sweptFrames++;
    if ((await p.screenshot()).length < 100000) blackAt.push(s);
    await p.waitForTimeout(90);
  }
}
const info1 = await p.evaluate(() => window.__G1__.info());
const constant = ['programs', 'textures', 'geometries'].every(k => info0[k] === info1[k]);
const rising = points.every((q, i) => i === 0 || !q.tod || !points[i - 1].tod || q.tod.sunEl >= points[i - 1].tod.sunEl);
const r = { gpu, level, mode, flight, sweptFrames, blackAt, points, programs: [info0.programs, info1.programs], constant, rising, logs };
writeFileSync(`${out}/tod-${level}-${mode}.json`, JSON.stringify(r, null, 1));
console.log(JSON.stringify(r, null, 1));
await b.close();
process.exit(constant && !logs.length && !blackAt.length && flight.avgFps >= 58 && flight.longTasks === 0 && points.every(q => q.fps >= 58 && q.tod) ? 0 : 1);
