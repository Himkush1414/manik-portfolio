import { describe, expect, it } from 'vitest';
import { checkPathDef, type PathDef } from '../game/world/pathDef';

const wp = (x: number, z: number, clearance = 40) => ({ x, z, clearance, envA: 18, envB: 10.5, bank: 0 });

describe('PathDef structure (Phase 2R §4)', () => {
  it('accepts a sane path', () => {
    const p: PathDef = { datum: 0, waypoints: [wp(0, 0), wp(0, -400), wp(120, -800), wp(80, -1200, 12), wp(0, -1600, 200)] };
    expect(checkPathDef(p)).toEqual([]);
  });
  it('flags too few points, bad clearance, bunched waypoints', () => {
    expect(checkPathDef({ datum: 0, waypoints: [wp(0, 0), wp(0, -400)] })[0]).toMatch(/>= 4/);
    const bad = checkPathDef({ datum: 0, waypoints: [wp(0, 0, 4), wp(0, -400), wp(0, -420), wp(0, -900, 400)] });
    expect(bad.some(m => /clearance 4/.test(m))).toBe(true);
    expect(bad.some(m => /from the previous waypoint/.test(m))).toBe(true);
    expect(bad.some(m => /clearance 400/.test(m))).toBe(true);
  });
});
