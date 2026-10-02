// Terrain tile worker (Phase 2R §5 TILES): owns its own FlightPath +
// TerrainField (built once from plain data) and generates tiles on request.
// Buffers move by Transferable both ways: the main thread sends recycled
// buffers with each request, so steady-state generation allocates nothing.
/// <reference lib="webworker" />
import { FlightPath } from '../../game/world/path';
import { TerrainField } from '../../game/world/terrain';
import { allocTile, generateTile, tileLayout, tileTransfer, type Lod, type TileBuffers } from '../../game/world/tiles';
import type { TerrainDef } from '../../data/worlds/types';
import type { PathDef } from '../../game/world/pathDef';

export type TerrainWorkerInit = { type: 'init'; terrain: TerrainDef; path: PathDef; seed: number; widthKeys?: readonly (readonly [number, number])[] };
export type TerrainWorkerGen = { type: 'gen'; id: number; tile: number; s0: number; lod: Lod; buffers?: TileBuffers };
export type TerrainWorkerResult = { type: 'tile'; id: number; tile: number; lod: Lod; origin: { x: number; y: number; z: number }; sphere: [number, number, number, number]; ms: number; buffers: TileBuffers };

let field: TerrainField | null = null;

self.onmessage = (e: MessageEvent<TerrainWorkerInit | TerrainWorkerGen>) => {
  const m = e.data;
  if (m.type === 'init') {
    const path = new FlightPath(m.path);
    field = new TerrainField(m.terrain, path, { seed: m.seed, widthKeys: m.widthKeys });
    self.postMessage({ type: 'ready', length: path.length });
    return;
  }
  if (m.type === 'gen' && field) {
    const t0 = performance.now();
    const n = tileLayout(m.lod).vertices;
    const buf = m.buffers && m.buffers.position.length === n * 3 ? m.buffers : allocTile(m.lod);
    const origin = generateTile(field, m.s0, m.lod, buf);
    // bounding sphere of the real (non-skirt) vertices, relative to the origin
    const p = buf.position;
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let i = 0; i < p.length; i += 3) {
      if (p[i] < x0) x0 = p[i]; if (p[i] > x1) x1 = p[i];
      if (p[i + 1] < y0) y0 = p[i + 1]; if (p[i + 1] > y1) y1 = p[i + 1];
      if (p[i + 2] < z0) z0 = p[i + 2]; if (p[i + 2] > z1) z1 = p[i + 2];
    }
    const sphere: [number, number, number, number] = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, Math.hypot(x1 - x0, y1 - y0, z1 - z0) / 2];
    const res: TerrainWorkerResult = { type: 'tile', id: m.id, tile: m.tile, lod: m.lod, origin, sphere, ms: performance.now() - t0, buffers: buf };
    (self as unknown as Worker).postMessage(res, tileTransfer(buf));
  }
};
