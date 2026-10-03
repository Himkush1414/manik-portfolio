// Phase 2 settings rows (brief §9, 2C cp7) + save v2 (Control / Camera /
// Boundary addendum): aim assist, auto-fire, ship steering, reticle look-ahead,
// camera attachment, roll strength, speed lines, subtitles + size. Seeds a v1
// save carrying the pre-release cursor-flight fields and checks the migration
// reset them to the v2 defaults in the browser. Opens Settings from the
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
    localStorage.setItem('spacewar.darkedition.save.v1', JSON.stringify({ version: 1, profile: {}, settings: { controls: { controlModel: 'cursor', autoCentre: true, deadzone: 0.3 }, camera: { rollCoupling: 1.4 }, graphics: { preset: 'high', autoPicked: true }, gpuHintShown: true } }));
  }
});
await p.goto(`${origin}/game/g1/?boot=0&debug=1`);
await p.waitForFunction(() => window.__G1__?.flowState?.get() === 'hangar.idle', null, { timeout: 60000, polling: 200 });
await p.waitForTimeout(2500);
const save = () => p.evaluate(() => JSON.parse(localStorage.getItem('spacewar.darkedition.save.v1') || '{}').settings ?? {});
// the v1 save was migrated on load: v2 defaults (keyboard steering, fully attached, 100 % roll)
const migrated = await p.evaluate(() => {
  const s = window.__G1__.settings?.get?.() ?? null;
  return s && { steering: s.controls.steering, look: s.controls.reticleLookAhead, centre: s.controls.reticleAutoCentre, attachment: s.camera.attachment, roll: s.camera.rollStrength, legacy: 'controlModel' in s.controls || 'rollCoupling' in s.camera };
});
const migrationOk = !!migrated && migrated.steering === 'keyboard' && !migrated.look && !migrated.centre && migrated.attachment === 'attached' && migrated.roll === 1 && !migrated.legacy;
await p.click('button[aria-label="Settings"]');
await p.waitForTimeout(900);
// controls: aim assist HIGH, auto-fire on, KEYBOARD + MOUSE steering, reticle look-ahead on
await p.click('[role="radiogroup"][aria-label="Aim assist"] [role="radio"]:has-text("HIGH")');
await p.click('button[role="switch"][aria-label="Auto-fire"]');
await p.click('[role="radiogroup"][aria-label="Ship steering"] [role="radio"]:has-text("KEYBOARD + MOUSE")');
await p.click('button[role="switch"][aria-label="Reticle look-ahead"]');
await p.locator('[role="radiogroup"][aria-label="Aim assist"]').scrollIntoViewIfNeeded();
await p.waitForTimeout(300);
await p.screenshot({ path: `${out}/settings-p2-controls.png` });
// camera: STEADY HORIZON, roll strength down to 50 % (slider keys: 0.05 per step from 100 %)
await p.click('[role="tab"]:has-text("CAMERA")');
await p.waitForTimeout(400);
await p.click('[role="radiogroup"][aria-label="Camera attachment"] [role="radio"]:has-text("STEADY HORIZON")');
const roll = p.locator('input[type="range"][aria-label="Camera roll strength"]');
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
const got = { aimAssist: st.controls?.aimAssist, autoFire: st.controls?.autoFire, steering: st.controls?.steering, lookAhead: st.controls?.reticleLookAhead, attachment: st.camera?.attachment, rollStrength: st.camera?.rollStrength, speedLines: st.graphics?.speedLines, subtitles: st.accessibility?.subtitles, subtitleSize: st.accessibility?.subtitleSize };
const want = { aimAssist: 'high', autoFire: true, steering: 'keyboardMouse', lookAhead: true, attachment: 'steady', rollStrength: 0.5, speedLines: 0, subtitles: false, subtitleSize: 'large' };
const match = Object.keys(want).every(k => (typeof want[k] === 'number' ? Math.abs(got[k] - want[k]) < 1e-6 : got[k] === want[k]));
// persistence: reload, values survive (the seed above runs once per tab session)
await p.reload();
await p.waitForFunction(() => window.__G1__?.flowState?.get() === 'hangar.idle', null, { timeout: 60000, polling: 200 });
const st2 = await save();
const version = await p.evaluate(() => JSON.parse(localStorage.getItem('spacewar.darkedition.save.v1') || '{}').version);
const persisted = version === 2 && st2.controls?.aimAssist === 'high' && st2.controls?.steering === 'keyboardMouse' && st2.camera?.attachment === 'steady' && st2.accessibility?.subtitleSize === 'large' && Math.abs((st2.camera?.rollStrength ?? 0) - 0.5) < 1e-6;
console.log(JSON.stringify({ gpu, migrated, migrationOk, got, match, version, persisted, logs }, null, 1));
await b.close();
process.exit(migrationOk && match && persisted && !logs.length ? 0 : 1);
