// The barrel roll (Planet 1 §1.2): an explicit 0 -> 2 pi about the local forward axis over 0.55 s
// (8 % wind-up, 77 % spin, 15 % settle), quaternion-composed, NO snap at its end; the attached camera
// only wobbles (<= 25 deg x sin theta), the steady camera never rolls, the cockpit flips smoothly.
import { describe, expect, it } from 'vitest';
import { Euler, Group, PerspectiveCamera, Quaternion } from 'three';
import { ROLL_PHASES, rollAngle, rollFraction } from '../render/mission/rollProfile';
import { ShipAttitude, composeAttitude } from '../render/mission/shipAttitude';
import { FollowRig } from '../render/rigs/FollowRig';
import { CockpitRig } from '../render/rigs/CockpitRig';
import { rigAim, rigFlight } from '../render/rigs/rigState';
import { CAMERA_ATTACH, PLAYER } from '../data/mission';
import { useSettings } from '../state/settings.store';
import { defaultSettings } from '../state/schema';

useSettings.getState().replace(defaultSettings());
const DEG = Math.PI / 180, DUR = PLAYER.roll.duration, F = 1 / 60;

describe('barrel roll profile', () => {
  it('monotonic 0 -> 1, wind-up / spin / settle', () => {
    let prev = -1;
    for (let u = 0; u <= 1.0001; u += 0.001) {
      const f = rollFraction(u);
      expect(f).toBeGreaterThanOrEqual(prev);
      prev = f;
    }
    expect(rollFraction(0)).toBe(0);
    expect(rollFraction(1)).toBe(1);
    // speed: rising through the wind-up, flat through the spin, falling through the settle
    const v = (u: number) => (rollFraction(u + 1e-4) - rollFraction(u)) / 1e-4;
    expect(v(0.02)).toBeLessThan(v(0.06));
    expect(v(0.2)).toBeCloseTo(v(0.7), 6);
    expect(v(0.9)).toBeGreaterThan(v(0.97));
    expect(ROLL_PHASES.windUp + ROLL_PHASES.spin + ROLL_PHASES.settle).toBeCloseTo(1, 9);
  });
  it('the ship attitude rolls 0 -> 2 pi (+-2 %) in 0.55 s (+-0.03), monotonic, then exactly level', () => {
    expect(DUR).toBeCloseTo(0.55, 9);
    const a = new ShipAttitude();
    const angles: number[] = [];
    let reached = -1;
    for (let t = 0; t < 0.7; t += F) {
      const rollT = t < DUR ? t : -1;
      a.update(F, 0, 0, 30, rollT, DUR, -1, 0, 0);
      angles.push(a.roll);
      if (reached < 0 && Math.abs(a.roll) >= 2 * Math.PI * 0.98) reached = t;
    }
    for (let i = 1; i < angles.length && angles[i] !== 0; i++) expect(angles[i]).toBeGreaterThanOrEqual(angles[i - 1]);
    expect(Math.max(...angles.map(Math.abs))).toBeGreaterThan(2 * Math.PI * 0.98);
    expect(reached).toBeGreaterThan(DUR - 0.03 - F);
    expect(reached).toBeLessThan(DUR + 0.03);
    expect(a.roll).toBe(0);
  });
  it('no orientation discontinuity > 3 deg / frame through a roll — also mid-turn, banked + pitched', () => {
    const prev = new Quaternion(), q = new Quaternion();
    for (const [bank, pitch, yaw] of [[0, 0, 0], [0.6, 0.15, -0.2], [-1.1, -0.1, 0.3]]) {
      let first = true, worst = 0;
      for (let t = -0.1; t < 0.8; t += F) {
        const roll = t >= 0 && t < DUR ? rollAngle(t, DUR, 1) : 0;
        composeAttitude(q, yaw, pitch, bank, roll);
        if (!first) worst = Math.max(worst, prev.angleTo(q) - (t >= 0 && t < DUR + F ? (2 * Math.PI * 1.13 * F) / DUR : 0));
        prev.copy(q);
        first = false;
      }
      // the only allowed change per frame is the spin itself (peak 2 pi x vmax / duration per second)
      expect(worst).toBeLessThan(3 * DEG);
    }
  });
});

describe('cameras during a barrel roll', () => {
  const run = (mode: 'third' | 'chase', attach: number, strength = 1) => {
    Object.assign(rigFlight, { attach, rollStrength: strength, reduceMotion: false, bank: 0, roll: 0, yaw: 0, pitch: 0, swayBank: 0, freeL: 240, freeR: 240, freeUp: 400, freeDown: 40, clearAt: null });
    Object.assign(rigAim, { yaw: 0, pitch: 0, cursor: true, cx: 0, cy: 0, lookAhead: false });
    const ship = new Group(), root = new Group();
    root.add(ship);
    const rig = new FollowRig(mode);
    rig.attach(new PerspectiveCamera(70, 16 / 9), ship);
    rig.update(F);
    const prev = rig.pose.quat.clone();
    let maxRoll = 0, maxStep = 0, endStep = 0;
    for (let t = 0; t < 0.8; t += F) {
      rigFlight.roll = t < DUR ? rollAngle(t, DUR, 1) : 0;
      rig.update(F);
      maxRoll = Math.max(maxRoll, Math.abs(new Euler().setFromQuaternion(rig.pose.quat, 'YXZ').z));
      const step = prev.angleTo(rig.pose.quat);
      maxStep = Math.max(maxStep, step);
      if (t > DUR - 3 * F) endStep = Math.max(endStep, step); // the roll's end: where a snap would be
      prev.copy(rig.pose.quat);
    }
    return { maxRoll, maxStep, endStep };
  };
  for (const mode of ['third', 'chase'] as const) {
    it(`${mode}: FULLY ATTACHED wobbles <= 25 deg x strength, never whirls, never snaps`, () => {
      const r = run(mode, 1);
      expect(r.maxRoll).toBeLessThanOrEqual(CAMERA_ATTACH.rollWobble + 1e-6);
      expect(r.maxRoll).toBeGreaterThan(CAMERA_ATTACH.rollWobble * 0.9);
      expect(r.endStep).toBeLessThan(3 * DEG); // no snap when the roll hands back
      // mid-roll the wobble moves only as fast as one smooth 25 deg sine over the roll can
      expect(r.maxStep).toBeLessThan(CAMERA_ATTACH.rollWobble * ((2 * Math.PI * 1.13) / DUR) * F * 1.05);
      expect(run(mode, 1, 0.4).maxRoll).toBeLessThanOrEqual(CAMERA_ATTACH.rollWobble * 0.4 + 1e-6);
    });
    it(`${mode}: STEADY HORIZON does not roll with the barrel roll`, () => {
      expect(run(mode, 0).maxRoll).toBeLessThan(1e-9);
    });
  }
  it('cockpit: the world flips with the view at full strength, smoothly; a wobble below the flip strength', () => {
    const ship = new Group();
    new Group().add(ship);
    const rig = new CockpitRig();
    rig.attach(new PerspectiveCamera(), ship);
    for (const [strength, flips] of [[1, true], [0.5, false]] as const) {
      Object.assign(rigFlight, { attach: 1, rollStrength: strength, reduceMotion: false, bank: 0, roll: 0, yaw: 0, pitch: 0 });
      rig.update(F);
      const prev = rig.pose.quat.clone();
      let maxStep = 0, maxRoll = 0;
      for (let t = 0; t < 0.8; t += F) {
        rigFlight.roll = t < DUR ? rollAngle(t, DUR, 1) : 0;
        rig.update(F);
        maxStep = Math.max(maxStep, prev.angleTo(rig.pose.quat));
        maxRoll = Math.max(maxRoll, Math.abs(rigFlight.interiorRoll));
        prev.copy(rig.pose.quat);
      }
      if (flips) expect(maxRoll).toBeGreaterThan(Math.PI * 1.9);
      else expect(maxRoll).toBeLessThanOrEqual(CAMERA_ATTACH.rollWobble * strength + 1e-6);
      // smooth: per frame at most the spin itself, and NO jump when the roll ends
      expect(maxStep).toBeLessThan(flips ? (2 * Math.PI * 1.13 * F) / DUR + 1e-3 : 3 * DEG);
    }
  });
});
