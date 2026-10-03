// Camera attachment (Control / Camera / Boundary addendum): FULLY ATTACHED is a rigid mount (the ship
// holds its spot on screen, the view rolls with bank x roll strength); STEADY HORIZON never rolls more
// than 2 deg, lets the ship sweep >= 80 % of the half-screen at the widest free section, never out of
// frame, and its lateral motion follows the ship's; the mouse never moves the camera by default; the
// cockpit view rolls whole (attached) or stays level with the shell rolling <= 25 deg (steady).
import { describe, expect, it } from 'vitest';
import { Euler, Group, PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { FollowRig } from '../render/rigs/FollowRig';
import { CockpitRig } from '../render/rigs/CockpitRig';
import { rigAim, rigFlight } from '../render/rigs/rigState';
import { CAMERA_ATTACH, FEEL, RIGS } from '../data/mission';
import { useSettings } from '../state/settings.store';
import { defaultSettings } from '../state/schema';

useSettings.getState().replace(defaultSettings());

const DEG = Math.PI / 180;
const STEP = 1 / 60;

function scene() {
  const root = new Group();
  const ship = new Group();
  root.add(ship);
  root.position.set(0, 0, 0);
  const cam = new PerspectiveCamera(70, 16 / 9, 0.25, 6500);
  return { root, ship, cam };
}
function reset(attach: number) {
  Object.assign(rigFlight, { attach, rollStrength: 1, reduceMotion: false, bank: 0, roll: 0, yaw: 0, pitch: 0, swayBank: 0, freeL: 240, freeR: 240, freeUp: 90, freeDown: 40, envA: 60, envB: 34, clearAt: null });
  Object.assign(rigAim, { yaw: 0, pitch: 0, cursor: true, cx: 0, cy: 0, lookAhead: false });
}
/** ship centre in NDC through the rig's pose */
function ndc(rig: FollowRig, s: ReturnType<typeof scene>): Vector3 {
  const P = rig.pose;
  s.cam.position.copy(P.pos);
  s.cam.quaternion.copy(P.quat);
  s.cam.fov = P.fov;
  s.cam.updateProjectionMatrix();
  s.cam.updateMatrixWorld(true);
  return s.ship.getWorldPosition(new Vector3()).project(s.cam);
}
const camRoll = (q: Quaternion) => new Euler().setFromQuaternion(q, 'YXZ').z;
/** a hard strafe the way the mission drives the attitude: bank / yaw follow the lateral velocity */
function strafe(t: number, limit: number) {
  const vx = Math.sin(t * 1.3) * 70;
  return { x: Math.sin(t * 1.3) * 0 + (-Math.cos(t * 1.3) * 70) / 1.3, bank: -(vx / 70) * limit, yaw: -(vx / 70) * FEEL.yawFromVx };
}

describe('camera attachment (addendum)', () => {
  for (const mode of ['third', 'chase'] as const) {
    it(`${mode}: FULLY ATTACHED — ship drift <= 3 % of the screen, roll = bank x strength within 5 %`, () => {
      const s = scene();
      for (const strength of [1, 0.5]) {
        reset(1);
        rigFlight.rollStrength = strength;
        const rig = new FollowRig(mode);
        rig.scale = 14 / RIGS.refLength;
        rig.attach(s.cam, s.ship);
        rig.update(STEP);
        const rest = ndc(rig, s);
        let drift = 0, rollErr = 0;
        for (let n = 0; n < 600; n++) {
          const t = n * STEP, m = strafe(t, CAMERA_ATTACH.bankMax);
          s.ship.position.set(m.x, Math.sin(t * 0.7) * 25, 0);
          Object.assign(rigFlight, { bank: m.bank, yaw: m.yaw, pitch: Math.cos(t * 0.7) * 0.1 });
          rig.update(STEP);
          const p = ndc(rig, s);
          drift = Math.max(drift, Math.hypot(p.x - rest.x, p.y - rest.y) / 2);
          if (Math.abs(m.bank) > 10 * DEG) rollErr = Math.max(rollErr, Math.abs(camRoll(rig.pose.quat) / (m.bank * strength) - 1));
        }
        expect(drift).toBeLessThanOrEqual(0.03);
        expect(rollErr).toBeLessThan(0.05);
      }
    });

    it(`${mode}: STEADY HORIZON — roll <= 2 deg, >= 80 % of the half-width at the widest free section, never out of frame, follows laterally`, () => {
      const s = scene();
      reset(0);
      rigFlight.swayBank = 4 * DEG; // the cosmetic bend sway at its cap: still <= 2 deg here
      const rig = new FollowRig(mode);
      rig.scale = 14 / RIGS.refLength;
      rig.attach(s.cam, s.ship);
      // the widest section (free space capped at 60 u): the ship at the wall
      rigFlight.freeL = rigFlight.freeR = 60;
      let maxRoll = 0;
      for (let n = 0; n < 240; n++) {
        s.ship.position.set(60, 0, 0);
        rigFlight.bank = -FEEL.bankMax;
        rig.update(STEP);
        maxRoll = Math.max(maxRoll, Math.abs(camRoll(rig.pose.quat)));
      }
      expect(ndc(rig, s).x).toBeGreaterThanOrEqual(0.8);
      expect(ndc(rig, s).x).toBeLessThanOrEqual(0.9 + 1e-6);
      expect(maxRoll).toBeLessThanOrEqual(2 * DEG + 1e-9);
      // open terrain (no wall for 240 u): the ship 200 u out is still in frame
      rigFlight.freeL = rigFlight.freeR = 240;
      let worst = 0;
      const sx: number[] = [], cx: number[] = [];
      for (let n = 0; n < 900; n++) {
        const t = n * STEP;
        s.ship.position.set(Math.sin(t * 0.9) * 200, Math.sin(t * 1.7) * 30, 0);
        rig.update(STEP);
        const p = ndc(rig, s);
        worst = Math.max(worst, Math.abs(p.x), Math.abs(p.y));
        sx.push(s.ship.position.x);
        cx.push(rig.pose.pos.x);
      }
      expect(worst).toBeLessThanOrEqual(0.95); // keep 0.9 + the 2 deg sway rotating the corners
      expect(corr(sx, cx)).toBeGreaterThanOrEqual(0.55);
    });

    it(`${mode}: the mouse never moves the camera (look-ahead off by default)`, () => {
      const s = scene();
      reset(1);
      const a = new FollowRig(mode), b = new FollowRig(mode);
      a.attach(s.cam, s.ship);
      b.attach(s.cam, s.ship);
      for (let n = 0; n < 300; n++) {
        Object.assign(rigAim, { yaw: Math.sin(n) * 1.2, pitch: Math.cos(n * 0.7) * 0.9, cx: Math.sin(n), cy: Math.cos(n) });
        a.update(STEP);
        Object.assign(rigAim, { yaw: 0, pitch: 0, cx: 0, cy: 0 });
        b.update(STEP);
        expect(a.pose.pos.equals(b.pose.pos)).toBe(true);
        expect(a.pose.quat.equals(b.pose.quat)).toBe(true);
      }
    });
  }

  it('camera collision pulls the boom in (distance / height), never sideways', () => {
    const s = scene();
    reset(1);
    const rig = new FollowRig('third');
    rig.scale = 14 / RIGS.refLength;
    rig.attach(s.cam, s.ship);
    rig.update(STEP);
    const free = rig.pose.pos.clone();
    // a low ceiling of rock over the camera's usual spot (a crack): clearance is tiny up there
    rigFlight.clearAt = (_x, y) => 4 - y;
    for (let n = 0; n < 120; n++) rig.update(STEP);
    const tight = rig.pose.pos;
    expect(tight.x).toBeCloseTo(free.x, 9);
    expect(tight.y).toBeLessThan(free.y);
    expect(tight.z).toBeLessThan(free.z);
    expect(tight.y).toBeCloseTo(CAMERA_ATTACH.reduced.up * rig.scale, 1);
  });

  it('cockpit: attached view rolls with bank x strength (+ barrel roll); steady stays level, the shell rolls <= 25 deg', () => {
    const s = scene();
    const rig = new CockpitRig();
    rig.attach(s.cam, s.ship);
    reset(1);
    Object.assign(rigFlight, { bank: 40 * DEG, rollStrength: 0.5 });
    rig.update(STEP);
    expect(camRoll(rig.pose.quat)).toBeCloseTo(20 * DEG, 2); // (Euler read through the eye pitch)
    expect(rigFlight.interiorRoll).toBeCloseTo(20 * DEG, 6);
    reset(0);
    Object.assign(rigFlight, { bank: 70 * DEG, roll: -2, yaw: 0.2, pitch: 0.1 });
    rig.update(STEP);
    const e = new Euler().setFromQuaternion(rig.pose.quat, 'YXZ');
    expect(Math.abs(e.z)).toBeLessThan(1e-9);
    expect(Math.abs(e.y)).toBeLessThan(1e-9);
    expect(rigFlight.interiorRoll).toBeCloseTo(CAMERA_ATTACH.steady.interiorRoll, 6);
    // reduce-motion caps the roll strength at 30 % and never spins the view with the barrel roll
    reset(1);
    Object.assign(rigFlight, { bank: 40 * DEG, roll: -3, reduceMotion: true });
    rig.update(STEP);
    expect(camRoll(rig.pose.quat)).toBeCloseTo(40 * DEG * RIGS.reduceRoll, 2);
  });
});

function corr(a: number[], b: number[]): number {
  const n = a.length, ma = a.reduce((x, y) => x + y) / n, mb = b.reduce((x, y) => x + y) / n;
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) {
    sab += (a[i] - ma) * (b[i] - mb);
    saa += (a[i] - ma) ** 2;
    sbb += (b[i] - mb) ** 2;
  }
  return sab / Math.sqrt(saa * sbb);
}
