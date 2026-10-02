import { describe, expect, it } from 'vitest';
import { FlightPath } from '../game/world/path';
import { TerrainField } from '../game/world/terrain';
import { allocTile, generateTile, tileIndices, tileLayout, COLUMNS, TILE_LEN, RIBBON } from '../game/world/tiles';
import { ARDEN } from '../data/worlds/arden';

const wp = (x: number, z: number, clearance = 40, floor = 0) => ({ x, z, clearance, envA: 18, envB: 10.5, bank: 0, floor });
const path = new FlightPath({ datum: 0, waypoints: [wp(0, 400), wp(0, 0), wp(250, -1800, 30, 20), wp(-150, -3600, 60, 10), wp(0, -4400), wp(0, -4800)] });
const field = new TerrainField(ARDEN.terrain, path, { seed: 101 });

describe('terrain tiles (Phase 2R §5)', () => {
  it('columns: symmetric, 2 u near the path, <= 24 u at the edges, +-RIBBON included', () => {
    const c = COLUMNS[0];
    expect(c[0]).toBe(-RIBBON);
    expect(c[c.length - 1]).toBe(RIBBON);
    const mid = (c.length - 1) / 2;
    expect(c[mid]).toBe(0);
    expect(c[mid + 1] - c[mid]).toBeCloseTo(2, 5);
    for (let i = 1; i < c.length; i++) expect(c[i] - c[i - 1]).toBeLessThanOrEqual(24.0001);
    expect(COLUMNS[1].length).toBeLessThan(c.length);
    expect(COLUMNS[2].length).toBeLessThan(COLUMNS[1].length);
  });

  it('layouts + index buffers are consistent', () => {
    for (const lod of [0, 1, 2] as const) {
      const L = tileLayout(lod), idx = tileIndices(lod);
      expect(idx.length).toBe((L.vRows - 1) * (L.vCols - 1) * 6);
      expect(Math.max(...idx)).toBe(L.vertices - 1);
    }
  });

  it('neighbouring tiles share bit-identical edge vertices and normals (same LOD)', () => {
    for (const lod of [0, 1] as const) {
      const L = tileLayout(lod);
      const a = allocTile(lod), b = allocTile(lod);
      const oa = generateTile(field, 1024, lod, a), ob = generateTile(field, 1024 + TILE_LEN, lod, b);
      // last real row of a (row vRows-2) == first real row of b (row 1), in world space
      for (let c = 1; c < L.vCols - 1; c++) {
        const ia = ((L.vRows - 2) * L.vCols + c) * 3, ib = (1 * L.vCols + c) * 3;
        expect(a.position[ia] + oa.x).toBeCloseTo(b.position[ib] + ob.x, 2);
        expect(a.position[ia + 1] + oa.y).toBeCloseTo(b.position[ib + 1] + ob.y, 2);
        expect(a.position[ia + 2] + oa.z).toBeCloseTo(b.position[ib + 2] + ob.z, 2);
        for (let k = 0; k < 3; k++) expect(a.normal[ia + k]).toBeCloseTo(b.normal[ib + k], 4);
      }
    }
  });

  it('vertex heights match the field (sample-vs-vertex parity < 0.05 u)', () => {
    const lod = 0, L = tileLayout(lod), t = allocTile(lod), o = generateTile(field, 2048, lod, t);
    for (let r = 1; r < L.vRows - 1; r += 7) for (let c = 1; c < L.vCols - 1; c += 11) {
      const i = (r * L.vCols + c) * 3;
      const s = 2048 + (r - 1) * 2, u = COLUMNS[0][c - 1];
      expect(Math.abs(t.position[i + 1] + o.y - field.height(s, u))).toBeLessThan(0.05);
    }
  });

  it('normals point up and the skirt hangs below its edge', () => {
    const lod = 1, L = tileLayout(lod), t = allocTile(lod);
    generateTile(field, 512, lod, t);
    for (let v = 0; v < L.vertices; v++) expect(t.normal[v * 3 + 1]).toBeGreaterThan(0);
    const edge = (1 * L.vCols + 5) * 3, skirt = (0 * L.vCols + 5) * 3;
    expect(t.position[edge + 1] - t.position[skirt + 1]).toBeCloseTo(24, 3);
  });

  it('a LOD0 tile generates within the worker budget (< 60 ms in tests; 25 ms target in the worker)', () => {
    const t = allocTile(0);
    generateTile(field, 0, 0, t); // warm
    const t0 = performance.now();
    generateTile(field, 3000, 0, t);
    expect(performance.now() - t0).toBeLessThan(60);
  });
});
