import { describe, expect, it } from 'vitest';
import { buildShipGeometry, disposeShipGeometry } from '../ships/geometry';
import { SPECS } from '../ships/specs';
import { SHIP_IDS } from '../data/ships';

// Hangar hero budget per ship (LOD0) and the LOD1 reduction used by
// thumbnails and (Phase 2) distant ships.
const LOD0_MAX = 60_000;

describe('ship LODs', () => {
  for (const id of SHIP_IDS) {
    it(`${id}: LOD0 within budget, LOD1 at most 60% of LOD0`, () => {
      const g0 = buildShipGeometry(SPECS[id], 0);
      const g1 = buildShipGeometry(SPECS[id], 1);
      expect(g0.tris).toBeLessThanOrEqual(LOD0_MAX);
      expect(g1.tris).toBeLessThanOrEqual(g0.tris * 0.6);
      expect(g1.tris).toBeGreaterThan(1000);
      disposeShipGeometry(g0);
      disposeShipGeometry(g1);
    });
  }
});
