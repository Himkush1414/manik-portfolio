// Ship 5-angle renders (brief §10 iteration loop), final lighting.
//   node tools/qa-ship.mjs <ship> <tag> [--livery n]
import { chromium } from 'playwright';
const [ship = 'halcyon', tag = 'p1'] = process.argv.slice(2);
const li = process.argv.indexOf('--livery');
const livery = li > 0 ? process.argv[li + 1] : null;
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const logs = [];
page.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(m.text()); });
page.on('pageerror', e => logs.push('pageerror ' + e.message));
if (livery !== null) {
  await page.addInitScript(([s, l]) => {
    const key = 'spacewar.darkedition.save.v1';
    const cur = JSON.parse(localStorage.getItem(key) || 'null') || { version: 1, profile: {}, settings: {} };
    cur.profile = { ...(cur.profile || {}), selectedShip: s, liveryByShip: { ...((cur.profile || {}).liveryByShip || {}), [s]: +l } };
    localStorage.setItem(key, JSON.stringify(cur));
  }, [ship, livery]);
}
await page.goto(`http://localhost:5199/game/g1/?boot=0&debug=1&ship=${ship}`);
await page.waitForFunction(() => window.__G1__?.ship, null, { timeout: 30000 });
await page.waitForTimeout(3500);
for (const v of ['ship3q', 'shipSide', 'shipTop', 'shipRear', 'shipLow']) {
  await page.evaluate(n => window.__G1__.camera.view(n), v);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `qa/1c-${ship}-${tag}-${v}.png` });
}
console.log(JSON.stringify({ tris: await page.evaluate(() => window.__G1__.ship.tris()), info: await page.evaluate(() => window.__G1__.info()), logs }));
await browser.close();
