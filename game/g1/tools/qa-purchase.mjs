// Purchase flow (brief §12): locked VESPER -> meet requirements (debug cheats)
// -> hold PURCHASE 0.6 s -> hologram solidifies, credits roll down, toast.
//   node tools/qa-purchase.mjs [origin]
import { chromium } from 'playwright';
const origin = process.argv[2] ?? 'http://localhost:5199';
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', ...(process.env.G1_DGPU ? ['--force_high_performance_gpu'] : [])] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const logs = [];
p.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(m.text()); });
p.on('pageerror', e => logs.push('pageerror ' + e.message));
await p.addInitScript(() => localStorage.removeItem('spacewar.darkedition.save.v1'));
await p.goto(`${origin}/game/g1/?boot=0&debug=1`);
await p.waitForFunction(() => window.__G1__?.cheats, null, { timeout: 30000 });
await p.waitForTimeout(4000);
await p.click('button[aria-label^="VESPER"]');
await p.waitForTimeout(1500);
const disabledBefore = await p.$eval('button:has-text("PURCHASE")', el => el.disabled);
await p.evaluate(() => { window.__G1__.cheats.level(10); window.__G1__.cheats.credits(10000); });
await p.waitForTimeout(400);
const btn = await p.$('button:has-text("PURCHASE")');
const box = await btn.boundingBox();
await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await p.mouse.down();
await p.waitForTimeout(300);
await p.screenshot({ path: 'qa/1e-purchase-hold.png' });
await p.waitForTimeout(450);
await p.mouse.up();
await p.waitForTimeout(350);
await p.screenshot({ path: 'qa/1e-purchase-solidify.png' });
await p.waitForTimeout(1500);
await p.screenshot({ path: 'qa/1e-purchase-done.png' });
const state = await p.evaluate(() => ({ holo: window.__G1__.ship.isHologram(), id: window.__G1__.ship.id(), save: JSON.parse(localStorage.getItem('spacewar.darkedition.save.v1') || '{}').profile }));
console.log(JSON.stringify({ disabledBefore, holo: state.holo, id: state.id, credits: state.save?.credits, unlocked: state.save?.unlockedShips, selected: state.save?.selectedShip, logs }));
await b.close();
