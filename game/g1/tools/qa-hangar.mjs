// Hangar scene checks (brief §11): rest composition at 1920x1080, a second
// turntable angle, a swap mid-materialise, render budgets + console.
//   node tools/qa-hangar.mjs [origin] [tag] [--preset low|medium|high|ultra] [--gfx '{"ao":false}']
import { chromium } from 'playwright';
const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const origin = args[0] ?? 'http://localhost:5199';
const tag = args[1] ?? 'p1';
const pi = process.argv.indexOf('--preset');
const preset = pi > 0 ? process.argv[pi + 1] : null;
const gi = process.argv.indexOf('--gfx');
const gfx = gi > 0 ? JSON.parse(process.argv[gi + 1]) : {};
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', ...(process.env.G1_DGPU ? ['--force_high_performance_gpu'] : [])] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const logs = [];
p.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(m.text()); });
p.on('pageerror', e => logs.push('pageerror ' + e.message));
if (preset || Object.keys(gfx).length) {
  await p.addInitScript(([pr, extra]) => {
    const key = 'spacewar.darkedition.save.v1';
    const cur = JSON.parse(localStorage.getItem(key) || 'null') || { version: 1, profile: {}, settings: {} };
    const g = { ...((cur.settings || {}).graphics || {}), ...extra };
    if (pr) g.preset = pr;
    cur.settings = { ...(cur.settings || {}), graphics: g };
    localStorage.setItem(key, JSON.stringify(cur));
  }, [preset, gfx]);
}
await p.goto(`${origin}/game/g1/?boot=0&debug=1`);
await p.waitForFunction(() => window.__G1__?.ship, null, { timeout: 30000 });
await p.waitForTimeout(3500);
const fps0 = await p.evaluate(() => window.__G1__.fps?.() ?? null);
await p.screenshot({ path: `qa/1d-hangar-${tag}-rest.png` });
const info = await p.evaluate(() => window.__G1__.info());
await p.evaluate(() => window.__G1__.camera.turntable({ yaw: 1.9, idle: 0 }));
await p.waitForTimeout(600);
await p.screenshot({ path: `qa/1d-hangar-${tag}-yaw.png` });
await p.evaluate(() => window.__G1__.ship.select('vesper'));
await p.waitForTimeout(820);
await p.screenshot({ path: `qa/1d-hangar-${tag}-swap.png` });
await p.waitForTimeout(1500);
await p.screenshot({ path: `qa/1d-hangar-${tag}-vesper.png` });
console.log(JSON.stringify({ info, fps0, logs }));
await b.close();
