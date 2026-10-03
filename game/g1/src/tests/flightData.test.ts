import { describe, expect, it } from 'vitest';
import { bankAngle, elevation, heading, localToWorldDir, rotate, rungOnScreen, worldToLocalDir, type Quat } from '../render/mission/flightAttitude';

const I = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const W = 1920, H = 1080, FOV = 70;
const q = (axis: [number, number, number], a: number): Quat => ({ x: axis[0] * Math.sin(a / 2), y: axis[1] * Math.sin(a / 2), z: axis[2] * Math.sin(a / 2), w: Math.cos(a / 2) });
const DEG = Math.PI / 180;

describe('flight data (Planet 1 §1.3): heading / pitch / bank in the planet frame', () => {
  it('heading: N = -Z, E = +X, S = +Z, W = -X', () => {
    expect(heading({ x: 0, y: 0, z: -1 })).toBeCloseTo(0, 9);
    expect(heading({ x: 1, y: 0, z: 0 })).toBeCloseTo(90, 9);
    expect(heading({ x: 0, y: 0, z: 1 })).toBeCloseTo(180, 9);
    expect(heading({ x: -1, y: 0, z: 0 })).toBeCloseTo(270, 9);
  });

  it('elevation of a climbing direction', () => {
    expect(elevation({ x: 0, y: Math.sin(20 * DEG), z: -Math.cos(20 * DEG) })).toBeCloseTo(20, 9);
  });

  it('bank: rolled right (right wing down) reads +', () => {
    const fw = { x: 0, y: 0, z: -1 };
    expect(bankAngle(fw, { x: 1, y: 0, z: 0 })).toBeCloseTo(0, 9);
    expect(bankAngle(fw, { x: Math.cos(30 * DEG), y: -Math.sin(30 * DEG), z: 0 })).toBeCloseTo(30, 9);
    expect(bankAngle(fw, { x: Math.cos(30 * DEG), y: Math.sin(30 * DEG), z: 0 })).toBeCloseTo(-30, 9);
  });

  it('frames: local <-> world round-trip through a path frame (r = B^T)', () => {
    // B = [R | U | -T] for a path heading east and climbing 10 deg
    const c = Math.cos(10 * DEG), s = Math.sin(10 * DEG);
    const T = { x: c, y: s, z: 0 }, U = { x: -s, y: c, z: 0 }, R = { x: T.y * U.z - T.z * U.y, y: T.z * U.x - T.x * U.z, z: T.x * U.y - T.y * U.x };
    const r = [R.x, R.y, R.z, U.x, U.y, U.z, -T.x, -T.y, -T.z];
    const fwd = localToWorldDir(r, { x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 0 });
    expect(heading(fwd)).toBeCloseTo(90, 6);
    expect(elevation(fwd)).toBeCloseTo(10, 6);
    const back = worldToLocalDir(r, fwd, { x: 0, y: 0, z: 0 });
    expect(back.x).toBeCloseTo(0, 9);
    expect(back.z).toBeCloseTo(-1, 9);
  });

  it('quaternion rotate + inverse round-trip', () => {
    const Q = q([0, 1, 0], 0.7), v = { x: 0.3, y: -0.2, z: -0.9 };
    const a = rotate(Q, v, false, { x: 0, y: 0, z: 0 }), b = rotate(Q, a, true, { x: 0, y: 0, z: 0 });
    expect(b.x).toBeCloseTo(v.x, 9);
    expect(b.y).toBeCloseTo(v.y, 9);
    expect(b.z).toBeCloseTo(v.z, 9);
  });

  it('ladder: a level camera puts the horizon at the screen centre and each rung at its true elevation', () => {
    const out = { x: 0, y: 0, angle: 0 }, Q = { x: 0, y: 0, z: 0, w: 1 };
    expect(rungOnScreen(0, { x: 0, y: 0, z: -1 }, I, Q, W, H, FOV, out)).toBe(true);
    expect(out.y).toBeCloseTo(H / 2, 6);
    expect(out.angle).toBeCloseTo(0, 6);
    rungOnScreen(10, { x: 0, y: 0, z: -1 }, I, Q, W, H, FOV, out);
    expect(out.y).toBeCloseTo(H / 2 - ((H / 2) * Math.tan(10 * DEG)) / Math.tan((FOV / 2) * DEG), 6);
    rungOnScreen(-20, { x: 0, y: 0, z: -1 }, I, Q, W, H, FOV, out);
    expect(out.y).toBeGreaterThan(H / 2);
  });

  it('ladder: a camera rolled right tilts the horizon the other way on screen', () => {
    const out = { x: 0, y: 0, angle: 0 };
    // camera rolled right by 20 deg = rotation about its forward (-Z) ... about +Z by -20 deg
    const Q = q([0, 0, 1], -20 * DEG);
    rungOnScreen(0, { x: 0, y: 0, z: -1 }, I, Q, W, H, FOV, out);
    // the world horizon appears rotated counter-clockwise on screen: canvas angle (y down) = -20 deg
    expect(out.angle / DEG).toBeCloseTo(-20, 1);
    expect(out.x).toBeCloseTo(W / 2, 4);
  });

  it('ladder: a camera pitched up 10 deg puts the horizon 10 deg below the centre', () => {
    const out = { x: 0, y: 0, angle: 0 };
    const Q = q([1, 0, 0], 10 * DEG);
    const fw = rotate(Q, { x: 0, y: 0, z: -1 }, false, { x: 0, y: 0, z: 0 });
    rungOnScreen(0, fw, I, Q, W, H, FOV, out);
    expect(out.y).toBeCloseTo(H / 2 + ((H / 2) * Math.tan(10 * DEG)) / Math.tan((FOV / 2) * DEG), 4);
    rungOnScreen(10, fw, I, Q, W, H, FOV, out);
    expect(out.y).toBeCloseTo(H / 2, 4);
  });
});
