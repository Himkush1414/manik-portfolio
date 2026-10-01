// Frame-time sampler (brief §4 measurement): loads a page with a forced
// graphics preset (written into the save before load), lets it settle, then
// records rAF frame deltas for --sample ms and reports avg fps, p95/p99 ms,
// long tasks, renderer info and the canvas DPR. Run on the PRODUCTION build.
//   node tools/perf-scene.mjs [origin] [--query 'boot=0&debug=1'] [--preset low|medium|high|ultra] [--settle 12000] [--sample 8000] [--res 1920x1080] [--level n] [--graphics '{json}']
// --level n pins the DRS governor level (QA) before sampling.
// G1_DGPU=1 (+ WSLENV=G1_DGPU) = discrete GPU; default = the integrated GPU.
import { chromium } from 'playwright';
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const origin = argv[0]?.startsWith('http') ? argv[0] : 'http://localhost:5198';
const query = opt('query', 'boot=0&debug=1');
const preset = opt('preset', null);
const graphics = JSON.parse(opt('graphics', '{}'));
const settle = +opt('settle', 12000), sample = +opt('sample', 8000);
const level = opt('level', null);
const shotAt = opt('shot', null); // --shot path.png: screenshot before sampling
const [w, h] = opt('res', '1920x1080').split('x').map(Number);
const args = ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', ...(process.env.G1_DGPU ? ['--force_high_performance_gpu'] : [])];
const b = await chromium.launch({ channel: 'chrome', headless: true, args });
const p = await b.newPage({ viewport: { width: w, height: h } });
const logs = [];
p.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(m.text().slice(0, 160)); });
p.on('pageerror', e => logs.push('pageerror ' + e.message));
await p.addInitScript(([pr, gx]) => {
  window.__lt = [];
  new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push({ start: e.startTime, dur: e.duration }); }).observe({ type: 'longtask', buffered: true });
  if (pr) {
    const KEY = 'spacewar.darkedition.save.v1';
    let save = {};
    try { save = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { save = {}; }
    if (!save.version) save = { version: 1, profile: {}, settings: {} };
    save.settings = save.settings || {};
    save.settings.graphics = { ...(save.settings.graphics || {}), preset: pr, autoPicked: true, ...gx };
    save.settings.bootSeen = true;
    localStorage.setItem(KEY, JSON.stringify(save));
  }
}, [preset, graphics]);
await p.goto(`${origin}/game/g1/?${query}`);
await p.waitForTimeout(settle);
if (level !== null) {
  await p.evaluate(n => { window.__G1__.perf.freeze(true); window.__G1__.perf.setLevel(n); }, +level);
  await p.waitForTimeout(3000);
}
if (shotAt) await p.screenshot({ path: shotAt });
const r = await p.evaluate(async ms => {
  const d = [];
  let last = performance.now();
  const t0 = last;
  await new Promise(res => {
    const f = now => { d.push(now - last); last = now; if (now - t0 < ms) requestAnimationFrame(f); else res(); };
    requestAnimationFrame(f);
  });
  const s = d.slice(1).sort((a, b) => a - b);
  const q = k => s[Math.min(s.length - 1, Math.floor(s.length * k))];
  const avg = s.reduce((a, b) => a + b, 0) / s.length;
  const c = document.querySelector('canvas');
  const lt = window.__lt.filter(t => t.start > t0);
  return { fps: +(1000 / avg).toFixed(1), p95: +q(0.95).toFixed(1), p99: +q(0.99).toFixed(1), max: +s[s.length - 1].toFixed(1), frames: s.length, longTasks: lt.map(t => Math.round(t.dur)), info: window.__G1__?.info?.(), canvas: c ? `${c.width}x${c.height}` : null, dpr: c ? +(c.width / c.clientWidth).toFixed(2) : null, perf: window.__G1__?.perf?.state?.() ?? null, saved: (() => { try { const g = JSON.parse(localStorage.getItem('spacewar.darkedition.save.v1') || '{}').settings?.graphics; return g ? { preset: g.preset, autoPicked: g.autoPicked } : null; } catch { return null; } })(), toasts: [...document.querySelectorAll('[role=status] div')].map(d => d.textContent).filter(Boolean).slice(0, 3) };
}, sample);
console.log(JSON.stringify({ preset, graphics, query, gpu: process.env.G1_DGPU ? 'discrete' : 'integrated', ...r, logs }));
await b.close();
