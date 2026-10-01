// Input robustness QA (brief §7 / §21 "input state clearing"): drives the
// sim lab in manual mode (?screen=simlab&debug=1&manual=1 — the real
// InputManager feeding the real Sim) with Playwright PAGE-LEVEL input only
// (never OS-level), and checks each rule. Writes qa/p2a/input-*.png.
//   node tools/qa-input.mjs [origin]
import { chromium } from 'playwright';
const origin = process.argv[2]?.startsWith('http') ? process.argv[2] : 'http://localhost:5198';
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const logs = [];
p.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(m.text().slice(0, 160)); });
p.on('pageerror', e => logs.push('pageerror ' + e.message));
await p.goto(`${origin}/game/g1/?screen=simlab&debug=1&manual=1`);
await p.waitForFunction(() => !!window.__G1__?.simlab, null, { timeout: 30000 });
await p.waitForTimeout(800);
const st = () => p.evaluate(() => window.__G1__.simlab.state());
const checks = {};

// 1. held keys move the ship (bindings: D = move right)
const x0 = (await st()).x;
await p.keyboard.down('KeyD');
await p.waitForTimeout(700);
checks.keyMoves = (await st()).x - x0 > 5;
await p.screenshot({ path: 'qa/p2a/input-key-held.png' });
await p.keyboard.up('KeyD');

// 2. click on the canvas: pointer lock (or the absolute-cursor fallback) + fire
await p.mouse.move(800, 450);
await p.mouse.down();
await p.waitForTimeout(400);
const afterClick = await st();
checks.lockOrFallback = afterClick.locked || afterClick.absolute;
checks.mouseFireHeld = afterClick.fireHeld;
checks.mode = afterClick.locked ? 'locked' : afterClick.absolute ? 'absolute' : 'none';

// 3. mouse motion moves the reticle
const yaw0 = afterClick.yaw;
await p.mouse.move(1300, 450, { steps: 8 });
await p.waitForTimeout(100);
checks.reticleMoves = Math.abs((await st()).yaw - yaw0) > 0.01;
await p.screenshot({ path: 'qa/p2a/input-fire-aim.png' });

// 4. focus loss while fire is held: everything cleared + pause requested (no stuck fire)
const pauses0 = (await st()).pauses;
await p.evaluate(() => window.dispatchEvent(new Event('blur')));
await p.waitForTimeout(100);
const afterBlur = await st();
checks.blurClearsFire = afterBlur.fireHeld === false;
checks.blurPauses = afterBlur.pauses === pauses0 + 1 && afterBlur.paused === true;
await p.mouse.up();
await p.screenshot({ path: 'qa/p2a/input-paused.png' });

// 5. the wheel is swallowed while playing (no page zoom / scroll)
checks.wheelPrevented = await p.evaluate(() => {
  const e = new WheelEvent('wheel', { deltaY: 120, cancelable: true, bubbles: true });
  window.dispatchEvent(e);
  return e.defaultPrevented;
});
// 6. Ctrl+W is never a game key (would close the tab): keydown with ctrlKey must NOT be prevented
checks.ctrlComboUntouched = await p.evaluate(() => {
  const e = new KeyboardEvent('keydown', { code: 'KeyW', key: 'w', ctrlKey: true, cancelable: true, bubbles: true });
  window.dispatchEvent(e);
  return !e.defaultPrevented;
});

console.log(JSON.stringify({ checks, logs }, null, 1));
await b.close();
process.exit(Object.entries(checks).every(([k, v]) => k === 'mode' || v === true) && logs.length === 0 ? 0 : 1);
