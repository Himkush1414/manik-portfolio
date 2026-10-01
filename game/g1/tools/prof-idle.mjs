// Long-task profiler over a time window (brief §4 carry-over (a)/(b)): loads
// the page, CPU-profiles (CDP) from load to --duration, optionally performs a
// real click at --click ms (first-gesture audio cost), and attributes every
// long task (> --min ms, default 50) to its top self-time functions and the
// first app-source frame up the stack. Run against the PRODUCTION build.
//   node tools/prof-idle.mjs [origin] [--query 'boot=0&debug=1'] [--duration 16000] [--click 9000] [--min 30]
// G1_DGPU=1 (+ WSLENV=G1_DGPU) runs on the discrete GPU.
import { chromium } from 'playwright';
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const origin = argv[0]?.startsWith('http') ? argv[0] : 'http://localhost:5198';
const query = opt('query', 'boot=0&debug=1');
const duration = +opt('duration', 16000);
const clickAt = opt('click', null);
const minMs = +opt('min', 50);
const args = ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', ...(process.env.G1_DGPU ? ['--force_high_performance_gpu'] : [])];
const b = await chromium.launch({ channel: 'chrome', headless: true, args });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const logs = [];
p.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(m.text().slice(0, 200)); });
const cdp = await p.context().newCDPSession(p);
await p.addInitScript(() => {
  window.__lt = [];
  new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push({ start: e.startTime, dur: e.duration }); }).observe({ type: 'longtask', buffered: true });
});
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 250 });
await cdp.send('Profiler.start');
const wall0 = Date.now();
await p.goto(`${origin}/game/g1/?${query}`);
if (clickAt) {
  await p.waitForTimeout(Math.max(0, +clickAt - (Date.now() - wall0)));
  const t = await p.evaluate(() => performance.now());
  await p.mouse.click(960, 540);
  logs.push(`[click at page t=${Math.round(t)}]`);
}
await p.waitForTimeout(Math.max(0, duration - (Date.now() - wall0)));
const { profile } = await cdp.send('Profiler.stop');
const marks = await p.evaluate(() => performance.getEntriesByType('mark').map(m => `${Math.round(m.startTime)} ${m.name}`));
const lts = (await p.evaluate(() => window.__lt)).filter(t => t.dur > minMs);
const nodes = new Map(profile.nodes.map(n => [n.id, n]));
const parent = new Map();
for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
let t = profile.startTime;
const raw = profile.samples.map((id, i) => {
  t += profile.timeDeltas[i];
  return { id, us: t };
});
const samples = raw.map(s => ({ id: s.id, ms: s.us / 1000 }));
const firstPage = samples.length ? samples[0].ms : 0;
const label = n => `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop().split('?')[0]}:${n.callFrame.lineNumber}`;
const appFrame = id => {
  for (let cur = id; cur != null; cur = parent.get(cur)) {
    const n = nodes.get(cur);
    if (/\/game\/g1\/(src|assets)\//.test(n.callFrame.url) && !/three|r3f|post/.test(n.callFrame.url.split('/').pop())) return label(n);
  }
  return '(no app frame)';
};
// profile timestamps (monotonic us) vs page time: pick the offset that maximises
// samples landing inside the observed long tasks (no clock-base assumptions).
let bestOff = 0, bestHits = -1;
const ltTot = lts.reduce((a, l) => a + l.dur, 0);
if (lts.length) {
  const guess = firstPage; // profile starts ~at navigation
  for (let off = guess - 3000; off <= guess + 3000; off += 2) {
    let hits = 0;
    for (const s of samples) {
      const pm = s.ms - off;
      for (const l of lts) if (pm >= l.start && pm <= l.start + l.dur) { hits++; break; }
    }
    if (hits > bestHits) { bestHits = hits; bestOff = off; }
  }
}
const out = { query, longTasks: [], totalLongMs: Math.round(ltTot), marks, logs };
for (const lt of lts) {
  const self = new Map(), app = new Map();
  for (const s of samples) {
    const pm = s.ms - bestOff;
    if (pm < lt.start || pm > lt.start + lt.dur) continue;
    const k = label(nodes.get(s.id));
    self.set(k, (self.get(k) ?? 0) + 0.25);
    const a = appFrame(s.id);
    app.set(a, (app.get(a) ?? 0) + 0.25);
  }
  const top = m => [...m.entries()].sort((x, y) => y[1] - x[1]).slice(0, 6).map(([k, v]) => `${Math.round(v)}ms ${k}`);
  out.longTasks.push({ at: Math.round(lt.start), dur: Math.round(lt.dur), self: top(self), app: top(app) });
}
console.log(JSON.stringify(out, null, 1));
await b.close();
