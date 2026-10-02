// Launch-sequence capture (brief §21 group 1: "12 frames: countdown, clamps,
// tunnel run, Veil Gate, breach"). Runs the REAL path (hangar -> cockpit ->
// standby -> LAUNCH) via ?level=, slows GSAP's global clock once the launch
// starts so each beat is caught, and saves frames for each camera mode.
//   node tools/qa-launch-seq.mjs [origin] [--modes cockpit,third] [--out qa/p2b] [--rate 0.25]
import { chromium } from 'playwright';
import { gpuArgs, assertGpu } from './gpu.mjs';
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const origin = argv[0]?.startsWith('http') ? argv[0] : 'http://localhost:5198';
const modes = opt('modes', 'cockpit,third').split(',');
const out = opt('out', 'qa/p2b');
const rate = +opt('rate', 0.25);
const args = [...gpuArgs];
const result = {};
for (const mode of modes) {
  const b = await chromium.launch({ channel: 'chrome', headless: true, args });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  const gpu = await assertGpu(p);
  const logs = [];
  p.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(m.text().slice(0, 160)); });
  p.on('pageerror', e => logs.push('pageerror ' + e.message));
  await p.addInitScript(m => localStorage.setItem('spacewar.darkedition.save.v1', JSON.stringify({ version: 1, profile: {}, settings: { graphics: { preset: 'high', autoPicked: true }, gpuHintShown: true, camera: { mode: m } } })), mode);
  await p.goto(`${origin}/game/g1/?level=test&bot=mid&debug=1&drs=0`);
  await p.waitForFunction(() => window.__G1__?.flowState?.get() === 'mission.launching', null, { timeout: 120000, polling: 20 });
  await p.evaluate(r => window.__G1__.launch.rate(r), rate);
  // beats in launch-timeline seconds (countdown 0-3, catapult 3-6.3, breach ~6.1-6.3)
  const beats = [0.3, 1.3, 2.3, 3.05, 3.6, 4.4, 5.0, 5.5, 5.9, 6.15, 6.35, 6.8];
  const t0 = Date.now();
  const frames = [];
  for (const bt of beats) {
    const wait = (bt / rate) * 1000 - (Date.now() - t0);
    if (wait > 0) await p.waitForTimeout(wait);
    const file = `${out}/launch-${mode}-${bt.toFixed(2)}.png`;
    await p.screenshot({ path: file });
    frames.push({ t: bt, file, flow: await p.evaluate(() => window.__G1__.flowState.get()) });
  }
  await p.evaluate(() => window.__G1__.launch.rate(1));
  await p.waitForFunction(() => window.__G1__.flowState.get() === 'mission.playing', null, { timeout: 30000, polling: 50 });
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${out}/launch-${mode}-playing.png` });
  result[mode] = { frames: frames.map(f => `${f.t}:${f.flow}`), info: await p.evaluate(() => window.__G1__.info()), logs };
  await b.close();
}
console.log(JSON.stringify(result, null, 1));
