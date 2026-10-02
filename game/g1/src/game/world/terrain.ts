// TerrainField (Phase 2R §5): pure deterministic TS, shared by the sim, the
// bot, the tile workers and the tests. Heights are WORLD Y at path-relative
// coordinates (s along the flight path, u lateral along R(s)).
//
// Composition (look-dev tunable through the world's TerrainDef):
//   valley cross-section in (s, u): river channel carved into a gently
//   rolling floodplain -> scree apron -> steep wall face (cliff sharpening)
//   with strata terracing -> shoulder; then mountain massing beyond the
//   walls whose amplitude grows with |u| (the path always runs in a valley).
//   Detail noise (ridged multifractal + domain warp, derivative-damped
//   erosion gullies) is evaluated at WORLD (x, z) so features stay isotropic
//   around bends instead of stretching with the ribbon.
import type { TerrainDef } from '../../data/worlds/types';
import type { FlightPath, PathFrame } from './path';
import { createFrame } from './path';
import { Simplex2, erodedFbm, fbm, ridged, warp, noiseOut } from './noise';

export type TerrainOptions = {
  seed: number;
  /** authored floor half-width keys [s, halfWidth] (gorges, basins); else noise inside floorHalfWidth */
  widthKeys?: readonly (readonly [number, number])[];
};

export type TerrainSample = {
  /** world Y of the ground */
  h: number;
  /** water surface Y (NaN where there is no water) and depth below it (0 = dry) */
  waterY: number;
  depth: number;
  /** distance to the river centre (u, path-relative) */
  riverDist: number;
  /** 0..1 rock exposure (cliffs, scree), 0..1 moisture, 0..1 wall factor */
  rock: number;
  moisture: number;
  wall: number;
};

export const createSample = (): TerrainSample => ({ h: 0, waterY: NaN, depth: 0, riverDist: 0, rock: 0, moisture: 0, wall: 0 });

const sstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const smoother = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

/** soft terrace: flat treads, sharp risers; `sharp` 0 = none, 1 = hard steps */
function terrace(h: number, step: number, sharp: number): number {
  if (step <= 0 || sharp <= 0) return h;
  const k = h / step, f = Math.floor(k), r = k - f;
  // riser occupies (1 - tread) of each step
  const tread = 0.55 * sharp;
  const q = r < tread ? 0 : smoother((r - tread) / (1 - tread));
  return (f + q) * step * sharp + h * (1 - sharp);
}

export class TerrainField {
  readonly def: TerrainDef;
  readonly path: FlightPath;
  private readonly n1: Simplex2;
  private readonly n2: Simplex2;
  private readonly n3: Simplex2;
  private readonly widthKeys: readonly (readonly [number, number])[] | null;
  private readonly strata: { bands: number; sharpness: number; tilt: number } | null;
  private readonly terraces: { step: number; smooth: number } | null;
  // per-row cache
  private rowS = NaN;
  private readonly f: PathFrame = createFrame();
  private floorY = 0;
  private halfW = 0;
  private centre = 0;
  private wallL = 0;
  private wallR = 0;
  private riverHalf = 0;
  private readonly w = noiseOut();

  constructor(def: TerrainDef, path: FlightPath, opts: TerrainOptions) {
    this.def = def;
    this.path = path;
    this.n1 = new Simplex2(opts.seed);
    this.n2 = new Simplex2(opts.seed ^ 0x9e3779b9);
    this.n3 = new Simplex2(opts.seed ^ 0x85ebca6b);
    this.widthKeys = opts.widthKeys && opts.widthKeys.length ? opts.widthKeys : null;
    const st = def.modifiers.find(m => m.kind === 'strata');
    this.strata = st && st.kind === 'strata' ? st : null;
    const te = def.modifiers.find(m => m.kind === 'terraces');
    this.terraces = te && te.kind === 'terraces' ? te : null;
  }

  /** per-s quantities (cached: workers walk rows) */
  private row(s: number): void {
    if (s === this.rowS) return;
    this.rowS = s;
    const d = this.def, p = this.path;
    p.frameAt(s, this.f);
    this.floorY = p.floorAt(s);
    if (this.widthKeys) {
      const k = this.widthKeys;
      let i = 0;
      while (i < k.length - 2 && k[i + 1][0] < s) i++;
      const a = k[i], b = k[Math.min(i + 1, k.length - 1)];
      const t = b[0] > a[0] ? sstep(a[0], b[0], s) : 0;
      this.halfW = a[1] + (b[1] - a[1]) * t;
    } else {
      const v = 0.5 + 0.5 * fbm(this.n2, s / 1600, 3.1, 2);
      this.halfW = d.floorHalfWidth[0] + (d.floorHalfWidth[1] - d.floorHalfWidth[0]) * v;
    }
    // the river / valley centre meanders a little inside the floor (the path stays over the floor)
    const m = fbm(this.n2, s / Math.max(200, d.meander.wavelength * 0.35), 11.7, 2);
    this.centre = m * Math.min(this.halfW * 0.15, 28);
    const span = d.wallHeight[1] - d.wallHeight[0];
    this.wallL = d.wallHeight[0] + span * (0.5 + 0.5 * fbm(this.n3, s / 900, 1.9, 3));
    this.wallR = d.wallHeight[0] + span * (0.5 + 0.5 * fbm(this.n3, s / 900, 7.4, 3));
    const r = d.river;
    this.riverHalf = r ? 0.5 * (r.width[0] + (r.width[1] - r.width[0]) * (0.5 + 0.5 * fbm(this.n3, s / 700, 4.2, 2))) : 0;
  }

  /** world Y at (s, u) */
  height(s: number, u: number): number {
    this.row(s);
    return this.compose(u, null);
  }

  /** full sample at (s, u) into `out` */
  sample(s: number, u: number, out: TerrainSample): TerrainSample {
    this.row(s);
    out.h = this.compose(u, out);
    return out;
  }

  /** world (x, z) of the path-relative point (s, u) (after row(s)) */
  worldXZ(s: number, u: number, out: { x: number; z: number }): { x: number; z: number } {
    this.row(s);
    out.x = this.f.px + this.f.rx * u;
    out.z = this.f.pz + this.f.rz * u;
    return out;
  }

  private compose(u: number, out: TerrainSample | null): number {
    const d = this.def, f = this.f;
    const wx = f.px + f.rx * u, wz = f.pz + f.rz * u;
    const W = this.halfW;
    const du = u - this.centre, ad = Math.abs(du);
    const wallH = du < 0 ? this.wallL : this.wallR;
    // ---- floor: rolling floodplain rising gently to the banks, river channel carved in
    const roll = fbm(this.n1, wx / 220, wz / 220, 3) * 3.5 * sstep(this.riverHalf, W * 0.7, ad);
    const bank = (ad / W) * (ad / W) * 10;
    const rv = d.river;
    const channel = rv && this.riverHalf > 0 ? rv.depth * (1 - sstep(this.riverHalf * 0.55, this.riverHalf * 1.25, ad)) : 0;
    let h = roll + Math.min(bank, 14) - channel;
    // ---- walls: scree apron -> steep face -> shoulder
    const apron = d.cliffs.screeApron;
    const faceLen = Math.max(25, wallH * (0.95 - 0.7 * d.cliffs.sharpen));
    const a = sstep(W, W + apron, ad) * 0.12;
    const fx = Math.min(1, Math.max(0, (ad - W - apron * 0.55) / faceLen));
    const face = smoother(fx);
    // wall height wobbles along the face (buttresses, re-entrants) in world space
    const wob = 1 + 0.18 * fbm(this.n3, wx / 260, wz / 260, 3);
    let wall = wallH * wob * (a + 0.88 * face);
    if (this.strata) {
      const tilt = this.strata.tilt * fbm(this.n2, wx / 3000, wz / 3000, 1) * wallH;
      const step = wallH / Math.max(1, this.strata.bands);
      wall = terrace(wall + tilt, step, this.strata.sharpness) - tilt;
    }
    if (this.terraces) wall = terrace(wall, this.terraces.step, 1 - this.terraces.smooth);
    h += wall;
    // ---- mountain massing beyond the walls, growing with distance
    const wallTop = W + apron + faceLen;
    const reach = sstep(wallTop * 0.85, wallTop + 700, ad);
    if (reach > 0) {
      const R = d.ridges;
      warp(this.n2, wx / R.wavelength, wz / R.wavelength, R.warp, this.w);
      const rx = wx / R.wavelength + this.w.dx, rz = wz / R.wavelength + this.w.dy;
      const rid = ridged(this.n1, rx, rz, R.octaves);
      const far = sstep(wallTop + 300, wallTop + 1800, ad);
      const peak = d.peaks.height[0] + (d.peaks.height[1] - d.peaks.height[0]) * (0.5 + 0.5 * fbm(this.n3, wx / 2500, wz / 2500, 2));
      h += reach * (R.amplitude * rid + far * peak * rid * 0.6);
    }
    // ---- erosion gullies / spurs on the slopes (derivative-damped), fading on the floor
    const slopeZone = sstep(W, W + apron + faceLen * 0.5, ad);
    if (slopeZone > 0) h += slopeZone * erodedFbm(this.n1, wx / 150, wz / 150, 5) * (18 + 40 * d.erosion);
    const y = this.floorY + h;
    if (out) {
      const waterY = this.floorY - 0.6;
      const wet = rv && this.riverHalf > 0 && ad < this.riverHalf * 1.3 && y < waterY;
      out.waterY = wet ? waterY : NaN;
      out.depth = wet ? waterY - y : 0;
      out.riverDist = ad;
      out.wall = Math.min(1, wall / Math.max(1, wallH));
      out.rock = Math.min(1, face * 1.2 + (reach > 0 ? reach * 0.5 : 0));
      out.moisture = Math.max(0, Math.min(1, 1 - ad / (W * 1.6) + 0.25 * fbm(this.n3, wx / 400, wz / 400, 2)));
    }
    return y;
  }
}

/**
 * CPU height grid for sim / bot / camera / creature queries (§5 SIM QUERIES): 5 u cells, bilinear
 * between corner heights. Corners come from a ring cache filled from the same pure function; a miss
 * evaluates the corner directly — so every query result is a pure function of (s, u), never of what
 * happened to be cached. `misses` is logged (~0 in play).
 */
export class HeightGrid {
  static readonly CELL = 5;
  private readonly cols: number;
  private readonly rows: number;
  private readonly halfU: number;
  private readonly data: Float64Array;
  private readonly rowKey: Float64Array;
  misses = 0;
  queries = 0;

  /** `halfU`: lateral half-extent covered (u); `rows`: s rows kept (ring) */
  constructor(private readonly field: TerrainField, halfU = 240, rows = 256) {
    this.cols = Math.ceil((2 * halfU) / HeightGrid.CELL) + 1;
    this.rows = rows;
    this.data = new Float64Array(this.cols * rows);
    this.rowKey = new Float64Array(rows).fill(NaN);
    this.halfU = halfU;
  }

  /** fill rows [s0, s1] (call ahead of the player, a few rows per frame) */
  fill(s0: number, s1: number): void {
    const C = HeightGrid.CELL;
    for (let r = Math.floor(s0 / C); r <= Math.floor(s1 / C); r++) this.ensureRow(r);
  }

  private ensureRow(r: number): number {
    const slot = ((r % this.rows) + this.rows) % this.rows;
    if (this.rowKey[slot] !== r) {
      const C = HeightGrid.CELL, base = slot * this.cols;
      for (let c = 0; c < this.cols; c++) this.data[base + c] = this.field.height(r * C, -this.halfU + c * C);
      this.rowKey[slot] = r;
    }
    return slot;
  }

  private corner(r: number, c: number): number {
    if (c < 0 || c >= this.cols) return this.field.height(r * HeightGrid.CELL, -this.halfU + c * HeightGrid.CELL);
    const slot = ((r % this.rows) + this.rows) % this.rows;
    if (this.rowKey[slot] === r) return this.data[slot * this.cols + c];
    this.misses++;
    return this.field.height(r * HeightGrid.CELL, -this.halfU + c * HeightGrid.CELL);
  }

  /** ground world Y at path-relative (s, u) */
  height(s: number, u: number): number {
    this.queries++;
    const C = HeightGrid.CELL;
    const fs = s / C, fu = (u + this.halfU) / C;
    const r = Math.floor(fs), c = Math.floor(fu);
    const ts = fs - r, tu = fu - c;
    const h00 = this.corner(r, c), h01 = this.corner(r, c + 1), h10 = this.corner(r + 1, c), h11 = this.corner(r + 1, c + 1);
    return (h00 * (1 - tu) + h01 * tu) * (1 - ts) + (h10 * (1 - tu) + h11 * tu) * ts;
  }
}
