// FREEDOM OF FLIGHT QA — Control / Camera / Boundary addendum (F1). Level 1
// (ARDEN), production build, every rig x both camera attachments:
//  1. MOUSE ONLY (default KEYBOARD steering): the REAL mouse sweeps the whole
//     screen for `--mouse` s -> the HUD reticle covers it (2 % margin), the
//     sim ship x / y stay EXACTLY 0 and the camera never moves relative to
//     the ship (attached: rigid boom; steady: the camera itself)
//  2. KEYBOARD STRAFES (sim.force moveX / moveY): FULLY ATTACHED — ship drift
//     <= 3 % of the screen, camera roll = bank x roll strength within 5 %
//     (|bank| > 10 deg); STEADY HORIZON — camera roll <= 2 deg, the ship
//     reaches >= 80 % of the half-width, never leaves the frame, camera
//     lateral motion correlates >= 0.55 with the ship's; cockpit: the view
//     rolls with the bank (attached) / stays level, shell <= 25 deg (steady)
//  3. WALL: hold right into the valley side -> scrape + SLIDE (s advances, no
//     invisible stop), camera >= 2 u from terrain, clampEvents 0
//  4. CEILING: hold up -> diegetic turbulence (turb > 0.5) under the deck /
//     rim, no invisible wall below it
// Stills per rig x attachment (rest, left, right, wall, ceiling), perf while
// strafing, console clean.
//   node tools/qa-freedom.mjs [origin] [--modes third,chase,cockpit] [--out qa/f1] [--preset high] [--mouse 20]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { gpuArgs, assertGpu } from './gpu.mjs';
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const origin = argv[0]?.startsWith('http') ? argv[0] : 'http://localhost:5198';
const modes = opt('modes', 'third,chase,cockpit').split(',');
const out = opt('out', 'qa/f1');
const preset = opt('preset', 'high');
const mouseSecs = Number(opt('mouse', '20'));
mkdirSync(out, { recursive: true });
const DEG = Math.PI / 180;
const START = 260; // s of the opening plains
const result = { gpu: null, rigs: {} };
const fails = [];
const check = (cond, msg) => { if (!cond) fails.push(msg); return cond; };

for (const mode of modes) {
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: [...gpuArgs, '--enable-precise-memory-info'] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  result.gpu = await assertGpu(p);
  const logs = [];
  p.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(m.text().slice(0, 200)); });
  p.on('pageerror', e => logs.push('pageerror ' + e.message));
  // a v2 save at the defaults (KEYBOARD steering, FULLY ATTACHED, 100 % roll), no camera shake (clean roll reads)
  // count every mousemove the page receives: a reticle that moves with ZERO events is a game bug; one
  // that moves with browser-generated events (headless pointer lock dispatches some on screenshots) is not
  await p.addInitScript(() => { window.__mm = 0; window.addEventListener('mousemove', () => window.__mm++, true); });
  await p.addInitScript(([m, pr]) => localStorage.setItem('spacewar.darkedition.save.v1', JSON.stringify({ version: 2, profile: {}, settings: { graphics: { preset: pr, autoPicked: true }, gpuHintShown: true, camera: { mode: m, shake: 0 } } })), [mode, preset]);
  await p.goto(`${origin}/game/g1/?level=l01&debug=1&drs=0&god=1&launch=skip`);
  await p.waitForFunction(() => window.__G1__?.flowState?.get() === 'mission.playing', null, { timeout: 120000, polling: 100 });
  await p.waitForTimeout(1500);
  const probe = () => p.evaluate(() => window.__G1__.flight.probe());
  const force = f => p.evaluate(f => window.__G1__.sim.force(f), f);
  const jump = async s => { await force(null); await p.evaluate(m => window.__G1__.mission.jump(m), s); await p.waitForTimeout(700); };
  const shot = async name => { const f = `${out}/freedom-${mode}-${name}.png`; await p.screenshot({ path: f }); return f; };
  const rig = (result.rigs[mode] = { shots: [] });

  for (const attachment of ['attached', 'steady']) {
    await p.evaluate(a => window.__G1__.flight.settings('camera', { attachment: a }), attachment);
    await jump(START);
    await p.waitForTimeout(600); // the 0.5 s attachment blend
    const R = (rig[attachment] = {});
    const tag = `${attachment}`;
    rig.shots.push(await shot(`${tag}-rest`));
    await p.evaluate(() => window.__G1__.flight.events());

    let mm0 = 0;
    const recentre = async () => {
      await p.evaluate(() => window.__G1__.flight.cursor(0, 0));
      mm0 = await p.evaluate(() => window.__mm);
    };
    R.browserMouseEvents = 0;
    const reticleDrift = async phase => {
      const q = await probe();
      const events = (await p.evaluate(() => window.__mm)) - mm0;
      R.browserMouseEvents += events;
      const d = Math.hypot(q.input.cx, q.input.cy);
      if (d > 0.01 && events === 0) check(false, `${mode}/${tag}: reticle moved to (${q.input.cx.toFixed(2)}, ${q.input.cy.toFixed(2)}) during ${phase} with NO mouse event`);
      await recentre();
    };
    // ---- 1. MOUSE ONLY: the real mouse, the real InputManager (pointer lock, or the absolute fallback)
    {
      const secs = attachment === 'attached' ? mouseSecs : Math.min(6, mouseSecs);
      await p.mouse.move(960, 540);
      await p.mouse.down({ button: 'right' }); // a click requests pointer lock (right button: not bound to fire)
      await p.mouse.up({ button: 'right' });
      await p.waitForTimeout(150);
      const locked = await p.evaluate(() => !!document.pointerLockElement);
      const p0 = await probe();
      const rel0 = p0.cam.local.map((v, i) => v - p0.shipLocal[i]);
      let maxShip = 0, maxRel = 0, maxRot = 0, n = 0;
      const ret = { minX: 9, maxX: -9, minY: 9, maxY: -9 };
      const t0 = Date.now();
      let k = 0;
      while (Date.now() - t0 < secs * 1000) {
        // a Lissajous sweep that hits every edge and corner
        const t = k++ * 0.11;
        const x = 960 + 1000 * Math.sin(t * 1.3), y = 540 + 580 * Math.sin(t * 0.83 + 0.4);
        await p.mouse.move(Math.max(0, Math.min(1919, x)), Math.max(0, Math.min(1079, y)), { steps: 2 });
        if (k % 4) continue;
        const q = await probe();
        n++;
        maxShip = Math.max(maxShip, Math.abs(q.sim.x), Math.abs(q.sim.y));
        const rel = attachment === 'attached' ? q.cam.local.map((v, i) => v - q.shipLocal[i]) : q.cam.local;
        const base = attachment === 'attached' ? rel0 : p0.cam.local;
        maxRel = Math.max(maxRel, ...rel.map((v, i) => Math.abs(v - base[i])));
        // (steady: the roll is the cosmetic path-bend sway, <= 2 deg, never the mouse: checked by the unit test)
        maxRot = Math.max(maxRot, attachment === 'attached' ? Math.abs(q.cam.roll - p0.cam.roll) : 0, Math.abs(q.cam.pitch - p0.cam.pitch), Math.abs(q.cam.yaw - p0.cam.yaw));
        if (q.reticle) {
          ret.minX = Math.min(ret.minX, q.reticle.x);
          ret.maxX = Math.max(ret.maxX, q.reticle.x);
          ret.minY = Math.min(ret.minY, q.reticle.y);
          ret.maxY = Math.max(ret.maxY, q.reticle.y);
        }
      }
      rig.shots.push(await shot(`${tag}-mouse-corner`));
      R.mouse = { secs, samples: n, locked, maxShipOffset: maxShip, maxCamMove: +maxRel.toFixed(4), maxCamRot: +maxRot.toFixed(5), reticle: ret };
      check(maxShip === 0, `${mode}/${tag}: mouse moved the ship (${maxShip})`);
      check(maxRel < 0.15 && maxRot < 2e-3, `${mode}/${tag}: mouse moved the camera (${maxRel}, ${maxRot})`);
      // the reticle reaches within ~2 % of every edge (NDC 0.96 bound; 0.9 allows the sampling of a moving sweep)
      check(ret.minX < -0.9 && ret.maxX > 0.9 && ret.minY < -0.9 && ret.maxY > 0.9, `${mode}/${tag}: reticle did not cover the screen ${JSON.stringify(ret)}`);
      // re-centre the reticle once the last (relative, pointer-locked) motion has been delivered
      await p.waitForTimeout(150);
      await recentre();
    }

    // the reticle stays where it was left: no mouse moves from here on, so it must stay centred
    // ---- 2. KEYBOARD STRAFES
    {
      await reticleDrift('reset');
      await jump(START);
      const rest = await probe();
      await p.evaluate(() => window.__G1__.perf.reset('freedom'));
      const legs = [['left', { moveX: -1 }, 1500], ['right', { moveX: 1 }, 2600], ['up', { moveY: 1 }, 900], ['down', { moveY: -1 }, 1300], ['centre', { moveX: -1 }, 1200]];
      let drift = 0, rollErr = 0, maxRoll = 0, maxInterior = 0, maxNdc = 0, maxOut = 0, n = 0;
      const sx = [], cx = [];
      for (const [leg, f, ms] of legs) {
        await force(f);
        const t0 = Date.now();
        let shotTaken = false;
        while (Date.now() - t0 < ms) {
          const q = await probe();
          n++;
          const bank = q.att.bank, want = bank * q.att.strength;
          maxRoll = Math.max(maxRoll, Math.abs(q.cam.roll));
          maxInterior = Math.max(maxInterior, Math.abs(q.att.interiorRoll));
          if (mode !== 'cockpit') {
            if (attachment === 'attached') drift = Math.max(drift, Math.hypot(q.ship.x - rest.ship.x, q.ship.y - rest.ship.y) / 2);
            else {
              maxNdc = Math.max(maxNdc, Math.abs(q.ship.x));
              if (Math.max(Math.abs(q.ship.x), Math.abs(q.ship.y)) > maxOut) R.worst = { leg, ship: q.ship, sim: { x: q.sim.x, y: q.sim.y, freeL: q.sim.freeL, freeR: q.sim.freeR, freeUp: q.sim.freeUp, freeDown: q.sim.freeDown, contact: q.sim.contact }, cam: q.cam.local };
              maxOut = Math.max(maxOut, Math.abs(q.ship.x), Math.abs(q.ship.y));
              sx.push(q.shipLocal[0]);
              cx.push(q.cam.local[0]);
            }
          }
          if (attachment === 'attached' && Math.abs(bank) > 10 * DEG && Math.abs(q.att.roll) < 1e-6) rollErr = Math.max(rollErr, Math.abs(q.cam.roll / want - 1));
          if (!shotTaken && Date.now() - t0 > ms * 0.7 && (leg === 'left' || leg === 'right')) {
            rig.shots.push(await shot(`${tag}-${leg}`));
            shotTaken = true;
          }
        }
      }
      await force(null);
      await reticleDrift('strafes');
      const perf = await p.evaluate(() => window.__G1__.perf.table());
      R.strafe = { samples: n, perf: { avgFps: perf.avgFps, p95: perf.p95, sim: perf.sections?.sim } };
      if (attachment === 'attached') {
        R.strafe.rollErr = +rollErr.toFixed(4);
        check(rollErr < 0.05, `${mode}/${tag}: camera roll off bank x strength by ${(rollErr * 100).toFixed(1)} %`);
        if (mode !== 'cockpit') {
          R.strafe.drift = +drift.toFixed(4);
          check(drift <= 0.03, `${mode}/${tag}: ship drift ${(drift * 100).toFixed(1)} % > 3 %`);
        }
      } else {
        R.strafe.maxRollDeg = +(maxRoll / DEG).toFixed(2);
        check(maxRoll <= 2 * DEG + 1e-3, `${mode}/${tag}: steady camera rolled ${(maxRoll / DEG).toFixed(2)} deg`);
        if (mode === 'cockpit') {
          R.strafe.maxInteriorDeg = +(maxInterior / DEG).toFixed(2);
          check(maxInterior <= 25 * DEG + 1e-3 && maxInterior > 5 * DEG, `${mode}/${tag}: shell roll ${(maxInterior / DEG).toFixed(1)} deg`);
        } else {
          R.strafe.maxNdcX = +maxNdc.toFixed(3);
          R.strafe.maxOut = +maxOut.toFixed(3);
          R.strafe.corr = +corr(sx, cx).toFixed(3);
          check(maxNdc >= 0.8, `${mode}/${tag}: ship reached only ${(maxNdc * 100).toFixed(0)} % of the half-width`);
          check(maxOut <= 0.95, `${mode}/${tag}: ship left the frame (${maxOut.toFixed(3)})`);
          check(R.strafe.corr >= 0.55, `${mode}/${tag}: camera / ship lateral correlation ${R.strafe.corr}`);
        }
      }
      check(perf.avgFps >= 58, `${mode}/${tag}: ${perf.avgFps} fps while strafing`);
    }

    // ---- 3. WALL: hold right into the valley side
    {
      await jump(START);
      await p.evaluate(() => window.__G1__.flight.events());
      await p.evaluate(() => window.__G1__.audio.clear());
      const vfx0 = await p.evaluate(() => window.__G1__.vfx.stats().particlesSpawned);
      await force({ moveX: 1 });
      let contactT = 0, minClear = Infinity, stalls = 0, walled = false, n = 0;
      let win = await probe(), winT = Date.now(), minAdvance = Infinity;
      const t0 = Date.now();
      while (Date.now() - t0 < 7000) {
        const q = await probe();
        n++;
        // forward progress per 250 ms window: never an invisible stop (an impact may slow it, never to 0)
        if (Date.now() - winT >= 250) {
          const adv = (q.sim.s - win.sim.s) / ((Date.now() - winT) / 1000);
          minAdvance = Math.min(minAdvance, adv);
          if (adv < 10) stalls++;
          win = q;
          winT = Date.now();
        }
        if (q.cam.clearance !== null) minClear = Math.min(minClear, q.cam.clearance);
        if (q.sim.contact > 0) {
          contactT++;
          if (contactT === 60) rig.shots.push(await shot(`${tag}-wall-scrape`)); // sparks + dust streaming
          if (!walled) {
            walled = true;
            rig.shots.push(await shot(`${tag}-wall`));
          }
        }
      }
      await force(null);
      const ev = await p.evaluate(() => window.__G1__.flight.events());
      await reticleDrift('wall');
      const q = await probe();
      // the contact is seen + heard: sparks / dust spawned, grind / impact voices requested
      const voices = await p.evaluate(() => window.__G1__.audio.log().filter(n => n === 'grind' || n === 'impact' || n === 'impactHeavy'));
      const sparks = (await p.evaluate(() => window.__G1__.vfx.stats().particlesSpawned)) - vfx0;
      R.wall = { voices: voices.length, particles: sparks, samples: n, contactSamples: contactT, events: ev, minCamClearance: +minClear.toFixed(2), stalls, minForwardSpeed: +minAdvance.toFixed(1), clampEvents: q.sim.clampEvents, x: +q.sim.x.toFixed(1) };
      check(contactT > 0 && ev.scrape + ev.impact > 0, `${mode}/${tag}: never touched the wall`);
      check(voices.length > 0 && sparks > 50, `${mode}/${tag}: contact not presented (voices ${voices.length}, particles ${sparks})`);
      check(stalls === 0, `${mode}/${tag}: forward motion stalled (${stalls}) — an invisible stop`);
      check(mode === 'cockpit' || minClear >= 2 - 0.05, `${mode}/${tag}: camera ${minClear.toFixed(2)} u from terrain`);
      check(q.sim.clampEvents === 0, `${mode}/${tag}: clampEvents ${q.sim.clampEvents}`);
    }

    // ---- 4. CEILING: hold up
    {
      await jump(START);
      await force({ moveY: 1 });
      let maxTurb = 0, maxAbove = -Infinity, maxY = -Infinity, kind = -1, shotTaken = false;
      const t0 = Date.now();
      while (Date.now() - t0 < 5000) {
        const q = await probe();
        maxTurb = Math.max(maxTurb, q.sim.turb);
        maxAbove = Math.max(maxAbove, q.sim.y - q.sim.freeUp);
        maxY = Math.max(maxY, q.sim.y);
        kind = q.sim.ceilingKind;
        if (!shotTaken && q.sim.turb > 0.6) {
          rig.shots.push(await shot(`${tag}-ceiling`));
          shotTaken = true;
        }
      }
      await force(null);
      const q = await probe();
      R.ceiling = { maxTurb: +maxTurb.toFixed(2), maxY: +maxY.toFixed(1), maxAboveCeiling: +maxAbove.toFixed(2), kind, clampEvents: q.sim.clampEvents };
      check(maxTurb > 0.5, `${mode}/${tag}: no turbulence under the ceiling (${maxTurb})`);
      check(maxAbove < 3, `${mode}/${tag}: flew ${maxAbove.toFixed(1)} u through the ceiling`);
    }
  }
  rig.logs = logs;
  check(!logs.length, `${mode}: console ${JSON.stringify(logs.slice(0, 3))}`);
  await b.close();
}
result.fails = fails;
result.ok = fails.length === 0;
writeFileSync(`${out}/freedom.json`, JSON.stringify(result, null, 1));
console.log(JSON.stringify(result, null, 1));
process.exit(result.ok ? 0 : 1);

function corr(a, b) {
  const n = a.length;
  if (n < 3) return 0;
  const ma = a.reduce((x, y) => x + y) / n, mb = b.reduce((x, y) => x + y) / n;
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) {
    sab += (a[i] - ma) * (b[i] - mb);
    saa += (a[i] - ma) ** 2;
    sbb += (b[i] - mb) ** 2;
  }
  return saa && sbb ? sab / Math.sqrt(saa * sbb) : 0;
}
