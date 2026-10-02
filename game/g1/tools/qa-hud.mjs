// Mission DOM HUD capture (brief §9 / §21): flies the test corridor in each
// view and saves the HUD states — idle, aim offset (reticle follows the aim,
// pipper the nose), firing + boost, danger (shield / hull < 25 % pulse,
// boost low), threat chevrons, hit / kill markers. Checks the HUD node
// budget (<= 120), that the reticle actually moves with the aim, programs
// constant from play start, perf while the HUD is live, console clean.
//   node tools/qa-hud.mjs [origin] [--modes third,cockpit] [--out qa/p2c] [--preset high]
import { chromium } from 'playwright';
import { gpuArgs, assertGpu } from './gpu.mjs';
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const origin = argv[0]?.startsWith('http') ? argv[0] : 'http://localhost:5198';
const modes = opt('modes', 'third,cockpit').split(','), out = opt('out', 'qa/p2c'), preset = opt('preset', 'high');
const DEG = Math.PI / 180;
const result = {};
let ok = true;
for (const mode of modes) {
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: [...gpuArgs, '--enable-precise-memory-info'] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  const gpu = await assertGpu(p);
  const logs = [];
  p.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(m.text().slice(0, 200)); });
  p.on('pageerror', e => logs.push('pageerror ' + e.message));
  await p.addInitScript(([m, pr]) => localStorage.setItem('spacewar.darkedition.save.v1', JSON.stringify({ version: 1, profile: {}, settings: { graphics: { preset: pr, autoPicked: true }, gpuHintShown: true, camera: { mode: m } } })), [mode, preset]);
  await p.goto(`${origin}/game/g1/?level=test&debug=1&drs=0&god=1&launch=skip`);
  await p.waitForFunction(() => window.__G1__?.flowState?.get() === 'mission.playing', null, { timeout: 120000, polling: 100 });
  const atPlaying = await p.evaluate(() => window.__G1__.info());
  await p.keyboard.press('KeyJ'); // first gesture (audio init) outside the measured window
  await p.waitForTimeout(2000);
  const hud = () => p.evaluate(() => {
    const root = document.querySelector('[data-view]');
    const ret = root?.firstElementChild;
    const m = ret ? new DOMMatrix(getComputedStyle(ret).transform) : null;
    const pip = root?.children[1]?.getBoundingClientRect();
    return { nodes: root ? root.querySelectorAll('*').length + 1 : 0, view: root?.dataset.view ?? null, reticle: m ? [Math.round(m.e), Math.round(m.f)] : null, pipper: pip ? [Math.round(pip.x + pip.width / 2), Math.round(pip.y + pip.height / 2)] : null };
  });
  const shot = async name => { const f = `${out}/hud-${mode}-${name}.png`; await p.screenshot({ path: f }); return f; };
  const shots = [];
  const h0 = await hud();
  shots.push(await shot('idle'));
  await p.evaluate(a => window.__G1__.sim.force({ aimYaw: a[0], aimPitch: a[1] }), [14 * DEG, 6 * DEG]);
  await p.waitForTimeout(500);
  const h1 = await hud();
  shots.push(await shot('aim-offset'));
  await p.evaluate(() => window.__G1__.perf.reset('hud'));
  await p.evaluate(a => window.__G1__.sim.force({ fire: true, boost: true, aimYaw: a }), -8 * DEG);
  await p.waitForTimeout(1200);
  shots.push(await shot('fire-boost'));
  await p.evaluate(() => window.__G1__.sim.force(null));
  await p.evaluate(() => window.__G1__.sim.vitals({ shield: 0.05, hull: 0.2, energy: 0.08 }));
  await p.waitForTimeout(250);
  // count before the shot: the shield regenerates
  const danger = await p.evaluate(() => [...document.querySelectorAll('[data-danger="true"]')].length);
  shots.push(await shot('danger'));
  await p.evaluate(() => window.__G1__.sim.vitals({ shield: 1, hull: 1, energy: 1 }));
  await p.evaluate(() => { const T = window.__G1__.sim; T.threat(0, { active: true, angle: -1.2, urgency: 1 }); T.threat(1, { active: true, angle: 2.6, urgency: 0.4 }); T.threat(2, { active: true, angle: 0.5, urgency: 0.7 }); });
  await p.waitForTimeout(300);
  shots.push(await shot('threats'));
  await p.evaluate(() => { for (let i = 0; i < 3; i++) window.__G1__.sim.threat(i, { active: false }); });
  await p.evaluate(() => window.__G1__.sim.event(1));
  await p.waitForTimeout(40);
  shots.push(await shot('hit'));
  await p.waitForTimeout(400);
  await p.evaluate(() => window.__G1__.sim.event(2));
  await p.waitForTimeout(90);
  shots.push(await shot('kill'));
  await p.waitForTimeout(1500);
  const table = await p.evaluate(() => window.__G1__.perf.table());
  const after = await p.evaluate(() => window.__G1__.info());
  const same = ['programs', 'geometries', 'textures'].every(k => atPlaying[k] === after[k]);
  const reticleMoved = !!(h0.reticle && h1.reticle) && Math.hypot(h1.reticle[0] - h0.reticle[0], h1.reticle[1] - h0.reticle[1]) > 40;
  // the pipper (nose, convergence distance) sits near the screen centre region, never at an edge
  const pipperSane = !!h0.pipper && h0.pipper[0] > 480 && h0.pipper[0] < 1440 && h0.pipper[1] > 200 && h0.pipper[1] < 880;
  const r = { gpu, view: h0.view, nodes: h0.nodes, reticle: [h0.reticle, h1.reticle], pipper: h0.pipper, pipperSane, reticleMoved, dangerFlags: danger, programsConstant: same, perf: { avgFps: table.avgFps, p95: table.p95, render: table.sections.render, longTasks: table.longTasks }, shots, logs };
  if (!same || logs.length || table.longTasks.length || h0.nodes > 120 || !reticleMoved || !pipperSane || danger < 2) ok = false;
  result[mode] = r;
  await b.close();
}
console.log(JSON.stringify(result, null, 1));
process.exit(ok ? 0 : 1);
