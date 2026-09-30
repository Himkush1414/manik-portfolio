// Upgrades + Settings modals (brief §14): open/close (Esc), hardpoint callout,
// hold-to-install, rebinding with conflict swap, live settings + persistence.
//   node tools/qa-modals.mjs [origin]
import { chromium } from 'playwright';
const origin = process.argv[2] ?? 'http://localhost:5199';
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', ...(process.env.G1_DGPU ? ['--force_high_performance_gpu'] : [])] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const logs = [];
p.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(m.text()); });
p.on('pageerror', e => logs.push('pageerror ' + e.message));
await p.addInitScript(() => localStorage.removeItem('spacewar.darkedition.save.v1'));
await p.goto(`${origin}/game/g1/?boot=0&debug=1`);
await p.waitForTimeout(4500);
const save = () => p.evaluate(() => JSON.parse(localStorage.getItem('spacewar.darkedition.save.v1') || '{}'));
const flowState = () => p.evaluate(() => window.__G1__.flowState.get());
const r = {};
// ---- upgrades
await p.click('button[aria-label="Upgrades"]');
await p.waitForTimeout(1300);
r.upgFlow = await flowState();
await p.mouse.move(900, 150);
await p.waitForTimeout(200);
await p.mouse.move(906, 156);
await p.waitForTimeout(500);
await p.screenshot({ path: 'qa/1f-upgrades-callout.png' });
await p.evaluate(() => window.__G1__.cheats.credits(20000));
await p.waitForTimeout(200);
const btn = await p.$('[role="listitem"]:has-text("HULL PLATING") button:has-text("INSTALL")');
const bb = await btn.boundingBox();
await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
await p.mouse.down();
await p.waitForTimeout(650);
await p.mouse.up();
await p.waitForTimeout(250);
await p.screenshot({ path: 'qa/1f-upgrades-installed.png' });
await p.waitForTimeout(700);
r.hullTier = (await save()).profile?.upgrades?.hull;
r.creditsAfter = (await save()).profile?.credits;
await p.keyboard.press('Escape');
await p.waitForTimeout(800);
r.afterEsc = await flowState();
// ---- settings
await p.click('button[aria-label="Settings"]');
await p.waitForTimeout(1000);
r.setFlow = await flowState();
await p.screenshot({ path: 'qa/1f-settings-controls.png' });
await p.click('button[aria-label^="Fire primary"]');
await p.waitForTimeout(150);
await p.keyboard.press('KeyW');
await p.waitForTimeout(250);
r.conflictShown = !!(await p.$('[role="alert"]:has-text("bound to")'));
await p.screenshot({ path: 'qa/1f-settings-conflict.png' });
await p.click('button:has-text("SWAP")');
await p.waitForTimeout(400);
const bnd = (await save()).settings?.controls?.bindings;
r.fire = bnd?.fire;
r.moveUp = bnd?.moveUp;
for (const tab of ['CAMERA', 'GRAPHICS', 'AUDIO', 'ACCESSIBILITY']) {
  await p.click(`[role="tab"]:has-text("${tab}")`);
  await p.waitForTimeout(350);
  await p.screenshot({ path: `qa/1f-settings-${tab.toLowerCase()}.png` });
  if (tab === 'GRAPHICS') await p.click('button[role="switch"][aria-label="Show FPS"]');
}
await p.waitForTimeout(1200);
r.fpsVisible = await p.evaluate(() => /FPS/.test(document.body.innerText));
r.showFpsSaved = (await save()).settings?.graphics?.showFps;
await p.keyboard.press('Escape');
await p.waitForTimeout(800);
r.final = await flowState();
await p.screenshot({ path: 'qa/1f-after.png' });
console.log(JSON.stringify({ ...r, logs }, null, 1));
await b.close();
