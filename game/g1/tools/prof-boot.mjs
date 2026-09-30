// CPU profile of the boot (CDP): for each long task (> 120 ms) inside
// [fromMs, toMs], the top self-time functions, plus the total time spent in
// synchronous program links. node tools/prof-boot.mjs [origin] [fromMs] [toMs]
import { chromium } from 'playwright';
const origin = process.argv[2] ?? 'http://localhost:5199';
const from = +(process.argv[3] ?? 0), to = +(process.argv[4] ?? 13000);
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const cdp = await p.context().newCDPSession(p);
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
await p.addInitScript(() => {
  window.__lt = [];
  new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push({ start: e.startTime, dur: e.duration }); }).observe({ type: 'longtask', buffered: true });
});
await p.goto(origin + '/game/g1/?debug=1', { waitUntil: 'commit' });
await cdp.send('Profiler.start');
const tStart = await p.evaluate(() => performance.now()); // page ms at profiler start
await p.waitForTimeout(+(process.env.PROF_MS || 13000));
const { profile } = await cdp.send('Profiler.stop');
const lts = (await p.evaluate(() => window.__lt)).filter(t => t.dur > 120 && t.start >= from && t.start <= to);
const nodes = new Map(profile.nodes.map(n => [n.id, n]));
const originUs = profile.startTime - tStart * 1000;
let t = profile.startTime;
const samples = profile.samples.map((id, i) => {
  t += profile.timeDeltas[i];
  return { id, ms: (t - originUs) / 1000 };
});
const label = n => `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop().split('?')[0]}:${n.callFrame.lineNumber}`;
let link = 0;
for (const s of samples) if (/onFirstUse|WebGLUniforms/.test(nodes.get(s.id).callFrame.functionName)) link += 0.5;
console.log(`sync program link total: ${Math.round(link)} ms`);
for (const lt of lts) {
  const agg = new Map();
  for (const s of samples) {
    if (s.ms < lt.start || s.ms > lt.start + lt.dur) continue;
    const k = label(nodes.get(s.id));
    agg.set(k, (agg.get(k) ?? 0) + 0.5);
  }
  const top = [...agg.entries()].sort((a, b2) => b2[1] - a[1]).slice(0, 6);
  console.log(`LT @${Math.round(lt.start)} ${Math.round(lt.dur)}ms: ` + top.map(([k, v]) => `${Math.round(v)}ms ${k}`).join(' | '));
}
await b.close();
