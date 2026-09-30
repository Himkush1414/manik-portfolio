// Turntable interaction checks (brief §11): drag yaw + inertia, pitch spring,
// wheel zoom clamp, double-click reset, Left/Right keys, Up/Down ship change,
// auto-rotate resume. node tools/qa-turntable.mjs [origin]
import { chromium } from 'playwright';
const origin = process.argv[2] ?? 'http://localhost:5199';
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', ...(process.env.G1_DGPU ? ['--force_high_performance_gpu'] : [])] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const logs = [];
p.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(m.text()); });
p.on('pageerror', e => logs.push('pageerror ' + e.message));
await p.goto(`${origin}/game/g1/?boot=0&debug=1`);
await p.waitForFunction(() => window.__G1__?.ship && window.__G1__.camera?.turntableState?.().enabled, null, { timeout: 30000 });
await p.waitForTimeout(2000);
const st = () => p.evaluate(() => window.__G1__.camera.turntableState());
const r = {};
const s0 = await st();
// drag right 300 px
await p.mouse.move(960, 600);
await p.mouse.down();
for (let i = 1; i <= 15; i++) { await p.mouse.move(960 + i * 20, 600 - i * 6); await p.waitForTimeout(16); }
const sDrag = await st();
await p.mouse.up();
await p.waitForTimeout(60);
const sRel = await st();
await p.waitForTimeout(1200);
const sAfter = await st();
r.drag = { dYaw: +(sDrag.yaw - s0.yaw).toFixed(2), pitchDuringDrag: +sDrag.pitch.toFixed(3), flingVel: +sRel.vel.toFixed(2), pitchAfter: +sAfter.pitch.toFixed(3) };
// wheel zoom in hard -> clamps at 1.2
for (let i = 0; i < 12; i++) await p.mouse.wheel(0, -300);
await p.waitForTimeout(900);
r.zoomIn = +(await st()).zoomTarget.toFixed(3);
for (let i = 0; i < 20; i++) await p.mouse.wheel(0, 300);
await p.waitForTimeout(300);
r.zoomOut = +(await st()).zoomTarget.toFixed(3);
// double-click reset
await p.mouse.dblclick(960, 600);
await p.waitForTimeout(1400);
const sReset = await st();
r.reset = { yawMod: +(((sReset.yaw + 0.62) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)).toFixed(2), zoom: +sReset.zoomTarget.toFixed(2) };
// arrow keys
const y0 = (await st()).yaw;
await p.keyboard.down('ArrowRight');
await p.waitForTimeout(500);
await p.keyboard.up('ArrowRight');
r.keyRight = +((await st()).yaw - y0).toFixed(2);
const ship0 = await p.evaluate(() => window.__G1__.ship.id());
await p.keyboard.press('ArrowDown');
await p.waitForTimeout(1600);
r.shipDown = [ship0, await p.evaluate(() => window.__G1__.ship.id())];
await p.keyboard.press('ArrowUp');
await p.waitForTimeout(1600);
r.shipUp = await p.evaluate(() => window.__G1__.ship.id());
// auto-rotate resumes (4 deg/s ~ 0.07 rad/s) after 2.5 s idle + ramp
await p.waitForTimeout(4500);
const a = (await st()).yaw;
await p.waitForTimeout(1000);
r.autoRate = +((await st()).yaw - a).toFixed(3);
r.cursor = await p.evaluate(() => document.querySelector('canvas').style.cursor);
console.log(JSON.stringify({ ...r, logs }));
await b.close();
