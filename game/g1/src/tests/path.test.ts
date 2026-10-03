import { describe, expect, it } from 'vitest';
import { FlightPath, createFrame, validatePath } from '../game/world/path';
import type { PathDef } from '../game/world/pathDef';

const wp = (x: number, z: number, o: Partial<{ clearance: number; floor: number; envA: number; envB: number }> = {}) => ({ x, z, clearance: o.clearance ?? 40, envA: o.envA ?? 18, envB: o.envB ?? 10.5, bank: 0, floor: o.floor });

describe('FlightPath (Phase 2R §4)', () => {
  it('a straight path has the exact length and a forward -z frame', () => {
    const p = new FlightPath({ datum: 0, waypoints: [wp(0, 0), wp(0, -1000), wp(0, -2000), wp(0, -3000)] });
    expect(p.length).toBeCloseTo(3000, 0);
    const f = p.frameAt(1500, createFrame());
    expect(f.pz).toBeCloseTo(-1500, 0);
    expect(f.py).toBeCloseTo(40, 3);
    expect([f.tx, f.ty, f.tz].map(v => +v.toFixed(4))).toEqual([0, 0, -1]);
    expect([f.rx, f.ry, f.rz].map(v => +v.toFixed(4))).toEqual([1, 0, 0]);
    expect([f.ux, f.uy, f.uz].map(v => +v.toFixed(4) + 0)).toEqual([0, 1, 0]);
  });

  it('frames are orthonormal everywhere and the table is 1 u continuous', () => {
    const p = new FlightPath({ datum: 0, waypoints: [wp(0, 0), wp(300, -1500, { floor: 30 }), wp(-200, -3200, { floor: -20 }), wp(150, -5000, { clearance: 12 }), wp(0, -6500, { clearance: 200, floor: 60 })] });
    const f = createFrame();
    for (let s = 0; s < p.length; s += 37) {
      p.frameAt(s, f);
      const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const T = [f.tx, f.ty, f.tz], R = [f.rx, f.ry, f.rz], U = [f.ux, f.uy, f.uz];
      for (const v of [T, R, U]) expect(Math.abs(dot(v, v) - 1)).toBeLessThan(1e-6);
      expect(Math.abs(dot(T, R))).toBeLessThan(1e-6);
      expect(Math.abs(dot(T, U))).toBeLessThan(1e-6);
      expect(Math.abs(dot(R, U))).toBeLessThan(1e-6);
      expect(f.uy).toBeGreaterThan(0.9); // up stays up (pitch <= 20 deg)
    }
    expect(validatePath(p).filter(m => m.startsWith('continuity'))).toEqual([]);
  });

  it('passes through every waypoint and follows the floor + clearance profile', () => {
    const def: PathDef = { datum: 10, waypoints: [wp(0, 0), wp(400, -1600, { floor: 40, clearance: 30 }), wp(0, -3200), wp(-300, -4800)] };
    const p = new FlightPath(def);
    def.waypoints.forEach((w, i) => {
      const s = p.waypointS[i];
      expect(Math.hypot(p.x[s] - w.x, p.z[s] - w.z), `waypoint ${i}`).toBeLessThan(1.5);
      expect(p.y[s]).toBeCloseTo((w.floor ?? def.datum) + w.clearance, 0);
    });
  });

  it('measures the curvature radius of a wide arc', () => {
    // waypoints on a circle of radius 2000 -> |curvature| ~ 1/2000 mid-arc. Tangent lead-in / lead-out
    // points (as authored paths have): the reflected end condition straightens past the last waypoint,
    // so an arc that ENDS on a waypoint bends harder in its final segment (the validator catches that).
    const R = 2000, pts = [wp(0, 800), wp(0, 400)];
    for (let i = 0; i <= 8; i++) { const a = (i / 8) * (Math.PI / 2); pts.push(wp(R - R * Math.cos(a), -R * Math.sin(a))); }
    pts.push(wp(R + 400, -R), wp(R + 800, -R));
    const p = new FlightPath({ datum: 0, waypoints: pts });
    const k = Math.abs(p.curvatureAt(p.length / 2));
    expect(1 / k).toBeGreaterThan(1850);
    expect(1 / k).toBeLessThan(2150);
    expect(validatePath(p)).toEqual([]);
  });

  it('the validator flags a tight bend and a steep climb', () => {
    const tight = new FlightPath({ datum: 0, waypoints: [wp(0, 0), wp(0, -400), wp(400, -500), wp(800, -500)] });
    expect(validatePath(tight).some(m => m.startsWith('curvature'))).toBe(true);
    const steep = new FlightPath({ datum: 0, waypoints: [wp(0, 0), wp(0, -500), wp(0, -800, { clearance: 250, floor: 200 }), wp(0, -1500)] });
    expect(validatePath(steep).some(m => m.startsWith('pitch'))).toBe(true);
  });

  it('checks the envelope against terrain (terrain inside it is allowed, a buried envelope is not)', () => {
    const at = (clearance: number, envB: number) => new FlightPath({ datum: 0, waypoints: [0, -1000, -2000, -3000].map(z => wp(0, z, { clearance, envB, envA: 40 })) });
    // flat ground: a 38 u half-height at 12 u clearance dips into the floor below — fine (soft floor)
    expect(validatePath(at(12, 38), () => 0)).toEqual([]);
    // the path line itself too low
    expect(validatePath(at(2, 10), () => 0).some(m => m.startsWith('envelope'))).toBe(true);
    // walls everywhere beyond |u| > 8: most of the envelope is inside rock
    expect(validatePath(at(30, 20), (_s, u) => (Math.abs(u) > 8 ? 500 : 0)).some(m => m.startsWith('envelope'))).toBe(true);
  });
});

describe('FlightPath cost', () => {
  it('builds a 21 km path (L22 scale) quickly', () => {
    const pts = [];
    for (let i = 0; i <= 30; i++) pts.push(wp(Math.sin(i * 0.7) * 300, -i * 720, { clearance: 30 + 20 * Math.sin(i), floor: 10 * Math.cos(i * 0.5) }));
    const t0 = performance.now();
    const p = new FlightPath({ datum: 0, waypoints: pts });
    const ms = performance.now() - t0;
    expect(p.length).toBeGreaterThan(21000);
    expect(ms).toBeLessThan(400);
  });
});
