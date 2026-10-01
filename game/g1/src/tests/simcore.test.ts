import { describe, expect, it } from 'vitest';
import { FixedStepper, STEP } from '../game/core/step';
import { Rng, createStreams } from '../game/core/rng';
import { EventRing, Ev } from '../game/core/events';
import { ProjectilePool, SlotPool } from '../game/core/pool';
import { SIM } from '../data/mission';

describe('fixed step (brief §3)', () => {
  it('runs exact 1/60 steps and exposes the interpolation alpha', () => {
    const st = new FixedStepper();
    expect(st.advance(STEP * 2.5)).toBe(2);
    expect(st.alpha).toBeCloseTo(0.5, 6);
    expect(st.advance(STEP * 0.5)).toBe(1);
    expect(st.alpha).toBeCloseTo(0, 6);
  });
  it('caps steps per frame (spiral-of-death guard) and clamps huge frame deltas', () => {
    const st = new FixedStepper();
    expect(st.advance(0.09)).toBe(SIM.maxSteps); // 5.4 steps worth
    expect(st.advance(5)).toBeLessThanOrEqual(SIM.maxSteps); // tab switch: clamped, never 300 steps
    expect(st.acc).toBeLessThan(STEP);
  });
  it('time scale stretches real time (hit-stop = 0 steps)', () => {
    const st = new FixedStepper();
    expect(st.advance(0.05, 0)).toBe(0);
    st.resync();
    expect(st.advance(STEP * 5, 0.6)).toBe(3); // 0.083 s real at 0.6x
  });
});

describe('RNG streams', () => {
  it('same seed -> same sequence; streams are independent', () => {
    const a = createStreams(42), b = createStreams(42);
    const seqA = [a.sim.next(), a.ai.next(), a.spawn.next()];
    const seqB = [b.sim.next(), b.ai.next(), b.spawn.next()];
    expect(seqA).toEqual(seqB);
    expect(new Set(seqA).size).toBe(3);
    // drawing from one stream never shifts another
    const c = createStreams(42);
    for (let i = 0; i < 100; i++) c.ai.next();
    expect(c.sim.next()).toBe(createStreams(42).sim.next());
  });
  it('state can be snapshotted and restored', () => {
    const r = new Rng(7);
    r.next();
    const s = r.state;
    const x = r.next();
    r.state = s;
    expect(r.next()).toBe(x);
  });
});

describe('event ring', () => {
  it('readers drain in order with their own cursors', () => {
    const ring = new EventRing(8);
    const r1 = ring.reader();
    ring.push(Ev.Hit, 1, 3, 0, 0, 10, 5);
    ring.push(Ev.Kill, 1, 3, 0, 0, 10, 100);
    const r2 = ring.reader(); // created later: sees only newer events
    ring.push(Ev.PlayerFire, 2, -1, 0, 0, 0, 1);
    const got1: number[] = [], got2: number[] = [];
    r1.drain(i => got1.push(ring.type[i]));
    r2.drain(i => got2.push(ring.type[i]));
    expect(got1).toEqual([Ev.Hit, Ev.Kill, Ev.PlayerFire]);
    expect(got2).toEqual([Ev.PlayerFire]);
    r1.drain(() => got1.push(-1));
    expect(got1.length).toBe(3);
  });
  it('a reader that falls a full ring behind skips (counted), never reads garbage', () => {
    const ring = new EventRing(4);
    const r = ring.reader();
    for (let i = 0; i < 10; i++) ring.push(Ev.Spark, i, i, 0, 0, 0, i);
    const seen: number[] = [];
    r.drain(i => seen.push(ring.a[i]));
    expect(seen).toEqual([6, 7, 8, 9]);
    expect(r.lost).toBe(6);
  });
});

describe('pools (brief §4: zero allocation, fixed caps)', () => {
  it('projectile pool swap-removes and refuses past its cap', () => {
    const p = new ProjectilePool(3);
    const bytes = p.bytes;
    expect(p.spawn(1, 0, 0, 1, 0, 0, 1, 10, 0.3, 1)).toBe(0);
    p.spawn(2, 0, 0, 1, 0, 0, 1, 10, 0.3, 1);
    p.spawn(3, 0, 0, 1, 0, 0, 1, 10, 0.3, 1);
    expect(p.spawn(4, 0, 0, 1, 0, 0, 1, 10, 0.3, 1)).toBe(-1);
    expect(p.refused).toBe(1);
    p.kill(0);
    expect(p.count).toBe(2);
    expect(p.s[0]).toBe(3); // last moved into the hole
    for (let k = 0; k < 10000; k++) {
      const i = p.spawn(k, 0, 0, 0, 0, 0, 1, 1, 1, 0);
      if (i >= 0) p.kill(i);
    }
    expect(p.bytes).toBe(bytes); // no growth
  });
  it('slot pool keeps stable slots and a dense alive list', () => {
    const pool = new SlotPool(4, i => ({ slot: i, hp: 0 }));
    const a = pool.acquire(), b = pool.acquire(), c = pool.acquire();
    expect([a, b, c]).toEqual([0, 1, 2]);
    pool.release(b);
    expect(pool.aliveCount).toBe(2);
    expect(pool.isLive(b)).toBe(false);
    expect(pool.acquire()).toBe(1); // freed slot reused
    pool.acquire();
    expect(pool.acquire()).toBe(-1);
    pool.clear();
    expect(pool.aliveCount).toBe(0);
    expect(pool.acquire()).toBe(0);
  });
});
