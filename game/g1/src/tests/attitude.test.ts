// Ship attitude feel (render/mission/shipAttitude.ts): converges, carries a
// little mass (bounded overshoot), stays stable at clamped frame times, and
// the barrel roll is a full eased turn that ends level.
import { describe, expect, it } from 'vitest';
import { ShipAttitude } from '../render/mission/shipAttitude';
import { FEEL } from '../data/mission';

const LAT = 30;

function run(a: ShipAttitude, seconds: number, dt: number, vx: (t: number) => number, opts: { rollT?: (t: number) => number } = {}): { minBank: number; maxBank: number } {
  let minBank = Infinity, maxBank = -Infinity;
  for (let t = 0; t < seconds; t += dt) {
    a.update(dt, vx(t), 0, LAT, opts.rollT ? opts.rollT(t) : -1, 0.55, 1, 0, 0);
    minBank = Math.min(minBank, a.bank);
    maxBank = Math.max(maxBank, a.bank);
  }
  return { minBank, maxBank };
}

describe('ship attitude', () => {
  it('banks into a full-speed strafe within ~0.35 s and settles at bankMax', () => {
    const a = new ShipAttitude();
    run(a, 0.35, 1 / 60, () => LAT);
    expect(a.bank).toBeLessThan(-FEEL.bankMax * 0.8);
    run(a, 1.5, 1 / 60, () => LAT);
    expect(a.bank).toBeCloseTo(-FEEL.bankMax, 2);
  });

  it('a key tap banks before the velocity builds (acceleration lead)', () => {
    const lead = new ShipAttitude(), lag = new ShipAttitude();
    // velocity ramps at the sim accel (120 u/s^2) vs the same final velocity applied instantly but read late
    run(lead, 0.1, 1 / 60, t => Math.min(LAT, 120 * t));
    run(lag, 0.1, 1 / 60, t => Math.min(LAT, 120 * t) * 0.5);
    expect(lead.bank).toBeLessThan(lag.bank);
  });

  it('release swings through a small counter-bank, never a wobble', () => {
    const a = new ShipAttitude();
    run(a, 1.2, 1 / 60, () => LAT);
    const r = run(a, 1.5, 1 / 60, t => Math.max(0, LAT - (LAT / 0.18) * t));
    expect(r.maxBank).toBeGreaterThan(0); // overshoot past level = mass
    expect(r.maxBank).toBeLessThan(FEEL.bankMax * 0.35);
    expect(Math.abs(a.bank)).toBeLessThan(0.01);
  });

  it('is stable at the 0.1 s frame clamp and at 240 Hz', () => {
    for (const dt of [0.1, 1 / 240]) {
      const a = new ShipAttitude();
      run(a, 3, dt, t => (Math.sin(t * 7) > 0 ? LAT : -LAT));
      expect(Number.isFinite(a.bank)).toBe(true);
      expect(Math.abs(a.bank)).toBeLessThan(FEEL.bankMax * 1.6);
    }
  });

  it('barrel roll is one full, front-loaded turn that ends level', () => {
    const a = new ShipAttitude();
    const angles: number[] = [];
    for (let t = 0; t <= 0.7; t += 1 / 60) {
      const rollT = t < 0.55 ? t : -1;
      a.update(1 / 60, 0, 0, LAT, rollT, 0.55, 1, 0, 0);
      angles.push(a.roll);
    }
    const min = Math.min(...angles);
    expect(min).toBeLessThan(-Math.PI * 2 * 0.97);
    // front-loaded: past half a turn before half the duration
    expect(angles[Math.floor(0.275 * 60)]).toBeLessThan(-Math.PI);
    expect(a.roll).toBe(0);
  });
});
