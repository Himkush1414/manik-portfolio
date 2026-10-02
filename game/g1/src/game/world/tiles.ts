// Terrain tiles (Phase 2R §5 TILES): pure TS so the worker, the main-thread
// fallback and the tests run the same code. A tile covers s in
// [s0, s0 + TILE_LEN] and u in [-RIBBON, +RIBBON] on non-uniform columns
// (2 u near the path, growing to ~24 u at the edges); rows every 2 / 4 / 8 u
// for LOD 0 / 1 / 2. Vertices are written RELATIVE to the tile origin
// (path point at s0, valley-floor height) for float precision. Normals use a
// one-row / one-column apron sampled from the same pure field, so the edges
// of neighbouring tiles get bit-identical normals (no lighting seams). A
// skirt ring (edge vertices dropped by SKIRT u) hides LOD T-junctions, and
// every vertex carries a geomorph target (the next LOD's surface) so the
// shader can blend a tile into its coarser neighbour before the switch.
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
  /**
   * Geomorph target = this vertex on the next coarser LOD's surface (LOD 2: itself):
   * x = dy, y = s + lod * MORPH_LOD_PACK (the vertex's path distance + its LOD), z/w = target
   * normal x / z (y = +sqrt(1 - x^2 - z^2): terrain normals always point up)
   */
  morph: Float32Array;
  /** target attrib (rock, moisture, wet, wall) on the coarser surface */
  morphAttrib: Uint8Array;
};

/** s + lod * MORPH_LOD_PACK packs both into one float (paths stay far below 65536 u) */
export const MORPH_LOD_PACK = 65536;

export function allocTile(lod: Lod): TileBuffers {
  const n = tileLayout(lod).vertices;
  return { position: new Float32Array(n * 3), normal: new Float32Array(n * 3), attrib: new Uint8Array(n * 4), morph: new Float32Array(n * 4), morphAttrib: new Uint8Array(n * 4) };
}

/** the transferable buffers of a tile (worker <-> main thread) */
export const tileTransfer = (b: TileBuffers): ArrayBuffer[] => [b.position.buffer, b.normal.buffer, b.attrib.buffer, b.morph.buffer, b.morphAttrib.buffer] as ArrayBuffer[];

export type TileOrigin = { x: number; y: number; z: number };

/**
 * Where a LOD n column sits on the LOD n+1 columns: the coarse column j with cols[j] <= u <=
 * cols[j + 1] and the fraction along it (every LOD n+1 column is also a LOD n column).
 */
const COARSE_COLS = [0, 1].map(l => {
  const fine = COLUMNS[l], coarse = COLUMNS[l + 1];
  const j = new Int32Array(fine.length), t = new Float64Array(fine.length);
  let k = 0;
  for (let i = 0; i < fine.length; i++) {
    while (k < coarse.length - 2 && coarse[k + 1] <= fine[i]) k++;
    j[i] = k;
    t[i] = (fine[i] - coarse[k]) / (coarse[k + 1] - coarse[k]);
  }
  return { j, t };
});

/** world positions + attributes over a tile's grid with a 1-sample apron all round: (rows + 2) x (cols + 2) */
type Grid = { W: Float64Array; attr: Float32Array; ar: number; ac: number };

function sampleGrid(field: TerrainField, s0: number, lod: Lod): Grid {
  const L = tileLayout(lod), cols = COLUMNS[lod], step = LOD_ROW_STEP[lod];
  const ar = L.rows + 2, ac = L.cols + 2;
  const W = new Float64Array(ar * ac * 3);
  const attr = new Float32Array(ar * ac * 4);
  const sm: TerrainSample = createSample();
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
  return { W, attr, ar, ac };
}

/** unit normal at an interior grid point from world-space central differences (apron -> edges match neighbours) */
function gridNormal(g: Grid, rr: number, cc: number, out: Float64Array): void {
  const W = g.W, ac = g.ac;
  const ix = (r: number, c: number) => (r * ac + c) * 3;
  const iu0 = ix(rr, cc - 1), iu1 = ix(rr, cc + 1), is0 = ix(rr - 1, cc), is1 = ix(rr + 1, cc);
  const ax = W[iu1] - W[iu0], ay = W[iu1 + 1] - W[iu0 + 1], az = W[iu1 + 2] - W[iu0 + 2]; // along +u
  const bx = W[is1] - W[is0], by = W[is1 + 1] - W[is0 + 1], bz = W[is1 + 2] - W[is0 + 2]; // along +s
  // up = b x a  (s forward x u right -> up for a right-handed frame)
  let nx = by * az - bz * ay, ny = bz * ax - bx * az, nz = bx * ay - by * ax;
  if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
  const nl = Math.hypot(nx, ny, nz) || 1;
  out[0] = nx / nl;
  out[1] = ny / nl;
  out[2] = nz / nl;
}

/** 8-bit attrib exactly as the GPU sees it */
const q8 = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255);

/**
 * Fill `out` for the tile starting at s0. Returns the origin (world) the positions are relative to.
 * Heights for the apron row / column are evaluated but only used for normals. The morph target of
 * every vertex is the LOD + 1 tile's surface at the same (s, u): height, normal and attribs taken
 * from that coarser grid (bit-identical to the LOD + 1 tile's own vertices) and interpolated over
 * its triangles the way the rasterizer does — a fully morphed tile IS its coarser neighbour.
 */
export function generateTile(field: TerrainField, s0: number, lod: Lod, out: TileBuffers): TileOrigin {
  const step = LOD_ROW_STEP[lod];
  const path = field.path, f = createFrame();
  path.frameAt(s0, f);
  const ox = f.px, oz = f.pz, oy = path.floorAt(s0);
  const g = sampleGrid(field, s0, lod);
  const W = g.W, ar = g.ar, ac = g.ac;
  // the coarser grid (LOD 2 morphs to itself) + its normals at its real vertices
  const cl = Math.min(2, lod + 1) as Lod;
  const cg = cl === lod ? g : sampleGrid(field, s0, cl);
  const cN = new Float64Array(cg.ar * cg.ac * 3), tmp = new Float64Array(3);
  for (let r = 1; r < cg.ar - 1; r++) for (let c = 1; c < cg.ac - 1; c++) {
    gridNormal(cg, r, c, tmp);
    const o = (r * cg.ac + c) * 3;
    cN[o] = tmp[0]; cN[o + 1] = tmp[1]; cN[o + 2] = tmp[2];
  }
  const cStep = LOD_ROW_STEP[cl], cRows = cg.ar - 2;
  const map = lod < 2 ? COARSE_COLS[lod] : null;
  const pack = lod * MORPH_LOD_PACK;
  const P = out.position, N = out.normal, A = out.attrib, M = out.morph, MA = out.morphAttrib;
  const n = new Float64Array(3);
  const tN = [0, 0, 0], tA = [0, 0, 0, 0];
  for (let r = 0; r < ar; r++) for (let c = 0; c < ac; c++) {
    const skirt = r === 0 || r === ar - 1 || c === 0 || c === ac - 1;
    // skirt vertices sit on the nearest real edge vertex, dropped
    const rr = Math.min(ar - 2, Math.max(1, r)), cc = Math.min(ac - 2, Math.max(1, c));
    const i = (rr * ac + cc) * 3, o = (r * ac + c) * 3;
    P[o] = W[i] - ox;
    P[o + 1] = W[i + 1] - oy - (skirt ? SKIRT : 0);
    P[o + 2] = W[i + 2] - oz;
    gridNormal(g, rr, cc, n);
    N[o] = n[0];
    N[o + 1] = n[1];
    N[o + 2] = n[2];
    const ja = (rr * ac + cc) * 4, jo = (r * ac + c) * 4;
    for (let k = 0; k < 4; k++) A[jo + k] = q8(g.attr[ja + k]);
    // morph target on the coarser surface
    const sLocal = (rr - 1) * step;
    let ty: number;
    if (!map) {
      ty = W[i + 1];
      tN[0] = n[0]; tN[1] = n[1]; tN[2] = n[2];
      for (let k = 0; k < 4; k++) tA[k] = A[jo + k];
    } else {
      const rc = Math.min(cRows - 2, Math.floor(sLocal / cStep));
      const ts = sLocal / cStep - rc, j = map.j[cc - 1], tu = map.t[cc - 1];
      // coarse cell corners in the coarse grid (apron offset 1): a (rc, j), b (rc, j+1), d (rc+1, j), e (rc+1, j+1);
      // triangles (a, b, d) + (b, e, d) as in tileIndices
      const a = (rc + 1) * cg.ac + (j + 1), b = a + 1, d = a + cg.ac, e = d + 1;
      let wa: number, wb: number, wd: number, we: number;
      if (ts + tu <= 1) { wa = 1 - ts - tu; wb = tu; wd = ts; we = 0; } else { wa = 0; wb = 1 - ts; wd = 1 - tu; we = ts + tu - 1; }
      ty = wa * cg.W[a * 3 + 1] + wb * cg.W[b * 3 + 1] + wd * cg.W[d * 3 + 1] + we * cg.W[e * 3 + 1];
      for (let k = 0; k < 3; k++) tN[k] = wa * cN[a * 3 + k] + wb * cN[b * 3 + k] + wd * cN[d * 3 + k] + we * cN[e * 3 + k];
      for (let k = 0; k < 4; k++) tA[k] = wa * q8(cg.attr[a * 4 + k]) + wb * q8(cg.attr[b * 4 + k]) + wd * q8(cg.attr[d * 4 + k]) + we * q8(cg.attr[e * 4 + k]);
    }
    const tl = Math.hypot(tN[0], tN[1], tN[2]) || 1;
    const jm = (r * ac + c) * 4;
    M[jm] = ty - W[i + 1];
    M[jm + 1] = s0 + sLocal + pack;
    M[jm + 2] = tN[0] / tl;
    M[jm + 3] = tN[2] / tl;
    for (let k = 0; k < 4; k++) MA[jm + k] = Math.round(tA[k]);
  }
  return { x: ox, y: oy, z: oz };
}
