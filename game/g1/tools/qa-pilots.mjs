// Pilot busts (brief §13): selection lighting, hover head tracking, tris.
//   node tools/qa-pilots.mjs [origin]
import { chromium } from 'playwright';
const origin = process.argv[2] ?? 'http://localhost:5199';
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', ...(process.env.G1_DGPU ? ['--force_high_performance_gpu'] : [])] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
const logs = [];
p.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(m.text()); });
p.on('pageerror', e => logs.push('pageerror ' + e.message));
await p.goto(`${origin}/game/g1/?boot=0&debug=1`);
await p.waitForTimeout(6000);
const panel = await p.$('[aria-label="Pilot"]');
const box = await panel.boundingBox();
await p.screenshot({ path: 'qa/1e-pilots-onyx.png', clip: { x: box.x - 10, y: box.y - 10, width: box.width + 20, height: box.height + 20 } });
await p.click('button[role="radio"]:has-text("EMBER")');
await p.waitForTimeout(1200);
await p.screenshot({ path: 'qa/1e-pilots-ember.png', clip: { x: box.x - 10, y: box.y - 10, width: box.width + 20, height: box.height + 20 } });
const slot = await p.$('[data-pilot-slot="ember"]');
const sb = await slot.boundingBox();
await p.mouse.move(sb.x + sb.width * 0.95, sb.y + sb.height * 0.2);
await p.waitForTimeout(900);
await p.screenshot({ path: 'qa/1e-pilots-hover.png', clip: { x: box.x - 10, y: box.y - 10, width: box.width + 20, height: box.height + 20 } });
const tris = await p.evaluate(() => window.__G1__.pilots?.tris());
const mode = await p.evaluate(() => window.__G1__.pilots?.mode());
const pilot = await p.evaluate(() => JSON.parse(localStorage.getItem('spacewar.darkedition.save.v1') || '{}').profile?.pilot);
console.log(JSON.stringify({ pilot, tris, mode, logs }));
await b.close();
