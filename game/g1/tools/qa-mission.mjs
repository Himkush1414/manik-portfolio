// Mission QA gate (brief §4 rule 2 + §21): starts a mission through the real
// flow with a bot, then checks that NOTHING compiles or uploads during play —
// renderer.info programs / geometries / textures are identical after warm-up
// and after the run — plus long tasks, frame table, console, and the exit
// back to the hangar. Screenshots land in --out.
//   node tools/qa-mission.mjs [origin] [--level test] [--bot mid] [--seconds 40] [--out qa/p2a] [--preset high]
import { chromium } from 'playwright';
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const origin = argv[0]?.startsWith('http') ? argv[0] : 'http://localhost:5198';
const level = opt('level', 'test'), bot = opt('bot', 'mid'), seconds = +opt('seconds', 40), out = opt('out', 'qa/p2a'), preset = opt('preset', 'high');
const args = ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-precise-memory-info', ...(process.env.G1_DGPU ? ['--force_high_performance_gpu'] : [])];
const b = await chromium.launch({ channel: 'chrome', headless: true, args });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const logs = [];
p.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(m.text().slice(0, 200)); });
p.on('pageerror', e => logs.push('pageerror ' + e.message));
await p.addInitScript(pr => localStorage.setItem('spacewar.darkedition.save.v1', JSON.stringify({ version: 1, profile: {}, settings: { graphics: { preset: pr, autoPicked: true }, gpuHintShown: true } })), preset);
const t0 = Date.now();
await p.goto(`${origin}/game/g1/?level=${level}&bot=${bot}&debug=1&drs=0${process.env.QS ?? ''}`);
await p.waitForFunction(() => window.__G1__?.flowState?.get() === 'mission.playing', null, { timeout: 90000, polling: 100 });
const tPlaying = (Date.now() - t0) / 1000;
await p.waitForTimeout(3000); // warm-up
const before = await p.evaluate(() => { window.__G1__.perf.reset('mission'); return window.__G1__.info(); });
await p.screenshot({ path: `${out}/mission-${level}-start.png` });
await p.waitForTimeout((seconds / 2) * 1000);
await p.screenshot({ path: `${out}/mission-${level}-mid.png` });
await p.waitForTimeout((seconds / 2) * 1000);
const after = await p.evaluate(() => window.__G1__.info());
const table = await p.evaluate(() => window.__G1__.perf.table());
const sim = await p.evaluate(() => window.__G1__.sim.state());
const flowAtEnd = await p.evaluate(() => window.__G1__.flowState.get());
// leave through the bulkhead (pause first: HANGAR is accepted from paused)
await p.evaluate(() => { if (window.__G1__.flowState.get() === 'mission.playing') window.__G1__.mission.pause(); });
await p.waitForTimeout(200);
await p.evaluate(() => window.__G1__.mission.hangar());
await p.waitForFunction(() => window.__G1__.flowState.get() === 'hangar.idle', null, { timeout: 30000, polling: 100 });
await p.waitForTimeout(1500);
await p.screenshot({ path: `${out}/mission-${level}-back-in-hangar.png` });
const hangarInfo = await p.evaluate(() => window.__G1__.info());
const same = ['programs', 'geometries', 'textures'].every(k => before[k] === after[k]);
const res = { level, bot, preset, gpu: process.env.G1_DGPU ? 'discrete' : 'integrated', secondsToPlaying: tPlaying, programsConstant: same, before, after, table, sim, flowAtEnd, hangarInfo, logs };
console.log(JSON.stringify(res, null, 1));
await b.close();
process.exit(same && logs.length === 0 && table.longTasks.length === 0 ? 0 : 1);
