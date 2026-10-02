// Phase 2 settings rows (brief §9, 2C cp7): aim assist, auto-fire, camera
// roll coupling, speed lines, subtitles + size. Opens Settings from the
// hangar with real clicks, changes each control with real input (radio
// clicks, switch clicks, slider keys), screenshots each tab and checks every
// value reached the saved settings. Console must stay clean.
//   node tools/qa-settings-p2.mjs [origin] [--out qa/p2c]
import { chromium } from 'playwright';
import { gpuArgs, assertGpu } from './gpu.mjs';
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const origin = argv[0]?.startsWith('http') ? argv[0] : 'http://localhost:5198';
const out = opt('out', 'qa/p2c');
const b = await chromium.launch({ channel: 'chrome', headless: true, args: gpuArgs });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const gpu = await assertGpu(p);
const logs = [];
p.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(m.text().slice(0, 200)); });
p.on('pageerror', e => logs.push('pageerror ' + e.message));
await p.addInitScript(() => {
  if (!sessionStorage.getItem('qa-seeded')) {
    sessionStorage.setItem('qa-seeded', '1');
    localStorage.setItem('spacewar.darkedition.save.v1', JSON.stringify({ version: 1, profile: {}, settings: { graphics: { preset: 'high', autoPicked: true }, gpuHintShown: true } }));
  }
});
await p.goto(`${origin}/game/g1/?boot=0&debug=1`);
await p.waitForFunction(() => window.__G1__?.flowState?.get() === 'hangar.idle', null, { timeout: 60000, polling: 200 });
await p.waitForTimeout(2500);
const save = () => p.evaluate(() => JSON.parse(localStorage.getItem('spacewar.darkedition.save.v1') || '{}').settings ?? {});
await p.click('button[aria-label="Settings"]');
await p.waitForTimeout(900);
// controls: aim assist HIGH, auto-fire on
await p.click('[role="radiogroup"][aria-label="Aim assist"] [role="radio"]:has-text("HIGH")');
await p.click('button[role="switch"][aria-label="Auto-fire"]');
await p.locator('[role="radiogroup"][aria-label="Aim assist"]').scrollIntoViewIfNeeded();
await p.waitForTimeout(300);
await p.screenshot({ path: `${out}/settings-p2-controls.png` });
// camera: roll coupling down to 50 % (slider keys: 0.05 per step from 100 %)
await p.click('[role="tab"]:has-text("CAMERA")');
await p.waitForTimeout(400);
const roll = p.locator('input[type="range"][aria-label="Camera roll coupling"]');
await roll.focus();
for (let i = 0; i < 10; i++) await p.keyboard.press('ArrowLeft');
await p.waitForTimeout(200);
await p.screenshot({ path: `${out}/settings-p2-camera.png` });
// graphics: speed lines to 0
await p.click('[role="tab"]:has-text("GRAPHICS")');
await p.waitForTimeout(400);
const lines = p.locator('input[type="range"][aria-label="Speed lines"]');
await lines.scrollIntoViewIfNeeded();
await lines.focus();
await p.keyboard.press('Home');
await p.waitForTimeout(200);
await p.screenshot({ path: `${out}/settings-p2-graphics.png` });
// accessibility: subtitles off, size LARGE
await p.click('[role="tab"]:has-text("ACCESSIBILITY")');
await p.waitForTimeout(400);
await p.click('button[role="switch"][aria-label="Subtitles"]');
await p.click('[role="radiogroup"][aria-label="Subtitle size"] [role="radio"]:has-text("LARGE")');
await p.waitForTimeout(600); // the save is debounced
await p.screenshot({ path: `${out}/settings-p2-access.png` });
const st = await save();
const got = { aimAssist: st.controls?.aimAssist, autoFire: st.controls?.autoFire, rollCoupling: st.camera?.rollCoupling, speedLines: st.graphics?.speedLines, subtitles: st.accessibility?.subtitles, subtitleSize: st.accessibility?.subtitleSize };
const want = { aimAssist: 'high', autoFire: true, rollCoupling: 0.5, speedLines: 0, subtitles: false, subtitleSize: 'large' };
const match = Object.keys(want).every(k => (typeof want[k] === 'number' ? Math.abs(got[k] - want[k]) < 1e-6 : got[k] === want[k]));
// persistence: reload, values survive (the seed above runs once per tab session)
await p.reload();
await p.waitForFunction(() => window.__G1__?.flowState?.get() === 'hangar.idle', null, { timeout: 60000, polling: 200 });
const st2 = await save();
const persisted = st2.controls?.aimAssist === 'high' && st2.accessibility?.subtitleSize === 'large' && Math.abs((st2.camera?.rollCoupling ?? 0) - 0.5) < 1e-6;
console.log(JSON.stringify({ gpu, got, match, persisted, logs }, null, 1));
await b.close();
process.exit(match && persisted && !logs.length ? 0 : 1);
