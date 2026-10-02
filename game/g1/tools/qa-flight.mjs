// Flight + weapons capture (brief §21 group 3: "each camera rig: idle, hard
// bank at envelope corners, boost, firing, taking damage, low hull"). Cuts
// straight into the test corridor (&launch=skip), then drives the REAL sim
// through __G1__.sim.force (input fields forced on top of the pilot) and
// saves one frame per beat per camera mode. Also records a perf table while
// firing continuously and checks programs / geometries / textures stay
// constant (no compile when the first bolt / spark / flash appears).
//   node tools/qa-flight.mjs [origin] [--modes third,chase,cockpit] [--out qa/p2c] [--preset high] [--tag x]
import { chromium } from 'playwright';
import { gpuArgs, assertGpu } from './gpu.mjs';
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const origin = argv[0]?.startsWith('http') ? argv[0] : 'http://localhost:5198';
const modes = opt('modes', 'third').split(',');
const out = opt('out', 'qa/p2c');
const preset = opt('preset', 'high');
const tag = opt('tag', '');
const args = [...gpuArgs, '--enable-precise-memory-info'];
const DEG = Math.PI / 180;
// beats: [name, forced input, hold ms before the shot]
const BEATS = [
  ['idle', null, 1200],
  ['fire', { fire: true }, 450],
  ['fire-aim-right', { fire: true, aimYaw: 14 * DEG, aimPitch: 4 * DEG }, 700],
  ['fire-wall', { fire: true, aimYaw: 22 * DEG, aimPitch: -10 * DEG }, 900],
  ['bank-left', { moveX: -1 }, 380],
  ['corner-left-up', { moveX: -1, moveY: 1 }, 1800],
  ['corner-right-down', { moveX: 1, moveY: -1 }, 2200],
  ['strafe-right-fire', { moveX: 1, fire: true }, 300],
  ['boost', { boost: true }, 900],
  ['boost-fire', { boost: true, fire: true, aimYaw: -6 * DEG }, 500],
  ['brake', { brake: true }, 900],
  ['roll', { roll: 1 }, 230],
];
const result = {};
let ok = true;
for (const mode of modes) {
  const b = await chromium.launch({ channel: 'chrome', headless: true, args });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  const gpu = await assertGpu(p);
  const logs = [];
  p.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(m.text().slice(0, 200)); });
  p.on('pageerror', e => logs.push('pageerror ' + e.message));
  await p.addInitScript(([m, pr]) => localStorage.setItem('spacewar.darkedition.save.v1', JSON.stringify({ version: 1, profile: {}, settings: { graphics: { preset: pr, autoPicked: true }, gpuHintShown: true, camera: { mode: m } } })), [mode, preset]);
  await p.goto(`${origin}/game/g1/?level=test&debug=1&drs=0&god=1&launch=skip`);
  await p.waitForFunction(() => window.__G1__?.flowState?.get() === 'mission.playing', null, { timeout: 120000, polling: 100 });
  await p.waitForTimeout(2500);
  const before = await p.evaluate(() => window.__G1__.info());
  const shots = [];
  for (const [name, force, hold] of BEATS) {
    await p.evaluate(f => window.__G1__.sim.force(f), force);
    await p.waitForTimeout(hold);
    const file = `${out}/flight-${mode}${tag}-${name}.png`;
    await p.screenshot({ path: file });
    shots.push(file);
    if (process.env.QA_BEAT_FPS) {
      await p.evaluate(() => window.__G1__.perf.reset('beat'));
      await p.waitForTimeout(1000);
      const tb = await p.evaluate(() => window.__G1__.perf.table());
      const sb = await p.evaluate(() => window.__G1__.sim.state());
      console.error(name, 'fps', tb.avgFps, 'p95', tb.p95, 's', Math.round(sb.s), 'x', sb.x.toFixed(1), 'y', sb.y.toFixed(1));
    }
  }
  // sustained fire: perf while bolts + sparks are live
  await p.evaluate(() => window.__G1__.sim.force({ fire: true, aimYaw: 0.3, aimPitch: 0.1 }));
  await p.waitForTimeout(500);
  const windows = [];
  for (let w = 0; w < 3; w++) {
    await p.evaluate(() => window.__G1__.perf.reset('fire'));
    await p.waitForTimeout(2000);
    const tw = await p.evaluate(() => window.__G1__.perf.table());
    windows.push([tw.avgFps, tw.p95, tw.frames, tw.seconds]);
  }
  console.error(mode, 'windows', JSON.stringify(windows));
  await p.evaluate(() => window.__G1__.perf.reset('fire'));
  await p.waitForTimeout(6000);
  const table = await p.evaluate(() => window.__G1__.perf.table());
  await p.evaluate(() => window.__G1__.sim.force(null));
  const after = await p.evaluate(() => window.__G1__.info());
  const sim = await p.evaluate(() => window.__G1__.sim.state());
  const same = ['programs', 'geometries', 'textures'].every(k => before[k] === after[k]);
  if (!same || logs.length || table.longTasks.length) ok = false;
  result[mode] = { gpu, programsConstant: same, before, after, perf: { avgFps: table.avgFps, p95: table.p95, p99: table.p99, calls: table.drawCalls, tris: table.triangles, sim: table.sections.sim, render: table.sections.render, longTasks: table.longTasks }, shotsFired: sim.shots, shots, logs };
  await b.close();
}
console.log(JSON.stringify(result, null, 1));
process.exit(ok ? 0 : 1);
