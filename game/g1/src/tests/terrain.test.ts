import { describe, expect, it } from 'vitest';
import { FlightPath } from '../game/world/path';
import { TerrainField, HeightGrid, createSample } from '../game/world/terrain';
import { ARDEN } from '../data/worlds/arden';

const wp = (x: number, z: number, clearance = 40, floor = 0) => ({ x, z, clearance, envA: 18, envB: 10.5, bank: 0, floor });
const path = new FlightPath({ datum: 0, waypoints: [wp(0, 400), wp(0, 0), wp(250, -1800, 30, 20), wp(-150, -3600, 60, 10), wp(100, -5400, 35, -10), wp(0, -6200), wp(0, -6600)] });
const field = () => new TerrainField(ARDEN.terrain, path, { seed: 101 });

describe('TerrainField (Phase 2R §5)', () => {
  it('is deterministic (same seed -> identical heights; hash over a grid)', () => {
    const a = field(), b = field();
    let h1 = 0, h2 = 0;
    for (let s = 0; s < 6000; s += 97) for (let u = -900; u <= 900; u += 53) {
      h1 = (h1 * 31 + Math.round(a.height(s, u) * 1000)) % 2147483647;
      h2 = (h2 * 31 + Math.round(b.height(s, u) * 1000)) % 2147483647;
    }
    expect(h1).toBe(h2);
    const c = new TerrainField(ARDEN.terrain, path, { seed: 102 });
    expect(c.height(3000, 400)).not.toBe(a.height(3000, 400));
  });

  it('the path flies a valley: floor near the path, walls rise, far relief in range', () => {
    const t = field();
    for (let s = 200; s < 6000; s += 400) {
      const floor = path.floorAt(s);
      const under = t.height(s, 0);
      expect(Math.abs(under - floor), `floor at s=${s}`).toBeLessThan(16);
      const side = Math.max(t.height(s, 500), t.height(s, -500));
      expect(side - floor, `walls at s=${s}`).toBeGreaterThan(150);
    }
    let hi = -Infinity;
    for (let s = 0; s < 6000; s += 50) for (const u of [-900, -700, 700, 900]) hi = Math.max(hi, t.height(s, u) - path.floorAt(s));
    expect(hi).toBeGreaterThan(ARDEN.terrain.relief[0]);
    expect(hi).toBeLessThan(ARDEN.terrain.relief[1] * 2.2);
  });

  it('the river is wet under the path and dry on the walls', () => {
    const t = field(), o = createSample();
    let wet = 0;
    for (let s = 100; s < 6000; s += 100) if (t.sample(s, 0, o).depth > 0) wet++;
    expect(wet).toBeGreaterThan(30);
    expect(t.sample(3000, 600, o).depth).toBe(0);
  });

  it('the path envelope never comes within 3 u of the ground', () => {
    const t = field();
    for (let s = 0; s < path.length; s += 8) for (const u of [-18, -9, 0, 9, 18]) {
      const y = path.y[Math.floor(s)];
      expect(y - 10.5 - t.height(s, u), `s=${s} u=${u}`).toBeGreaterThan(3);
    }
  });

  it('HeightGrid queries are identical with and without the cache', () => {
    const g1 = new HeightGrid(field()), g2 = new HeightGrid(field());
    g1.fill(0, 1200);
    for (let s = 3; s < 1100; s += 13.7) for (let u = -200; u <= 200; u += 17.3) expect(g1.height(s, u)).toBe(g2.height(s, u));
    expect(g2.misses).toBeGreaterThan(0);
    // bilinear vs direct evaluation stays close on the floor
    const t = field();
    expect(Math.abs(g1.height(600.3, 1.7) - t.height(600.3, 1.7))).toBeLessThan(1.5);
  });

  it('evaluates fast enough for worker tiles (< 6 us per height)', () => {
    const t = field();
    let acc = 0;
    const t0 = performance.now();
    for (let s = 0; s < 400; s += 2) for (let u = -900; u <= 900; u += 8) acc += t.height(s, u);
    const per = ((performance.now() - t0) * 1000) / (200 * 226);
    expect(Number.isFinite(acc)).toBe(true);
    expect(per).toBeLessThan(6);
  });
});
