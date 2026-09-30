// Hologram + dissolve-swap checks (dev :5199 default).
//   node tools/qa-holo.mjs [origin]
// 1) HALCYON owned (solid), 2) select VESPER (locked -> hologram) and capture
// the swap mid-dissolve-out, mid-dissolve-in and settled, 3) OBSIDIAN hologram.
import { chromium } from 'playwright';
const origin = process.argv[2] ?? 'http://localhost:5199';
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const logs = [];
p.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(m.text()); });
p.on('pageerror', e => logs.push('pageerror ' + e.message));
await p.goto(`${origin}/game/g1/?boot=0&debug=1`);
await p.waitForFunction(() => window.__G1__?.ship, null, { timeout: 30000 });
await p.waitForTimeout(3000);
await p.evaluate(() => window.__G1__.camera.view('ship3q'));
await p.waitForTimeout(1200);
await p.screenshot({ path: 'qa/1c-holo-0-halcyon.png' });
const state = [];
await p.evaluate(() => window.__G1__.ship.select('vesper'));
await p.waitForTimeout(220);
await p.screenshot({ path: 'qa/1c-holo-1-out.png' });
await p.waitForTimeout(430);
await p.screenshot({ path: 'qa/1c-holo-2-in.png' });
await p.waitForTimeout(1200);
state.push(await p.evaluate(() => ({ id: window.__G1__.ship.id(), holo: window.__G1__.ship.isHologram() })));
await p.screenshot({ path: 'qa/1c-holo-3-vesper.png' });
// rapid re-selection must settle on the last pick
await p.evaluate(() => { window.__G1__.ship.select('basilisk'); });
await p.waitForTimeout(150);
await p.evaluate(() => { window.__G1__.ship.select('obsidian'); });
await p.waitForTimeout(2000);
state.push(await p.evaluate(() => ({ id: window.__G1__.ship.id(), holo: window.__G1__.ship.isHologram() })));
await p.screenshot({ path: 'qa/1c-holo-4-obsidian.png' });
await p.evaluate(() => window.__G1__.ship.select('halcyon'));
await p.waitForTimeout(2000);
state.push(await p.evaluate(() => ({ id: window.__G1__.ship.id(), holo: window.__G1__.ship.isHologram() })));
console.log(JSON.stringify({ state, info: await p.evaluate(() => window.__G1__.info()), logs }));
await b.close();
