// CPU profile of the cockpit entry (CDP): hangar idle -> START MISSION ->
// standby (via the real flow). For each long task (> 50 ms, the brief §6
// budget) the top self-time functions, the sum of synchronous program links,
// and the inclusive time of selected app functions.
//   node tools/prof-launch.mjs [origin] [--settle ms]
// G1_DGPU=1 (+ WSLENV=G1_DGPU) runs on the discrete GPU.
import { chromium } from 'playwright';
const argv = process.argv.slice(2);
const origin = argv[0]?.startsWith('http') ? argv[0] : 'http://localhost:5199';
const si = argv.indexOf('--settle');
const settle = si >= 0 ? +argv[si + 1] : 16000;
const args = ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', ...(process.env.G1_DGPU ? ['--force_high_performance_gpu'] : [])];
const b = await chromium.launch({ channel: 'chrome', headless: true, args });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const cdp = await p.context().newCDPSession(p);
await p.addInitScript(() => {
  window.__lt = [];
  new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push({ start: e.startTime, dur: e.duration }); }).observe({ type: 'longtask', buffered: true });
});
await p.goto(`${origin}/game/g1/?boot=0&debug=1`);
await p.waitForTimeout(settle); // hangar idle work (preloads, thumbnails, cockpit pre-warm) done
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
await cdp.send('Profiler.start');
const tStart = await p.evaluate(() => performance.now());
await p.click('button[aria-label^="Start mission"]');
await p.waitForFunction(() => window.__G1__.flowState.get() === 'launch.briefing', null, { timeout: 30000 });
await p.keyboard.press('Enter');
await p.keyboard.press('Enter');
await p.waitForTimeout(700);
await p.keyboard.press('3');
await p.waitForTimeout(1500);
const { profile } = await cdp.send('Profiler.stop');
const lts = (await p.evaluate(() => window.__lt)).filter(t => t.dur > 50 && t.start >= tStart);
const nodes = new Map(profile.nodes.map(n => [n.id, n]));
const parent = new Map();
for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
const originUs = profile.startTime - tStart * 1000;
let t = profile.startTime;
const samples = profile.samples.map((id, i) => {
  t += profile.timeDeltas[i];
  return { id, ms: (t - originUs) / 1000 };
});
const label = n => `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop().split('?')[0]}:${n.callFrame.lineNumber}`;
// first app-source frame up the stack (what in OUR code caused it)
const appFrame = id => {
  for (let cur = id; cur != null; cur = parent.get(cur)) {
    const n = nodes.get(cur);
    if (/\/game\/g1\/src\//.test(n.callFrame.url)) return label(n);
  }
  return '(no app frame)';
};
const out = { longTasks: [] };
for (const lt of lts) {
  const self = new Map(), app = new Map();
  for (const s of samples) {
    if (s.ms < lt.start || s.ms > lt.start + lt.dur) continue;
    const k = label(nodes.get(s.id));
    self.set(k, (self.get(k) ?? 0) + 0.5);
    const a = appFrame(s.id);
    app.set(a, (app.get(a) ?? 0) + 0.5);
  }
  const top = m => [...m.entries()].sort((x, y) => y[1] - x[1]).slice(0, 5).map(([k, v]) => `${Math.round(v)}ms ${k}`);
  out.longTasks.push({ at: Math.round(lt.start - tStart), dur: Math.round(lt.dur), self: top(self), app: top(app) });
}
console.log(JSON.stringify(out, null, 1));
await b.close();
