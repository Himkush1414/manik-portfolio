// Boot-sequence frame capture (brief §18.1): seeks the master timeline to each
// QA time and screenshots. node tools/qa-boot.mjs <baseUrl> [outDir] [--w 1920 --h 1080]
import { chromium } from 'playwright';
const args = process.argv.slice(2);
const base = args[0] ?? 'http://localhost:5199/game/g1/';
const out = args[1] ?? 'qa';
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const W = +opt('w', 1920), H = +opt('h', 1080);
const TIMES = (opt('times', '0.3,0.7,1.2,2.0,3.0,4.0,4.6,5.3,6.4,7.8,8.4,9.2,9.9,10.6,11.4')).split(',').map(Number);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const logs = [];
page.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', e => logs.push('pageerror: ' + e.message));
await page.goto(base + (base.includes('?') ? '&' : '?') + 'debug=1', { waitUntil: 'load' });
await page.waitForFunction(() => window.__G1__?.boot, null, { timeout: 30000 });
await page.waitForTimeout(5000); // let every loader task finish
const meta = [];
for (const t of TIMES) {
  await page.evaluate(tt => window.__G1__.boot.seek(tt), t);
  await page.waitForTimeout(650);
  const name = `${out}/1b-boot-${t.toFixed(1)}.png`;
  await page.screenshot({ path: name });
  meta.push({ t, info: await page.evaluate(() => window.__G1__.info()) });
}
console.log(JSON.stringify({ doorsAt: await page.evaluate(() => window.__G1__.boot.doorsAt()), frames: meta.map(m => `${m.t}: ${m.info?.drawCalls} dc / ${m.info?.triangles} tris`), logs }, null, 1));
await browser.close();
