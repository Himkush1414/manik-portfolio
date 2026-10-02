// Camera rig switching (brief §8, 2C cp3/cp4): flies the test corridor in the
// saved mode, presses the REAL Cycle Camera key (KeyC) and captures the 0.6 s
// blend (never a hard cut), the settled view, and the mode reached. Checks
// programs / geometries / textures constant across switches, perf while
// switching, console clean.
//   node tools/qa-camera.mjs [origin] [--start third] [--cycles 3] [--out qa/p2c] [--preset high] [--noshots] [--hangar]
// --hangar: then leave through the bulkhead and check the cockpit root is back at its origin
import { chromium } from 'playwright';
import { gpuArgs, assertGpu } from './gpu.mjs';
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const origin = argv[0]?.startsWith('http') ? argv[0] : 'http://localhost:5198';
const noShots = argv.includes('--noshots');
const start = opt('start', 'third'), cycles = +opt('cycles', 3), out = opt('out', 'qa/p2c'), preset = opt('preset', 'high');
const b = await chromium.launch({ channel: 'chrome', headless: true, args: [...gpuArgs, '--enable-precise-memory-info'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const gpu = await assertGpu(p);
const logs = [];
p.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(m.text().slice(0, 200)); });
p.on('pageerror', e => logs.push('pageerror ' + e.message));
await p.addInitScript(([m, pr]) => localStorage.setItem('spacewar.darkedition.save.v1', JSON.stringify({ version: 1, profile: {}, settings: { graphics: { preset: pr, autoPicked: true }, gpuHintShown: true, camera: { mode: m } } })), [start, preset]);
await p.goto(`${origin}/game/g1/?level=test&debug=1&drs=0&god=1&launch=skip`);
await p.waitForFunction(() => window.__G1__?.flowState?.get() === 'mission.playing', null, { timeout: 120000, polling: 100 });
// resource snapshot AT the start of play: nothing may compile / upload after this
const atPlaying = await p.evaluate(() => window.__G1__.info());
// a real mission is entered by clicks, so audio is already up; with launch=skip the first
// gesture here would carry the one-off AudioContext init (P2.7) into the measured window
await p.keyboard.press('KeyJ');
await p.waitForTimeout(2500);
const rig = () => p.evaluate(() => window.__G1__.mission.rig());
const before = await p.evaluate(() => window.__G1__.info());
const steps = [{ at: 'start', ...(await rig()) }];
await p.screenshot({ path: `${out}/cam-${start}-settled.png` });
await p.evaluate(() => window.__G1__.perf.reset('switch'));
let ok = true;
for (let c = 0; c < cycles; c++) {
  await p.keyboard.press('KeyC');
  const r0 = await rig();
  const shots = [];
  for (const ms of [120, 300]) {
    await p.waitForTimeout(ms === 120 ? 120 : 180);
    const f = `${out}/cam-c${c + 1}-${r0.mode}-blend${ms}.png`;
    if (!noShots) await p.screenshot({ path: f });
    shots.push(f);
  }
  await p.waitForTimeout(900);
  const r1 = await rig();
  const f = `${out}/cam-c${c + 1}-${r1.mode}-settled.png`;
  if (!noShots) await p.screenshot({ path: f });
  const setting = await p.evaluate(() => JSON.parse(localStorage.getItem('spacewar.darkedition.save.v1') ?? '{}').settings?.camera?.mode ?? null);
  steps.push({ cycle: c + 1, blendingAfterPress: r0.blending, settled: r1, setting, shots: [...shots, f] });
  if (r1.blending) ok = false;
}
const table = await p.evaluate(() => window.__G1__.perf.table());
const after = await p.evaluate(() => window.__G1__.info());
let hangar = null;
if (argv.includes('--hangar')) {
  await p.evaluate(() => window.__G1__.sim.force({ moveX: 1, moveY: 1, boost: true, fire: true })); // hands deflected at exit
  await p.waitForTimeout(600);
  const handsFlying = await p.evaluate(() => window.__G1__.cockpit.hands());
  await p.evaluate(() => window.__G1__.mission.pause()); // HANGAR leaves from pause / failed / results
  await p.waitForTimeout(300);
  await p.evaluate(() => window.__G1__.mission.hangar());
  await p.waitForFunction(() => window.__G1__.flowState.get().startsWith('hangar'), null, { timeout: 30000, polling: 100 });
  await p.waitForTimeout(2500);
  hangar = await p.evaluate(() => {
    const r = window.__G1__.world.scene().getObjectByName('cockpit-root');
    return { flow: window.__G1__.flowState.get(), rig: window.__G1__.mission.rig(), rootPos: r.position.toArray().map(v => +v.toFixed(3)), rootQuat: r.quaternion.toArray().map(v => +v.toFixed(3)), rootVisible: r.visible, hands: window.__G1__.cockpit.hands() };
  });
  hangar.handsFlying = handsFlying;
  await p.screenshot({ path: `${out}/cam-hangar-after.png` });
  if (hangar.rig.interior || hangar.rootVisible || hangar.rootPos[2] !== -2600 || hangar.hands.stick.some(v => v !== 0) || hangar.hands.throttle !== 0) ok = false;
}
const same = ['programs', 'geometries', 'textures'].every(k => atPlaying[k] === before[k] && before[k] === after[k]);
if (!same || logs.length || table.longTasks.length) ok = false;
console.log(JSON.stringify({ gpu, start, steps, hangar, programsConstant: same, atPlaying: { programs: atPlaying.programs, geometries: atPlaying.geometries, textures: atPlaying.textures }, before: { programs: before.programs, geometries: before.geometries, textures: before.textures }, after: { programs: after.programs, geometries: after.geometries, textures: after.textures }, perf: { avgFps: table.avgFps, p95: table.p95, p99: table.p99, calls: table.drawCalls, longTasks: table.longTasks }, logs }, null, 1));
await b.close();
process.exit(ok ? 0 : 1);
