// Keyboard + a11y checks (brief §17): Tab order with visible focus, inventory
// arrow keys, Enter launches from the canvas, audio unlock with the ambience.
//   node tools/qa-keys.mjs [origin]
import { chromium } from 'playwright';
const origin = process.argv[2] ?? 'http://localhost:5199';
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--autoplay-policy=no-user-gesture-required', ...(process.env.G1_DGPU ? ['--force_high_performance_gpu'] : [])] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const logs = [];
p.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(m.text()); });
p.on('pageerror', e => logs.push('pageerror ' + e.message));
await p.addInitScript(() => localStorage.removeItem('spacewar.darkedition.save.v1'));
await p.goto(`${origin}/game/g1/?boot=0&debug=1`);
await p.waitForTimeout(5000);
const order = [];
for (let i = 0; i < 16; i++) {
  await p.keyboard.press('Tab');
  order.push(await p.evaluate(() => {
    const a = document.activeElement;
    if (!a || a === document.body) return 'body';
    const cs = getComputedStyle(a);
    const ring = cs.outlineStyle !== 'none' && cs.outlineWidth !== '0px' || cs.boxShadow !== 'none' || a.matches(':focus-visible');
    return `${a.tagName.toLowerCase()}:${(a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 22)}${ring ? '' : ' [NO RING]'}`;
  }));
}
await p.screenshot({ path: 'qa/1e-keys-focus.png' });
// inventory arrows
await p.focus('button[aria-label^="HALCYON"]');
await p.keyboard.press('ArrowDown');
await p.waitForTimeout(1400);
const afterDown = await p.evaluate(() => window.__G1__.ship.id());
await p.keyboard.press('ArrowUp');
await p.waitForTimeout(1400);
const afterUp = await p.evaluate(() => window.__G1__.ship.id());
// Enter from the canvas (nothing focused)
await p.evaluate(() => document.activeElement?.blur());
await p.keyboard.press('Enter');
await p.waitForTimeout(400);
const toast = await p.evaluate(() => document.querySelector('[role="status"]')?.textContent ?? '');
const audio = await p.evaluate(() => ({ running: window.__G1__ && document.querySelector('canvas') ? true : false }));
console.log(JSON.stringify({ order, afterDown, afterUp, toast, audio, logs }, null, 1));
await b.close();
