// Real-time boot playback checks: full run, skip, reduced motion.
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'http://localhost:5199/game/g1/';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
async function run(name, { reduced = false, skipAt = null, total = 14000 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(m.text()); });
  page.on('pageerror', e => logs.push('pageerror ' + e.message));
  await page.goto(base + '?debug=1');
  await page.waitForFunction(() => window.__G1__?.boot, null, { timeout: 30000 });
  const t0 = Date.now();
  const states = [];
  let skipped = false;
  while (Date.now() - t0 < total) {
    const s = await page.evaluate(() => ({ t: window.__G1__.boot.time(), flow: window.__G1__.flowState?.get() }));
    states.push(`${((Date.now() - t0) / 1000).toFixed(1)}s tl=${s.t.toFixed(2)} ${s.flow}`);
    if (skipAt !== null && !skipped && s.t >= skipAt) {
      await page.keyboard.press('Space');
      skipped = true;
      states.push('  >> SKIP pressed');
    }
    await page.waitForTimeout(700);
  }
  await page.screenshot({ path: `qa/1b-flow-${name}.png` });
  const end = await page.evaluate(() => ({ time: window.__G1__.boot?.time?.(), dur: window.__G1__.boot?.duration?.() }));
  console.log(JSON.stringify({ name, end, trace: states.filter((_, i) => i % 3 === 0 || _.includes('SKIP')), logs }, null, 0));
  await ctx.close();
}
await run('full');
await run('skip', { skipAt: 2.6, total: 9000 });
await run('reduced', { reduced: true, total: 9000 });
await browser.close();
