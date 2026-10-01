import { describe, expect, it } from 'vitest';
import { segSphere, segCapsule, segBox, sphereSphere } from '../game/collide';
import { curveAt, ellipseR, envelopeAt } from '../game/rail';

describe('swept collision (brief §5)', () => {
  it('a 380 u/s bolt cannot tunnel through a 1 u target in one 1/60 s step', () => {
    const step = 380 / 60; // 6.33 u
    // starts 3 u in front of the sphere centre, ends 3.33 u behind it: no endpoint overlaps
    const t = segSphere(0, 0, -3, 0, 0, step, 0.5);
    expect(t).toBeGreaterThan(0);
    expect(t).toBeLessThan(1);
    // point tests at both ends would miss
    expect(sphereSphere(0, 0, -3, 0.5)).toBe(false);
    expect(sphereSphere(0, 0, -3 + step, 0.5)).toBe(false);
  });
  it('misses by a lateral offset larger than the radius; starting inside = t 0', () => {
    expect(segSphere(2, 0, -3, 0, 0, 6, 1.5)).toBe(-1);
    expect(segSphere(0.2, 0, 0, 0, 0, 6, 1.5)).toBe(0);
    expect(segSphere(0, 0, 3, 0, 0, 6, 1)).toBe(-1); // moving away
  });
  it('capsule: grazes along its length, misses beyond its ends', () => {
    // capsule along x from -5 to 5, radius 1; segment crosses at x = 3
    expect(segCapsule(3, 0, -4, 0, 0, 8, -5, 0, 0, 5, 0, 0, 1)).toBeGreaterThanOrEqual(0);
    expect(segCapsule(7, 0, -4, 0, 0, 8, -5, 0, 0, 5, 0, 0, 1)).toBe(-1);
    // parallel segment 0.8 u above the axis: within radius
    expect(segCapsule(-3, 0.8, 0, 6, 0, 0, -5, 0, 0, 5, 0, 0, 1)).toBeGreaterThanOrEqual(0);
  });
  it('box (OBB-lite): entry parameter, inflation by radius', () => {
    expect(segBox(0, 0, -10, 0, 0, 20, 2, 2, 2, 0)).toBeCloseTo(0.4, 6);
    expect(segBox(2.3, 0, -10, 0, 0, 20, 2, 2, 2, 0)).toBe(-1);
    expect(segBox(2.3, 0, -10, 0, 0, 20, 2, 2, 2, 0.5)).toBeCloseTo(0.375, 6);
  });
});

describe('rail helpers', () => {
  it('curve lookup interpolates and clamps', () => {
    const k = [[0, 58], [1000, 58], [2000, 80]] as const;
    expect(curveAt(k, -5)).toBe(58);
    expect(curveAt(k, 1500)).toBeCloseTo(69);
    expect(curveAt(k, 9999)).toBe(80);
  });
  it('ellipse radius and envelope segments', () => {
    expect(ellipseR(18, 0, 18, 10.5)).toBeCloseTo(1);
    expect(ellipseR(0, 10.5, 18, 10.5)).toBeCloseTo(1);
    const o = { a: 0, b: 0 };
    envelopeAt([[0, 18, 10.5], [5000, 24, 14]], 6000, o);
    expect(o).toEqual({ a: 24, b: 14 });
  });
});
