import { describe, expect, it } from 'vitest';
import { DrsGovernor, DRS_DEFAULT, DRS_SCALES, drsConfigForCap } from '../render/drs';

/** run `seconds` of frames at `ms` each; returns the change events */
function run(g: DrsGovernor, ms: number, seconds: number, t0: number): { t: number; events: number[] } {
  const events: number[] = [];
  let t = t0;
  const n = Math.round((seconds * 1000) / ms);
  for (let i = 0; i < n; i++) {
    t += ms / 1000;
    const e = g.sample(ms, t);
    if (e) events.push(e);
  }
  return { t, events };
}

describe('DRS governor (brief §4 rule 9)', () => {
  it('steps down after p95 > 19 ms holds for 2 s, one step per 3 s', () => {
    const g = new DrsGovernor();
    const { events } = run(g, 25, 4.5, 0); // 90-frame fill (2.25 s) + 2 s hold
    expect(events).toEqual([-1]);
    expect(g.scale).toBe(DRS_SCALES[1]);
    const r2 = run(g, 25, 10, 4.5);
    // after a change the window refills (2.25 s) and must hold 2 s again, and >= 3 s apart
    expect(r2.events.length).toBeGreaterThanOrEqual(1);
    expect(r2.events.length).toBeLessThanOrEqual(3);
  });

  it('never changes on a fast but steady 60 fps stream', () => {
    const g = new DrsGovernor();
    expect(run(g, 16.6, 30, 0).events).toEqual([]);
    expect(g.level).toBe(0);
  });

  it('steps back up only after p95 < 12.5 ms for 6 s', () => {
    const g = new DrsGovernor();
    run(g, 30, 5, 0);
    expect(g.level).toBe(1);
    const fast = run(g, 8, 5, 5); // 90 frames = 0.72 s fill, then < 6 s hold
    expect(fast.events).toEqual([]);
    const later = run(g, 8, 4, fast.t);
    expect(later.events).toEqual([1]);
    expect(g.level).toBe(0);
  });

  it('a few spikes inside the 5 % tail do not trigger a step', () => {
    const g = new DrsGovernor();
    let t = 0;
    let ev = 0;
    for (let i = 0; i < 2000; i++) {
      const ms = i % 30 === 0 ? 40 : 15; // 3.3 % of frames slow
      t += ms / 1000;
      if (g.sample(ms, t)) ev++;
    }
    expect(ev).toBe(0);
  });

  it('walks the extra degrade steps after the resolution floor and reports them', () => {
    const g = new DrsGovernor({ ...DRS_DEFAULT, extraSteps: 2 });
    run(g, 40, 120, 0);
    expect(g.level).toBe(g.maxLevel);
    expect(g.scale).toBe(DRS_SCALES[DRS_SCALES.length - 1]);
    expect(g.extra).toBe(2);
  });

  it('scales the thresholds for a 30 fps cap', () => {
    const c = drsConfigForCap(30, 0);
    expect(c.downMs).toBeCloseTo(38);
    const g = new DrsGovernor(c);
    expect(run(g, 33.3, 20, 0).events).toEqual([]); // capped frames are not "slow"
  });

  it('menu profile holds a steady 30 fps and only reacts below it', () => {
    const g = new DrsGovernor(drsConfigForCap(0, 0, 'menu'));
    expect(run(g, 33.3, 30, 0).events).toEqual([]);
    expect(run(g, 50, 30, 30).events).toEqual([]); // a quantised 20-30 fps menu holds its scale
    const slow = run(g, 66.7, 14, 60).events;
    expect(slow[0]).toBe(-1);
    expect(slow.every(e => e === -1)).toBe(true);
  });
});

import { presetFromTier } from '../render/quality';
describe('first-run preset pick (brief §4.10)', () => {
  it('steps down by the frame time measured at the default preset', () => {
    expect(presetFromTier(3, false, 14)).toBe('high');
    expect(presetFromTier(3, false, 30)).toBe('medium');
    expect(presetFromTier(3, false, 55)).toBe('low'); // integrated UHD 770 at HIGH
    expect(presetFromTier(2, false, 55)).toBe('low');
    expect(presetFromTier(3, true, 10)).toBe('low');
  });
});
