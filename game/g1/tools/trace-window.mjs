// Chrome trace of a time window (brief §4: "find the real cause with a
// trace"). Records devtools.timeline + blink + gpu categories, then for every
// main-thread task longer than --min ms prints its heaviest descendant events
// (self time per event name) so native/GPU stalls are visible (a JS CPU
// profile shows those as "(program)" / "(idle)").
//   node tools/trace-window.mjs [origin] [--query 'debug=1'] [--from 12000] [--to 17000] [--min 40] [--click ms] [--press KeyC@20000,KeyC@22000] [--save trace.json]
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { gpuArgs, assertGpu } from './gpu.mjs';
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const origin = argv[0]?.startsWith('http') ? argv[0] : 'http://localhost:5198';
const query = opt('query', 'debug=1');
const from = +opt('from', 12000), to = +opt('to', 17000), minMs = +opt('min', 40);
const clickAt = opt('click', null);
const args = gpuArgs;
const b = await chromium.launch({ channel: 'chrome', headless: true, args });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await assertGpu(p);
const t0 = Date.now();
await p.goto(`${origin}/game/g1/?${query}`);
const wait = ms => p.waitForTimeout(Math.max(0, ms - (Date.now() - t0)));
await wait(from);
await b.startTracing(p, {
  categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'blink', 'v8', 'gpu', 'cc', 'viz', 'toplevel', 'disabled-by-default-v8.cpu_profiler'],
});
if (clickAt) {
  await wait(+clickAt);
  await p.mouse.click(960, 540);
}
// key presses at absolute times (ms after navigation), in order
for (const k of (opt('press', '') || '').split(',').filter(Boolean)) {
  const [code, at] = k.split('@');
  await wait(+at);
  await p.keyboard.press(code);
}
await wait(to);
const buf = await b.stopTracing();
await b.close();
const trace = JSON.parse(buf.toString());
if (opt('save', null)) writeFileSync(opt('save'), buf);
const ev = trace.traceEvents ?? trace;
// main renderer thread
const names = ev.filter(e => e.ph === 'M' && e.name === 'thread_name');
const main = names.find(e => e.args?.name === 'CrRendererMain');
const pid = main?.pid, tid = main?.tid;
const mine = ev.filter(e => e.pid === pid && e.tid === tid && (e.ph === 'X' || e.ph === 'B' || e.ph === 'E'));
// only complete events (X) are reliable here
const nav = ev.find(e => e.name === 'navigationStart' && e.pid === pid) ?? ev.find(e => e.name === 'TracingStartedInBrowser');
const navTs = nav?.ts ?? null;
const xs = mine.filter(e => e.ph === 'X' && typeof e.dur === 'number').sort((a, b2) => a.ts - b2.ts || b2.dur - a.dur);
// top-level tasks only (RunTask nests ThreadControllerImpl::RunTask)
const tasks = xs.filter(e => e.name === 'ThreadControllerImpl::RunTask' && e.dur > minMs * 1000);
// V8 CPU samples from the trace (same TimeTicks clock as the task events)
const profIds = new Set(ev.filter(e => e.pid === pid && e.tid === tid && e.name === 'Profile').map(e => e.id));
const prof = ev.filter(e => e.pid === pid && (e.name === 'Profile' || e.name === 'ProfileChunk') && profIds.has(e.id));
const nodeById = new Map();
const parentOf = new Map();
const samples = [];
let sampleTs = 0;
for (const e of prof) {
  if (e.name === 'Profile') { sampleTs = e.args?.data?.startTime ?? sampleTs; continue; }
  const d = e.args?.data?.cpuProfile;
  for (const n of d?.nodes ?? []) {
    nodeById.set(n.id, n);
    if (n.parent) parentOf.set(n.id, n.parent);
  }
  const deltas = e.args?.data?.timeDeltas ?? [];
  (d?.samples ?? []).forEach((id, i) => { sampleTs += deltas[i] ?? 0; samples.push({ id, ts: sampleTs }); });
}
const fname = n => { const cf = n?.callFrame ?? {}; return `${cf.functionName || '(anon)'} ${String(cf.url || '').split('/').pop()}:${cf.lineNumber ?? ''}`; };
const appOf = id => { for (let c = id; c != null; c = parentOf.get(c)) { const n = nodeById.get(c); const u = String(n?.callFrame?.url || ''); if (/\/src\//.test(u)) return fname(n); } return '(no app frame)'; };
const out = [];
for (const t of tasks) {
  const end = t.ts + t.dur;
  const kids = xs.filter(e => e !== t && e.ts >= t.ts && e.ts + e.dur <= end);
  // inclusive time per descendant event name
  const selfBy = new Map();
  for (const k of kids) selfBy.set(k.name, (selfBy.get(k.name) ?? 0) + k.dur);
  const top = [...selfBy.entries()].sort((a, b2) => b2[1] - a[1]).slice(0, 14).map(([n, d]) => `${(d / 1000).toFixed(1)}ms ${n}`);
  const fn = kids.filter(k => k.name === 'FunctionCall' || k.name === 'TimerFire' || k.name === 'FireAnimationFrame' || k.name === 'EventDispatch').map(k => `${k.name}${k.args?.data?.functionName ? ':' + k.args.data.functionName : ''}${k.args?.data?.url ? '@' + String(k.args.data.url).split('/').pop() + ':' + k.args.data.lineNumber : ''} ${(k.dur / 1000).toFixed(1)}ms`);
  const js = new Map(), app = new Map();
  let prev = null;
  for (const sm of samples) {
    if (sm.ts < t.ts || sm.ts > end) { prev = sm; continue; }
    const dt = prev ? Math.min(2000, sm.ts - prev.ts) : 0;
    prev = sm;
    const k = fname(nodeById.get(sm.id));
    js.set(k, (js.get(k) ?? 0) + dt);
    const a = appOf(sm.id);
    app.set(a, (app.get(a) ?? 0) + dt);
  }
  const topm = m => [...m.entries()].sort((a, b2) => b2[1] - a[1]).slice(0, 8).map(([n, d]) => `${(d / 1000).toFixed(1)}ms ${n}`);
  out.push({ at: +((t.ts - (navTs ?? t.ts)) / 1000).toFixed(0), dur: +(t.dur / 1000).toFixed(1), inclusive: top, entry: fn.slice(0, 4), jsSelf: topm(js), app: topm(app) });
}
console.log(JSON.stringify({ query, window: [from, to], tasks: out }, null, 1));
