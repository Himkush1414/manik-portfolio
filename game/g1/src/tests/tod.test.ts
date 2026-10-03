// Time of day DURING the mission (Creative Bible AC5.1): keys blend smoothly by rail position, fields
// left out fall back to the world, and Level 1 really goes from pre-dawn to morning.
import { describe, expect, it } from 'vitest';
import { Color } from 'three';
import { TodTimeline, createTodState } from '../render/world/tod';
import { worldById } from '../data/worlds/registry';
import { LEVEL_01 } from '../levels/level01';

const arden = worldById('arden')!;
const lum = (c: Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

describe('time of day timeline', () => {
  it('no keys = the world def, constant', () => {
    const t = new TodTimeline(arden);
    const a = t.evaluate(0, createTodState()), b = t.evaluate(9000, createTodState());
    expect(a.sunEl).toBe(arden.sky.suns[0].elevation);
    expect(a.zenith.equals(new Color(arden.sky.zenith))).toBe(true);
    expect(b.sunDir.equals(a.sunDir)).toBe(true);
    expect(a.exposure).toBe(1);
  });
  it('blends smoothly between keys (no jump at a key, monotone between)', () => {
    const t = new TodTimeline(arden, [{ atM: 0, sunEl: 0, sunAz: 70 }, { atM: 1000, sunEl: 20, sunAz: 70 }]);
    const st = createTodState();
    let prev = -1;
    for (let s = 0; s <= 1000; s += 50) {
      const el = t.evaluate(s, st).sunEl;
      expect(el).toBeGreaterThanOrEqual(prev);
      prev = el;
    }
    expect(t.evaluate(500, st).sunEl).toBeCloseTo(10, 6);
    expect(t.evaluate(-50, st).sunEl).toBe(0);
    expect(t.evaluate(5000, st).sunEl).toBe(20);
    // smoothstep: a 1 m step at the key moves the sun by ~nothing
    expect(Math.abs(t.evaluate(1000, st).sunEl - t.evaluate(999, st).sunEl)).toBeLessThan(1e-4);
  });
  it('Level 1: the sun rises, the sky brightens, the stars fade, exposure settles (AC5.1)', () => {
    const t = new TodTimeline(arden, LEVEL_01.todTimeline);
    const dawn = t.evaluate(0, createTodState());
    const end = t.evaluate(LEVEL_01.lengthM, createTodState());
    expect(dawn.sunEl).toBeLessThan(3);
    expect(end.sunEl).toBeGreaterThan(18);
    expect(lum(end.zenith)).toBeGreaterThan(lum(dawn.zenith) * 1.5);
    expect(dawn.stars).toBe(1);
    expect(end.stars).toBe(0);
    expect(dawn.exposure).toBeGreaterThan(end.exposure);
    // the key light warms -> whitens
    expect(end.key.b / end.key.r).toBeGreaterThan(dawn.key.b / dawn.key.r);
  });
});
