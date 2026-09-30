import { describe, expect, it } from 'vitest';
import { HALCYON } from '../ships/specs/halcyon';
import { SPECS } from '../ships/specs';
import { SHIP_IDS } from '../data/ships';
import type { ShipSpec } from '../ships/types';

export function validateSpec(s: ShipSpec): string[] {
  const errs: string[] = [];
  const r = s.hull.rings;
  if (r.length < 12) errs.push(`hull needs >= 12 key rings (has ${r.length})`);
  for (let i = 1; i < r.length; i++) if (!(r[i].z > r[i - 1].z)) errs.push(`ring ${i} z not ascending`);
  for (const [i, ring] of r.entries()) {
    if (ring.w <= 0 || ring.top <= 0 || ring.bot <= 0) errs.push(`ring ${i} has non-positive size`);
    if (ring.n < 1.2) errs.push(`ring ${i} exponent < 1.2`);
  }
  // overall extent includes secondary bodies (TEMPEST booms)
  const zs = [r[0].z, r[r.length - 1].z, ...(s.bodies ?? []).flatMap(b => [b.hull.rings[0].z + b.offset[2], b.hull.rings[b.hull.rings.length - 1].z + b.offset[2]])];
  const tail = Math.min(...zs), nose = Math.max(...zs);
  if (Math.abs(nose - tail - s.length) > s.length * 0.2) errs.push(`hull length ${nose - tail} far from spec length ${s.length}`);
  for (const e of s.engines) if (e.pos[2] > tail + s.length * 0.2) errs.push('engine not at the tail');
  const kinds = new Set(s.hardpoints.map(h => h.kind));
  for (const k of ['cannon', 'engine', 'shield', 'thruster', 'hull'] as const) if (!kinds.has(k)) errs.push(`missing ${k} hardpoint`);
  if (s.hoverHeight <= 0) errs.push('hoverHeight must be > 0');
  return errs;
}

describe('ShipSpec validation', () => {
  for (const id of SHIP_IDS) {
    it(`${id} is valid`, () => {
      expect(validateSpec(SPECS[id])).toEqual([]);
    });
  }
  it('rejects a malformed spec', () => {
    const bad: ShipSpec = { ...HALCYON, hull: { ...HALCYON.hull, rings: HALCYON.hull.rings.slice(0, 4).reverse() } };
    expect(validateSpec(bad).length).toBeGreaterThan(0);
  });
});
