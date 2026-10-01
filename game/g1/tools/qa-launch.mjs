// Cockpit entry round trip (brief §15): START MISSION -> bulkhead -> cockpit
// reveal -> systems boot -> briefing -> LET'S GO -> camera select -> STANDBY
// -> ESC -> hangar. Screenshots at each beat, flow trace, long tasks.
//   node tools/qa-launch.mjs [origin] [tag]
import { chromium } from 'playwright';
const origin = process.argv[2]?.startsWith('http') ? process.argv[2] : 'http://localhost:5199';
const tag = process.argv.find((a, i) => i > 1 && !a.startsWith('http')) ?? 'p1';
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', ...(process.env.G1_DGPU ? ['--force_high_performance_gpu'] : [])] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const logs = [];
p.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(m.text()); });
p.on('pageerror', e => logs.push('pageerror ' + e.message));
await p.addInitScript(() => {
  window.__lt = [];
  new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push({ start: Math.round(e.startTime), dur: Math.round(e.duration) }); }).observe({ type: 'longtask', buffered: true });
});
await p.goto(`${origin}/game/g1/?boot=0&debug=1`);
await p.waitForTimeout(9000); // hangar settles + cockpit pre-warm
const flow = () => p.evaluate(() => window.__G1__.flowState.get());
const shot = n => p.screenshot({ path: `qa/1g-${tag}-${n}.png` });
const trace = [];
const t0 = await p.evaluate(() => performance.now());
// 0.5 s beats (sealed) can fall between polls during the swap's main-thread work: run at 0.3x
await p.evaluate(() => window.__G1__.launch.rate(0.3));
await p.click('button[aria-label^="Start mission"]');
const at = async (name, cond) => {
  await p.waitForFunction(cond, null, { timeout: 40000, polling: 16 });
  trace.push({ at: name, state: await flow(), ms: Math.round((await p.evaluate(() => performance.now())) - t0) });
  await shot(name);
};
await at('closing', () => { const d = window.__G1__.launch.doorsP(); return d < 0.6 && d > 0.2; });
await at('sealed', () => window.__G1__.launch.doorsP() < 0.001 && window.__G1__.launch.stage().cockpit === 0);
await at('reveal', () => window.__G1__.launch.stage().cockpit === 1 && window.__G1__.launch.doorsP() > 0.4);
await at('boot', () => window.__G1__.flowState.get() === 'launch.reveal' && !window.__G1__.launch.bulkhead().active);
await at('briefing-typing', () => window.__G1__.flowState.get() === 'launch.briefing');
await p.evaluate(() => window.__G1__.launch.rate(1));
await p.waitForTimeout(9000);
await shot('briefing-done');
trace.push({ state: await flow() });
await p.click('button:has-text("LET\'S GO")');
await p.waitForTimeout(700);
trace.push({ state: await flow() });
await shot('select');
await p.keyboard.press('2');
await p.waitForTimeout(900);
trace.push({ state: await flow(), mode: await p.evaluate(() => JSON.parse(localStorage.getItem('spacewar.darkedition.save.v1') || '{}').settings?.camera?.mode) });
await shot('standby');
const tris = await p.evaluate(() => window.__G1__.cockpit?.tris());
const info = await p.evaluate(() => window.__G1__.info());
const fps = await p.evaluate(() => window.__G1__.fps());
await p.keyboard.press('Escape');
await p.waitForTimeout(900);
await shot('return-sealed');
await p.waitForTimeout(3200);
trace.push({ state: await flow() });
await shot('back');
const lt = (await p.evaluate(() => window.__lt)).filter(x => x.start > t0 && x.dur > 50);
console.log(JSON.stringify({ trace, tris, info, fps, longTasks: lt, logs }, null, 1));
await b.close();
