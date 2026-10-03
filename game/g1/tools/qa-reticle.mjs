// TACTICAL RETICLE QA (Planet 1 §1.3), production build: per resolution (1280x720, 1920x1080, 3440x1440)
// the styles TACTICAL (idle + aimed off the nose) / MINIMAL / CLASSIC / degrees off / size 1.5 in the
// third-person view, and TACTICAL in the cockpit at 1920. Checks: the canvas draws (drawn-pixel count per
// style: tactical > minimal > 0, classic > 0); AZ / EL read + right / + up when the aim is forced right /
// up, the total offset > 4 deg there (boresight line + label), ~0 at rest; HUD node count; consoles clean.
// Stills for the legibility review.
//   node tools/qa-reticle.mjs [origin] [--out qa/a3]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { gpuArgs, assertGpu } from './gpu.mjs';
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const origin = argv[0]?.startsWith('http') ? argv[0] : 'http://localhost:5198';
const out = opt('out', 'qa/a3');
const sizes = opt('sizes', '1280x720,1920x1080,3440x1440').split(',').map(s => s.split('x').map(Number));
mkdirSync(out, { recursive: true });
const DEG = Math.PI / 180;
const result = { gpu: null, runs: {} };
const fails = [];
const check = (c, m) => { if (!c) fails.push(m); };

async function session(w, h, mode) {
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: gpuArgs });
  const p = await b.newPage({ viewport: { width: w, height: h } });
  result.gpu = await assertGpu(p);
  const logs = [];
  // (the QA's own getImageData readback warns about willReadFrequently: not the game)
  p.on('console', m => { if (['error', 'warning'].includes(m.type()) && !m.text().includes('willReadFrequently')) logs.push(m.text().slice(0, 200)); });
  p.on('pageerror', e => logs.push('pageerror ' + e.message));
  await p.addInitScript(([m]) => localStorage.setItem('spacewar.darkedition.save.v1', JSON.stringify({ version: 2, profile: {}, settings: { graphics: { preset: 'high', autoPicked: true }, gpuHintShown: true, camera: { mode: m, shake: 0 } } })), [mode]);
  await p.goto(`${origin}/game/g1/?level=l01&debug=1&drs=0&god=1&launch=skip`);
  await p.waitForFunction(() => window.__G1__?.flowState?.get() === 'mission.playing', null, { timeout: 120000, polling: 100 });
  await p.waitForTimeout(2500);
  return { b, p, logs };
}

// drawn pixels on the reticle canvas (alpha > 40), on a 4 px grid
const drawn = p => p.evaluate(() => {
  const c = document.querySelector('canvas[class*="_reticleCanvas_"]');
  if (!c) return -1;
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let y = 0; y < c.height; y += 4) for (let x = 0; x < c.width; x += 4) if (d[(y * c.width + x) * 4 + 3] > 40) n++;
  return n;
});
const probe = p => p.evaluate(() => { const f = window.__G1__.flight.probe(); return { off: f.reticleOffset, nodes: document.querySelectorAll('[data-view] *').length + 1, fov: f.cam.fov }; });
const hudSet = (p, v) => p.evaluate(v => window.__G1__.flight.settings('hud', v), v);

for (const [w, h] of sizes) {
  const tag = `${w}x${h}`;
  const { b, p, logs } = await session(w, h, 'third');
  const R = (result.runs[tag] = {});
  const shot = name => p.screenshot({ path: `${out}/reticle-${tag}-${name}.png` });
  await hudSet(p, { reticle: 'tactical', reticleSize: 1, reticleBrightness: 0.9, reticleDegrees: true });
  await p.waitForTimeout(300);
  R.idle = { px: await drawn(p), ...(await probe(p)) };
  await shot('tactical-idle');
  await p.evaluate(a => window.__G1__.sim.force({ aimYaw: a[0], aimPitch: a[1] }), [-14 * DEG, 6 * DEG]);
  await p.waitForTimeout(600);
  R.aimed = { px: await drawn(p), ...(await probe(p)) };
  await shot('tactical-aimed');
  await hudSet(p, { reticleDegrees: false });
  await p.waitForTimeout(200);
  R.noDeg = { px: await drawn(p) };
  await shot('tactical-nodeg');
  await hudSet(p, { reticleDegrees: true, reticleSize: 1.5 });
  await p.waitForTimeout(200);
  R.big = { px: await drawn(p) };
  await shot('tactical-size150');
  await hudSet(p, { reticle: 'minimal', reticleSize: 1 });
  await p.waitForTimeout(200);
  R.minimal = { px: await drawn(p) };
  await shot('minimal');
  await hudSet(p, { reticle: 'classic' });
  await p.waitForTimeout(200);
  R.classic = { px: await drawn(p) };
  await shot('classic');
  await p.evaluate(() => window.__G1__.sim.force(null));
  R.logs = logs;
  // which way is "right" for the aim: the sim's aimYaw sign -> the reticle's screen side
  check(R.idle.px > 0 && R.minimal.px > 0 && R.classic.px > 0, `${tag}: a style drew nothing ${JSON.stringify([R.idle.px, R.minimal.px, R.classic.px])}`);
  check(R.idle.px > R.minimal.px, `${tag}: tactical (${R.idle.px}) not richer than minimal (${R.minimal.px})`);
  check(R.noDeg.px < R.aimed.px, `${tag}: degrees off did not remove the scale`);
  check(R.big.px > R.noDeg.px, `${tag}: size 1.5 drew less`);
  // at rest the nose sits ~2 deg off the rail aim (the flight attitude): no boresight line (< 4 deg)
  check(Math.abs(R.idle.off.total) < 4, `${tag}: offset at rest ${R.idle.off.total.toFixed(2)} deg`);
  check(R.aimed.off.total > 4, `${tag}: aimed offset only ${R.aimed.off.total.toFixed(2)} deg (no boresight line)`);
  check(Math.abs(R.aimed.off.az) > 2 && R.aimed.off.el > 1, `${tag}: AZ / EL ${R.aimed.off.az.toFixed(1)} / ${R.aimed.off.el.toFixed(1)} (aim up must read EL +)`);
  check(R.idle.nodes <= 120, `${tag}: HUD nodes ${R.idle.nodes}`);
  check(!logs.length, `${tag}: console ${JSON.stringify(logs.slice(0, 3))}`);
  await b.close();
}
{
  const { b, p, logs } = await session(1920, 1080, 'cockpit');
  await p.evaluate(a => window.__G1__.sim.force({ aimYaw: a[0], aimPitch: a[1] }), [-10 * DEG, 5 * DEG]);
  await p.waitForTimeout(600);
  result.runs.cockpit = { px: await drawn(p), ...(await probe(p)), logs };
  await p.screenshot({ path: `${out}/reticle-cockpit-aimed.png` });
  check(result.runs.cockpit.px > 0, 'cockpit: reticle drew nothing');
  check(!logs.length, `cockpit: console ${JSON.stringify(logs.slice(0, 3))}`);
  await b.close();
}
result.fails = fails;
result.ok = !fails.length;
writeFileSync(`${out}/reticle.json`, JSON.stringify(result, null, 1));
console.log(JSON.stringify(result, null, 1));
process.exit(result.ok ? 0 : 1);
