// Resilience (brief §17): asset failure -> retry UI; storage unavailable;
// WebGL unavailable -> styled fallback; context lost -> restored. Screenshots
// per case. node tools/qa-resilience.mjs [origin] [outDir=qa] [--only 1,4]
import { chromium } from 'playwright';
const origin = process.argv[2]?.startsWith('http') ? process.argv[2] : 'http://localhost:5199';
const out = process.argv[3] ?? 'qa';
const GPU = ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'];
const URL = `${origin}/game/g1/?boot=0&debug=1`;
const results = {};
const oi = process.argv.indexOf('--only');
const only = oi > 0 ? process.argv[oi + 1].split(',').map(Number) : [1, 2, 3, 4];
async function page(args = GPU) {
  const b = await chromium.launch({ channel: 'chrome', headless: true, args });
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  const logs = [];
  p.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(m.text().slice(0, 160)); });
  p.on('pageerror', e => logs.push('pageerror ' + (e?.message || String(e)) + ' ' + (e?.stack ?? '').slice(0, 300)));
  return { b, p, logs };
}
const hangarUp = p => p.waitForFunction(() => !!document.querySelector('button[aria-label^="Start mission"]') && window.__G1__?.info()?.drawCalls > 40, null, { timeout: 60000, polling: 250 });

if (only.includes(1)) { // 1. bake worker blocked once -> fault panel -> RETRY -> hangar
  const { b, p, logs } = await page();
  let blocked = 0;
  await p.route(/bake\.worker/, r => (blocked++ === 0 ? r.abort() : r.continue()));
  await p.goto(URL);
  await p.waitForSelector('[role="alertdialog"]', { timeout: 30000 });
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${out}/17-fault-panel.png` });
  const focused = await p.evaluate(() => document.activeElement?.textContent?.trim());
  await p.keyboard.press('Enter'); // RETRY has focus
  await hangarUp(p);
  await p.waitForTimeout(7000); // ship materialises (dissolve-in) after the World mounts
  await p.screenshot({ path: `${out}/17-fault-retried.png` });
  const shipOnPad = await p.evaluate(() => { let n = 0; window.__G1__.world.scene().traverse(o => { if (o.isMesh && o.visible && /hull|ship/i.test(o.name + (o.parent?.name ?? ''))) n++; }); return n; });
  results.workerFailure = { panel: true, focused, shipOnPad, recovered: true, workerRequests: blocked, logs: [...new Set(logs)] };
  await b.close();
}
if (only.includes(2)) { // 2. storage unavailable (private mode / quota): in-memory save, still boots
  const { b, p, logs } = await page();
  await p.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('denied', 'SecurityError'); } }));
  await p.goto(URL);
  await hangarUp(p);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${out}/17-storage-denied.png` });
  results.storageDenied = { hangar: true, logs: [...new Set(logs)] };
  await b.close();
}
if (only.includes(3)) { // 3. no WebGL at all -> styled fallback screen
  const { b, p, logs } = await page(['--disable-webgl', '--disable-webgl2', '--disable-gpu']);
  await p.goto(URL);
  await p.waitForTimeout(2500);
  const text = await p.evaluate(() => document.querySelector('main')?.textContent?.slice(0, 60));
  await p.screenshot({ path: `${out}/17-no-webgl.png` });
  results.noWebGL = { text, logs: [...new Set(logs)] };
  await b.close();
}
if (only.includes(4)) { // 4. context lost -> status -> restored -> full re-init
  const { b, p, logs } = await page();
  await p.addInitScript(() => {
    window.__errs = [];
    addEventListener('error', e => window.__errs.push(`${e.message} @ ${e.filename}:${e.lineno}:${e.colno} ${String(e.error)}`));
    addEventListener('unhandledrejection', e => window.__errs.push(`rejection ${String(e.reason)} ${e.reason?.stack ?? ''}`.slice(0, 300)));
  });
  await p.goto(URL);
  await hangarUp(p);
  await p.waitForTimeout(1500);
  await p.evaluate(() => { window.__lc = window.__G1__.gl().getContext().getExtension('WEBGL_lose_context'); window.__lc.loseContext(); });
  await p.waitForTimeout(700);
  const status = await p.evaluate(() => document.querySelector('[role="status"] span')?.textContent ?? null);
  await p.screenshot({ path: `${out}/17-context-lost.png` });
  await p.evaluate(() => window.__lc.restoreContext());
  await hangarUp(p);
  await p.waitForTimeout(4000);
  await p.screenshot({ path: `${out}/17-context-restored.png` });
  results.contextLoss = { status, restored: true, errs: await p.evaluate(() => window.__errs), logs: [...new Set(logs)] };
  await b.close();
}
console.log(JSON.stringify(results, null, 1));
