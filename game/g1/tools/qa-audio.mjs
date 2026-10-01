// Audio map audit (brief §16: "every UI element in section 12 maps to one of
// these"). Hovers every visible interactive element on each screen and reads
// the debug play log (sfx.play records names even before audio unlocks);
// checks the cockpit power-up beats. node tools/qa-audio.mjs [origin]
import { chromium } from 'playwright';
const origin = process.argv[2]?.startsWith('http') ? process.argv[2] : 'http://localhost:5199';
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const logs = [];
p.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(m.text()); });
p.on('pageerror', e => logs.push('pageerror ' + e.message));
await p.goto(`${origin}/game/g1/?boot=0&debug=1&unlock=all`);
await p.waitForFunction(() => window.__G1__?.audio, null, { timeout: 60000 });
await p.waitForTimeout(9000);
const SEL = 'button:not([disabled]), [role="radio"], [role="tab"], [role="slider"], input:not([type="hidden"]):not([disabled]), a[href]';
const report = {};
async function audit(screen, scope = '') {
  const handles = await p.$$(scope ? SEL.split(', ').map(x => `${scope} ${x}`).join(', ') : SEL);
  const silent = [];
  let n = 0;
  for (const h of handles) {
    if (!(await h.isVisible())) continue;
    await h.scrollIntoViewIfNeeded().catch(() => {}); // scrolling panels (Settings > Controls)
    const box = await h.boundingBox();
    if (!box || box.width < 2 || box.height < 2) continue;
    await p.mouse.move(5, 5);
    await p.waitForTimeout(60);
    await p.evaluate(() => window.__G1__.audio.clear());
    await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await p.waitForTimeout(90);
    const played = await p.evaluate(() => window.__G1__.audio.log());
    n++;
    if (!played.length) silent.push(await h.evaluate(el => (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 40) + ` <${el.tagName.toLowerCase()}${el.getAttribute('role') ? ' role=' + el.getAttribute('role') : ''}>`));
  }
  report[screen] = { checked: n, silent };
}
await audit('hangar');
await p.click('button[aria-label^="Upgrades"]');
await p.waitForTimeout(1200);
await audit('upgrades', '[role="dialog"]');
await p.keyboard.press('Escape');
await p.waitForTimeout(900);
await p.click('button[aria-label^="Settings"]');
await p.waitForTimeout(1200);
for (const tab of await p.$$('[role="dialog"] [role="tab"]')) {
  const name = (await tab.textContent()).trim();
  await tab.click();
  await p.waitForTimeout(500);
  await audit('settings/' + name, '[role="dialog"]');
}
await p.keyboard.press('Escape');
await p.waitForTimeout(900);
await p.evaluate(() => window.__G1__.audio.clear());
await p.evaluate(() => window.__G1__.launch.jump('camera'));
const beats = await p.evaluate(() => window.__G1__.audio.log());
await p.waitForTimeout(800);
await audit('camera-select');
const want = ['powerUp', 'mfdBlip0', 'mfdBlip1', 'mfdBlip2', 'hudOn'];
const order = want.map(w => beats.indexOf(w));
console.log(JSON.stringify({ report, cockpitBeats: beats, beatsOk: order.every((x, i) => x >= 0 && (i === 0 || x > order[i - 1])), logs: [...new Set(logs)] }, null, 1));
await b.close();
