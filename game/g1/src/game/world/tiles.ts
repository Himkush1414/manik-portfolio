// Terrain tiles (Phase 2R §5 TILES): pure TS so the worker, the main-thread
// fallback and the tests run the same code. A tile covers s in
// [s0, s0 + TILE_LEN] and u in [-RIBBON, +RIBBON] on non-uniform columns
// (2 u near the path, growing to ~24 u at the edges); rows every 2 / 4 / 8 u
// for LOD 0 / 1 / 2. Vertices are written RELATIVE to the tile origin
// (path point at s0, valley-floor height) for float precision. Normals use a
// one-row / one-column apron sampled from the same pure field, so the edges
// of neighbouring tiles get bit-identical normals (no lighting seams). A
// skirt ring (edge vertices dropped by SKIRT u) hides LOD T-junctions.
import type { TerrainField, TerrainSample } from './terrain';
import { createSample } from './terrain';
import { createFrame } from './path';

export const TILE_LEN = 128;
export const RIBBON = 900;
export const SKIRT = 24;
export const LOD_ROW_STEP = [2, 4, 8] as const;
export type Lod = 0 | 1 | 2;

/** column u positions for LOD 0 (symmetric, includes +-RIBBON) */
function baseColumns(): Float32Array {
  const half: number[] = [0];
  let u = 0, step = 2;
  while (u < RIBBON) {
    if (u >= 120) step = Math.min(24, step * 1.06);
    u = Math.min(RIBBON, u + step);
    half.push(u);
  }
  const all = [...half.slice(1).reverse().map(v => -v), ...half];
  return new Float32Array(all);
}
const COLS0 = baseColumns();
/** LOD n keeps every 2^n-th column (and always both edges + the centre) */
export const COLUMNS: readonly Float32Array[] = [0, 1, 2].map(l => {
  const k = 1 << l, mid = (COLS0.length - 1) / 2, out: number[] = [];
  for (let i = 0; i < COLS0.length; i++) if (i === 0 || i === COLS0.length - 1 || (i - mid) % k === 0) out.push(COLS0[i]);
  return new Float32Array(out);
});

export type TileLayout = { lod: Lod; rows: number; cols: number; /** with the skirt ring */ vRows: number; vCols: number; vertices: number };

export function tileLayout(lod: Lod): TileLayout {
  const rows = TILE_LEN / LOD_ROW_STEP[lod] + 1, cols = COLUMNS[lod].length;
  return { lod, rows, cols, vRows: rows + 2, vCols: cols + 2, vertices: (rows + 2) * (cols + 2) };
}

/** Triangle indices for a tile grid with its skirt ring (shared by every tile of that LOD). */
export function tileIndices(lod: Lod): Uint32Array {
  const L = tileLayout(lod);
  const out = new Uint32Array((L.vRows - 1) * (L.vCols - 1) * 6);
  let k = 0;
  for (let r = 0; r < L.vRows - 1; r++) for (let c = 0; c < L.vCols - 1; c++) {
    const a = r * L.vCols + c, b = a + 1, d = a + L.vCols, e = d + 1;
    // rows run along +s (forward = -z in the path frame), columns along +u (right): CCW from above
    out[k++] = a; out[k++] = b; out[k++] = d;
    out[k++] = b; out[k++] = e; out[k++] = d;
  }
  return out;
}

export type TileBuffers = {
  /** xyz relative to origin, per vertex (skirt ring included) */
  position: Float32Array;
  normal: Float32Array;
  /** r = rock, g = moisture, b = wet (water depth), a = wall (0..255) */
  attrib: Uint8Array;
};

export function allocTile(lod: Lod): TileBuffers {
  const n = tileLayout(lod).vertices;
  return { position: new Float32Array(n * 3), normal: new Float32Array(n * 3), attrib: new Uint8Array(n * 4) };
}

export type TileOrigin = { x: number; y: number; z: number };

/**
 * Fill `out` for the tile starting at s0. Returns the origin (world) the positions are relative to.
 * Heights for the apron row / column are evaluated but only used for normals.
 */
export function generateTile(field: TerrainField, s0: number, lod: Lod, out: TileBuffers): TileOrigin {
  const L = tileLayout(lod), cols = COLUMNS[lod], step = LOD_ROW_STEP[lod];
  const path = field.path, f = createFrame();
  path.frameAt(s0, f);
  const ox = f.px, oz = f.pz, oy = path.floorAt(s0);
  // world positions incl. a 1-sample apron all round: (rows + 2) x (cols + 2)
  const ar = L.rows + 2, ac = L.cols + 2;
  const W = new Float64Array(ar * ac * 3);
  const sm: TerrainSample = createSample();
  const attr = new Float32Array(ar * ac * 4);
  const xz = { x: 0, z: 0 };
  for (let r = 0; r < ar; r++) {
    const s = s0 + (r - 1) * step;
    for (let c = 0; c < ac; c++) {
      const u = c === 0 ? cols[0] - (cols[1] - cols[0]) : c === ac - 1 ? cols[L.cols - 1] + (cols[L.cols - 1] - cols[L.cols - 2]) : cols[c - 1];
      field.sample(s, u, sm);
      field.worldXZ(s, u, xz);
      const i = (r * ac + c) * 3;
      W[i] = xz.x;
      W[i + 1] = sm.h;
      W[i + 2] = xz.z;
      const j = (r * ac + c) * 4;
      attr[j] = sm.rock;
      attr[j + 1] = sm.moisture;
      attr[j + 2] = Math.min(1, sm.depth / 3);
      attr[j + 3] = sm.wall;
    }
  }
  // the vertex grid = the apron grid (same size); the outer ring becomes the skirt
  const P = out.position, N = out.normal, A = out.attrib;
  const ix = (r: number, c: number) => (r * ac + c) * 3;
  for (let r = 0; r < ar; r++) for (let c = 0; c < ac; c++) {
    const skirt = r === 0 || r === ar - 1 || c === 0 || c === ac - 1;
    // skirt vertices sit on the nearest real edge vertex, dropped
    const rr = Math.min(ar - 2, Math.max(1, r)), cc = Math.min(ac - 2, Math.max(1, c));
    const i = ix(rr, cc), o = (r * ac + c) * 3;
    P[o] = W[i] - ox;
    P[o + 1] = W[i + 1] - oy - (skirt ? SKIRT : 0);
    P[o + 2] = W[i + 2] - oz;
    // normal from central differences in world space (apron makes edge normals match neighbours)
    const iu0 = ix(rr, cc - 1), iu1 = ix(rr, cc + 1), is0 = ix(rr - 1, cc), is1 = ix(rr + 1, cc);
    const ax = W[iu1] - W[iu0], ay = W[iu1 + 1] - W[iu0 + 1], az = W[iu1 + 2] - W[iu0 + 2]; // along +u
    const bx = W[is1] - W[is0], by = W[is1 + 1] - W[is0 + 1], bz = W[is1 + 2] - W[is0 + 2]; // along +s
    // up = b x a  (s forward x u right -> up for a right-handed frame)
    let nx = by * az - bz * ay, ny = bz * ax - bx * az, nz = bx * ay - by * ax;
    if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
    const nl = Math.hypot(nx, ny, nz) || 1;
    N[o] = nx / nl;
    N[o + 1] = ny / nl;
    N[o + 2] = nz / nl;
    const ja = (rr * ac + cc) * 4, jo = (r * ac + c) * 4;
    for (let k = 0; k < 4; k++) A[jo + k] = Math.round(Math.min(1, Math.max(0, attr[ja + k])) * 255);
  }
  return { x: ox, y: oy, z: oz };
}
