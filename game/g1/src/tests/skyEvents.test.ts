// Authored sky moments (AC5.4 / AC6.2 / AC6.5): bodies move smoothly between events and hold before /
// after them, meteors ease in and out, the Meridian only flies inside its window.
import { describe, expect, it } from 'vitest';
import { createSkyEventState, evaluateSkyEvents } from '../render/world/skyEvents';
import { LEVEL_01 } from '../levels/level01';
import { TodTimeline, createTodState } from '../render/world/tod';
import { worldById } from '../data/worlds/registry';

const ev = LEVEL_01.skyEvents!;
const at = (s: number) => evaluateSkyEvents(ev, s, createSkyEventState(ev));
const orrin = (s: number) => at(s).bodies.find(b => b.id === 'orrin')!;

describe('sky events (Level 1)', () => {
  it('ORRIN holds, sinks toward the range, then RISES over the ridge into the hidden valley', () => {
    expect(orrin(0).el).toBeCloseTo(24, 6);
    expect(orrin(2000).el).toBeCloseTo(24, 6);
    expect(orrin(4500).el).toBeCloseTo(4, 6);
    expect(orrin(5000).el).toBeCloseTo(4, 6);
    let prev = -Infinity;
    for (let s = 5600; s <= 8400; s += 200) {
      const e = orrin(s).el;
      expect(e).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = e;
    }
    expect(orrin(9000).el).toBeCloseTo(27, 6);
    expect(Math.abs(orrin(7000).el - orrin(7001).el)).toBeLessThan(0.05); // smooth
  });
  it('meteors ease in / out and only fly in the pre-dawn (and the stars dim them)', () => {
    expect(at(0).meteorAmt).toBe(0);
    expect(at(1300).meteorAmt).toBe(1);
    expect(at(1300).meteorsPerMin).toBe(7);
    expect(at(2500).meteorAmt).toBeLessThan(0.5);
    expect(at(3000).meteorAmt).toBe(0);
    const tod = new TodTimeline(worldById('arden')!, LEVEL_01.todTimeline);
    expect(tod.evaluate(2400, createTodState()).stars).toBeLessThan(tod.evaluate(300, createTodState()).stars);
  });
  it('the Meridian crosses only inside its window, along a smooth track', () => {
    expect(at(1000).shipOn).toBe(false);
    const a = at(1500), b = at(4000);
    expect(a.shipOn && b.shipOn).toBe(true);
    expect(a.shipDir.angleTo(b.shipDir)).toBeGreaterThan(0.3);
    expect(Math.abs(a.shipDir.length() - 1)).toBeLessThan(1e-9);
    expect(at(5000).shipOn).toBe(false);
  });
  it('weather in the timeline: the dawn ground mist burns off', () => {
    const tod = new TodTimeline(worldById('arden')!, LEVEL_01.todTimeline);
    expect(tod.evaluate(0, createTodState()).hazeDensity).toBeCloseTo(1.8, 6);
    expect(tod.evaluate(8000, createTodState()).hazeDensity).toBeCloseTo(1, 6);
  });
});
