// BARREL ROLL QA (Planet 1 §1.2), production build: per rig, `--rolls` consecutive Q/E rolls (sim.force,
// alternating direction, one per 1.2 s — past the 1.1 s cooldown). An in-page requestAnimationFrame
// recorder logs every frame's duration plus the ship roll angle and the camera roll, and checks:
// zero frames > 20 ms across the run; each roll is monotonic 0 -> 2 pi (+-2 %) within 0.55 s (+-0.03,
// at display rate); the camera never jumps > 3 deg in a frame at a roll's END (no snap); FULLY ATTACHED
// camera roll stays within the 25 deg wobble (+ bank); programs / geometries / textures constant.
// Then 10 rolls mid-turn and 8 pressed against a wall (same checks bar the wobble bound). A still
// mid-roll per rig, taken after recording.
//   node tools/qa-roll.mjs [origin] [--modes third,chase,cockpit] [--rolls 50] [--attach attached|steady] [--out qa/a2]
// (STEADY HORIZON: the camera stays level through a roll, <= 2 deg)
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { gpuArgs, assertGpu } from './gpu.mjs';
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const origin = argv[0]?.startsWith('http') ? argv[0] : 'http://localhost:5198';
const modes = opt('modes', 'third,chase,cockpit').split(',');
const rolls = Number(opt('rolls', '50'));
const out = opt('out', 'qa/a2');
const attach = opt('attach', 'attached');
mkdirSync(out, { recursive: true });
const DEG = Math.PI / 180;
const result = { gpu: null, rigs: {} };
const fails = [];
const check = (c, m) => { if (!c) fails.push(m); };

for (const mode of modes) {
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: [...gpuArgs, '--enable-precise-memory-info'] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  result.gpu = await assertGpu(p);
  const logs = [];
  p.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(m.text().slice(0, 200)); });
  p.on('pageerror', e => logs.push('pageerror ' + e.message));
  await p.addInitScript(([m]) => localStorage.setItem('spacewar.darkedition.save.v1', JSON.stringify({ version: 2, profile: {}, settings: { graphics: { preset: 'high', autoPicked: true }, gpuHintShown: true, camera: { mode: m, shake: 0 } } })), [mode]);
  await p.goto(`${origin}/game/g1/?level=l01&debug=1&drs=0&god=1&launch=skip`);
  await p.waitForFunction(() => window.__G1__?.flowState?.get() === 'mission.playing', null, { timeout: 120000, polling: 100 });
  await p.evaluate(a => window.__G1__.flight.settings('camera', { attachment: a }), attach);
  await p.waitForTimeout(2500);
  const info0 = await p.evaluate(() => window.__G1__.info());
  // in-page per-frame recorder (ship roll angle, camera roll, frame duration)
  await p.evaluate(() => {
    const rec = (window.__rollRec = { frames: [], on: true, phase: 0, long: [] });
    new PerformanceObserver(l => { for (const e of l.getEntries()) rec.long.push([+e.startTime.toFixed(0), +e.duration.toFixed(0), e.name, JSON.stringify(e.attribution?.map(a => [a.containerType, a.containerName, a.containerSrc]) ?? [])]); }).observe({ type: 'longtask', buffered: false });
    let last = performance.now();
    const tick = now => {
      const f = window.__G1__.flight.probe();
      if (f) rec.frames.push([now - last, f.att.roll, f.cam.roll, f.att.bank, rec.phase, now, window.__G1__.mission.state().progress]);
      last = now;
      if (rec.on) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  // phase 0: `rolls` straight rolls; phase 1: 10 rolls mid-turn (steering alternating); phase 2: pressed
  // against a wall (steer held 4 s first), 8 rolls with the steer held
  const setPhase = n => p.evaluate(n => (window.__rollRec.phase = n), n);
  const roll = async (d, steer) => {
    await p.evaluate(([d, x]) => window.__G1__.sim.force(x ? { roll: d, moveX: x } : { roll: d }), [d, steer]);
    await p.waitForTimeout(60);
    await p.evaluate(x => window.__G1__.sim.force(x ? { moveX: x } : null), steer);
    await p.waitForTimeout(1140);
  };
  for (let i = 0; i < rolls; i++) await roll(i % 2 ? -1 : 1, 0);
  await setPhase(1);
  for (let i = 0; i < 10; i++) await roll(i % 2 ? -1 : 1, i % 2 ? 1 : -1);
  await p.evaluate(() => window.__G1__.sim.force({ moveX: 1 }));
  await p.waitForTimeout(4000);
  await setPhase(2);
  for (let i = 0; i < 8; i++) await roll(i % 2 ? -1 : 1, 1);
  await p.evaluate(() => window.__G1__.sim.force(null));
  const [frames, longTasks] = await p.evaluate(() => { window.__rollRec.on = false; return [window.__rollRec.frames, window.__rollRec.long]; });
  // a still mid-roll (after recording: a headless screenshot stalls the compositor)
  await p.evaluate(() => window.__G1__.sim.force({ roll: 1 }));
  await p.waitForTimeout(230);
  await p.screenshot({ path: `${out}/roll-${mode}-${attach}-mid.png` });
  await p.evaluate(() => window.__G1__.sim.force(null));
  const info1 = await p.evaluate(() => window.__G1__.info());
  // analyse: slow frames; each roll's angle trace (the stretch where |roll| > 0). The end check is the
  // HANDOFF (the roll's last frame -> the first two without it): camera step < 3 deg, and the change in
  // step across settle -> handoff < 3 deg/frame (no discontinuity; the settle itself legitimately moves
  // the cockpit view several degrees a frame as it decelerates)
  const slowList = frames.map((f, i) => [i, +f[0].toFixed(1), f[4], +f[5].toFixed(0), +(+f[6]).toFixed(3), +(f[1] / DEG).toFixed(0)]).filter(f => f[1] > 20);
  const slow = slowList.length;
  const wrap = d => { d = Math.abs(d) % (2 * Math.PI); return Math.min(d, 2 * Math.PI - d); };
  // the roll's share of the camera roll: camera minus bank (post-roll the camera tracks the bank exactly;
  // the bank spring is C1 by construction and swings at its own pace through wall contact)
  // STEADY HORIZON's camera ignores the bank: there the raw camera roll is the roll's share
  const bankIn = attach === 'steady' ? 0 : 1;
  const camStep = k => wrap(frames[k][2] - bankIn * frames[k][3] - (frames[k - 1][2] - bankIn * frames[k - 1][3]));
  let worst = null, count = 0, nonMono = 0, under = 0, longest = 0, shortest = 1e9, endJump = 0, endAccel = 0, maxCam = 0;
  const perPhase = [0, 0, 0];
  for (let i = 1; i < frames.length; i++) {
    if (frames[i][1] !== 0 && frames[i - 1][1] === 0) {
      // a roll starts: walk it
      let j = i, peak = 0, t = 0, prev = 0;
      const phase = frames[i][4];
      for (; j < frames.length && frames[j][1] !== 0; j++) {
        const a = Math.abs(frames[j][1]);
        if (a + 1e-6 < prev) nonMono++;
        prev = a;
        peak = Math.max(peak, a);
        t += frames[j][0];
        if (phase === 0) maxCam = Math.max(maxCam, Math.abs(frames[j][2]));
      }
      count++;
      perPhase[phase]++;
      if (peak < 2 * Math.PI * 0.98) under++;
      // durations only from frames that rendered at display rate (a roll's end is resolved per frame)
      longest = Math.max(longest, t / 1000);
      shortest = Math.min(shortest, t / 1000);
      for (let k = j; k < Math.min(frames.length, j + 2); k++) {
        if (camStep(k) > endJump) worst = { phase, at: k - j, trace: frames.slice(j - 4, j + 4).map(f => [+f[0].toFixed(1), +(f[1] / DEG).toFixed(1), +(f[2] / DEG).toFixed(2), +(f[3] / DEG).toFixed(2)]) };
        endJump = Math.max(endJump, camStep(k));
      }
      for (let k = j; k < Math.min(frames.length, j + 2); k++) endAccel = Math.max(endAccel, Math.abs(camStep(k) - camStep(k - 1)));
      i = j;
    }
  }
  const same = ['programs', 'geometries', 'textures'].every(k => info0[k] === info1[k]);
  const R = { frames: frames.length, slowFrames: slow, slowList: slowList.slice(0, 10), longTasks: longTasks.slice(0, 10), rollsSeen: count, perPhase, nonMonotonic: nonMono, underTurned: under, durationSec: [+shortest.toFixed(3), +longest.toFixed(3)], endCameraJumpDeg: +(endJump / DEG).toFixed(2), endCameraAccelDeg: +(endAccel / DEG).toFixed(2), worst, maxCameraRollDeg: +(maxCam / DEG).toFixed(1), resources: [info0.programs, info0.geometries, info0.textures, '->', info1.programs, info1.geometries, info1.textures], logs };
  result.rigs[mode] = R;
  R.attach = attach;
  check(slow === 0, `${mode}: ${slow} frames > 20 ms across ${rolls} rolls`);
  check(perPhase[0] >= rolls - 1 && perPhase[1] >= 9 && perPhase[2] >= 7, `${mode}: saw ${JSON.stringify(perPhase)} rolls of [${rolls},10,8]`);
  check(nonMono === 0, `${mode}: roll angle not monotonic (${nonMono})`);
  check(under === 0, `${mode}: ${under} rolls short of 2 pi`);
  check(shortest > 0.55 - 0.03 - 0.02 && longest < 0.55 + 0.03 + 0.02, `${mode}: roll durations ${shortest.toFixed(3)}-${longest.toFixed(3)} s`);
  check(endJump < 3 * DEG, `${mode}: camera jumped ${(endJump / DEG).toFixed(1)} deg at a roll's end`);
  check(endAccel < 3 * DEG, `${mode}: camera step changed ${(endAccel / DEG).toFixed(1)} deg/frame around a roll's end`);
  if (attach === 'steady') check(maxCam <= 2 * DEG, `${mode}: steady camera rolled ${(maxCam / DEG).toFixed(1)} deg (level)`);
  else if (mode !== 'cockpit') check(maxCam <= 25 * DEG + 2 * DEG, `${mode}: attached camera rolled ${(maxCam / DEG).toFixed(1)} deg (wobble <= 25)`);
  check(same, `${mode}: resources changed ${JSON.stringify(R.resources)}`);
  check(!logs.length, `${mode}: console ${JSON.stringify(logs.slice(0, 3))}`);
  await b.close();
}
result.fails = fails;
result.ok = !fails.length;
writeFileSync(`${out}/roll.json`, JSON.stringify(result, null, 1));
console.log(JSON.stringify(result, null, 1));
process.exit(result.ok ? 0 : 1);
