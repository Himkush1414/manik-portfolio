import { describe, expect, it } from 'vitest';
import { FlightPath, validatePath } from '../game/world/path';
import { checkPathDef } from '../game/world/pathDef';
import { TerrainField } from '../game/world/terrain';
import { ARDEN_01_PATH, ARDEN_01_WIDTH } from '../levels/paths/arden01';
import { ARDEN } from '../data/worlds/arden';

describe('Level 1 path (ARDEN, Marrow Valley)', () => {
  const path = new FlightPath(ARDEN_01_PATH);
  const field = new TerrainField(ARDEN.terrain, path, { seed: 101, widthKeys: ARDEN_01_WIDTH });
  it('is structurally valid and ~9.3 km of flight past the lead-in', () => {
    expect(checkPathDef(ARDEN_01_PATH)).toEqual([]);
    expect(path.length).toBeGreaterThan(10000);
    expect(path.length).toBeLessThan(11500);
  });
  it('passes the curvature / pitch / continuity / envelope-vs-terrain validator', () => {
    expect(validatePath(path, (s, u) => field.height(s, u))).toEqual([]);
  });
});
