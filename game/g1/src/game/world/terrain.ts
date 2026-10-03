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
import { chapterAt, type ChapterKey, type ChapterState } from './chapters';

export type TerrainOptions = {
  seed: number;
  /** authored floor half-width keys [s, halfWidth] (gorges, basins); else noise inside floorHalfWidth */
  widthKeys?: readonly (readonly [number, number])[];
  /** C1 landscape chapters (resolved, game/world/chapters.ts): when present they set the floor half-width,
   *  wall height, steepness and minimum wall per s (and replace widthKeys) */
  chapters?: readonly ChapterKey[];
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
  private readonly chapters: readonly ChapterKey[] | null;
  /** this row's chapter numbers (chapters only): steepness 0..1 + minimum wall share */
  private readonly ch: ChapterState = { halfWidth: 0, wallHeight: 0, steep: 0, rim: 0 };
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
    this.chapters = opts.chapters && opts.chapters.length ? opts.chapters : null;
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
    if (this.chapters) {
      this.halfW = chapterAt(this.chapters, s, this.ch).halfWidth;
    } else if (this.widthKeys) {
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
    if (this.chapters) {
      // the chapter's wall height, varied +-15 % per side so the two walls never mirror
      const W = this.ch.wallHeight;
      this.wallL = W * (1 + 0.15 * fbm(this.n3, s / 900, 1.9, 3));
      this.wallR = W * (1 + 0.15 * fbm(this.n3, s / 900, 7.4, 3));
    } else {
      const span = d.wallHeight[1] - d.wallHeight[0];
      this.wallL = d.wallHeight[0] + span * (0.5 + 0.5 * fbm(this.n3, s / 900, 1.9, 3));
      this.wallR = d.wallHeight[0] + span * (0.5 + 0.5 * fbm(this.n3, s / 900, 7.4, 3));
    }
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

  /** the river at s: water surface world Y (NaN: no river here), channel centre u, and how far from the
   *  centre (u) water can stand — `compose` wets exactly the points under the surface inside that reach */
  riverAt(s: number, out: { y: number; centre: number; reach: number }): { y: number; centre: number; reach: number } {
    this.row(s);
    const wet = !!this.def.river && this.riverHalf > 0;
    out.y = wet ? this.floorY - 0.6 : NaN;
    out.centre = this.centre;
    out.reach = wet ? this.riverHalf * 1.3 : 0;
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
    const du = u - this.centre, ad = Math.abs(du);
    const side = du < 0 ? 0 : 1;
    const wallH = side === 0 ? this.wallL : this.wallR;
    // ---- valley edge, perturbed in WORLD space per side: spurs jut in, bays recede
    const edgeN = fbm(this.n2, wx / 520 + side * 41.3, wz / 520, 3);
    // spurs jut in, bays recede; with chapters a bay recedes at most +18 % (the walls must frame the line)
    const W = Math.max(this.riverHalf + 30, this.halfW * (1 + 0.32 * (this.chapters ? Math.min(edgeN, 0.56) : edgeN)));
    // ---- floor: rolling floodplain rising gently to the edge, river channel carved in
    // floor relief: low world-space hills, rising toward the valley sides (no distance-based benches:
    // anything that is a pure function of the distance to the river draws stripes along it)
    const away = sstep(this.riverHalf, W * 0.75, ad);
    const roll = (fbm(this.n1, wx / 380, wz / 380, 4) * 7 + fbm(this.n2, wx / 120, wz / 120, 2) * 1.6) * away;
    const q = Math.min(1, ad / W);
    const bank = q * q * 9;
    const rv = d.river;
    const channel = rv && this.riverHalf > 0 ? rv.depth * (1 - sstep(this.riverHalf * 0.55, this.riverHalf * 1.25, ad)) : 0;
    let h = roll + bank - channel;
    // ---- the valley sides (skipped on the floor: everything below is zero there, and the floor is
    // where the dense 2 u columns sit)
    const beyond = Math.max(0, ad - W);
    let prof = 0, rockMask = 0, far = 0, t = 0;
    if (beyond > 0) {
      // the mountain field the valley is carved into (world space, ridged + warped)
      const R = d.ridges;
      warp(this.n2, wx / R.wavelength, wz / R.wavelength, R.warp, this.w);
      const rx = wx / R.wavelength + this.w.dx, rz = wz / R.wavelength + this.w.dy;
      // massive shoulders (smooth) + sharp crests (ridged): raw ridged noise alone reads as needles
      const rid = 0.62 * ridged(this.n1, rx, rz, R.octaves) + 0.38 * (0.5 + 0.5 * fbm(this.n3, rx * 0.8 + 3.3, rz * 0.8, 4));
      const broad = 0.5 + 0.5 * fbm(this.n3, wx / (R.wavelength * 1.7), wz / (R.wavelength * 1.7), 3);
      // amplitude grows from the valley-side hills (wallH) to the high peaks toward the ribbon edge
      far = sstep(150, 900, beyond);
      const peakH = d.peaks.height[0] + (d.peaks.height[1] - d.peaks.height[0]) * broad;
      const amp = wallH * (0.55 + 0.6 * broad) * (1 - far) + peakH * far;
      // chapters set a minimum wall share (no low saddle for a lateral escape); else the raw ridges
      const rim = this.chapters ? this.ch.rim : 0.25;
      const field = amp * (rim + (1 - rim) * rid);
      // side profile: slope steepness varies (gentle hillsides vs cliff bands from a rock mask);
      // narrows (half-width near the gorge range) turn the sides into steep rock
      const gorge = this.chapters ? this.ch.steep : 1 - sstep(d.gorgeHalfWidth[1], d.floorHalfWidth[0], this.halfW);
      rockMask = Math.max(gorge, sstep(0.05, 0.45, fbm(this.n3, wx / 700 + 9.1, wz / 700, 3) + (d.cliffs.sharpen - 0.5) * 0.6));
      // in a gorge the apron vanishes and the rock rises almost vertically from the floor edge
      const run = (wallH * (1.25 - 0.85 * rockMask) + d.cliffs.screeApron) * (1 - gorge) + (wallH * 0.16 + 6) * gorge;
      t = Math.min(1, beyond / run);
      // concave foot (scree / colluvium), steepening, then the field takes over
      prof = t * t * (3 - 2 * t) * (0.65 + 0.35 * t);
      let sideH = field * prof;
      // limestone bands: strata only where the rock mask exposes the face
      if (this.strata && rockMask > 0.01 && sideH > 1) {
        const step = Math.max(8, wallH / Math.max(1, this.strata.bands));
        sideH = sideH + (terrace(sideH, step, this.strata.sharpness) - sideH) * rockMask * sstep(0, 0.25, t);
      }
      if (this.terraces && sideH > 1) sideH = sideH + (terrace(sideH, this.terraces.step, 1 - this.terraces.smooth) - sideH) * 0.5 * sstep(0, 0.2, t);
      h += sideH;
      // erosion gullies / spurs on the slopes (derivative-damped, warped so they do not comb)
      const slopeZone = sstep(0, run * 0.4, beyond);
      if (slopeZone > 0) h += slopeZone * erodedFbm(this.n1, wx / 170 + this.w.dx * 0.6, wz / 170 + this.w.dy * 0.6, 5) * (14 + 46 * d.erosion) * (0.6 + 0.4 * prof);
    }
    const y = this.floorY + h;
    if (out) {
      const waterY = this.floorY - 0.6;
      const wet = rv && this.riverHalf > 0 && ad < this.riverHalf * 1.3 && y < waterY;
      out.waterY = wet ? waterY : NaN;
      out.depth = wet ? waterY - y : 0;
      out.riverDist = ad;
      out.wall = prof;
      out.rock = Math.min(1, rockMask * sstep(0.05, 0.4, t) + far * 0.4);
      out.moisture = Math.max(0, Math.min(1, 1 - ad / (W * 1.6) + 0.25 * fbm(this.n3, wx / 400, wz / 400, 2)));
    }
    return y;
  }
}

const _riv = { y: NaN, centre: 0, reach: 0 };

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
  /** per row: river surface Y (NaN = none), channel centre u, wet reach (TerrainField.riverAt) */
  private readonly rowWaterY: Float64Array;
  private readonly rowRiverC: Float64Array;
  private readonly rowRiverR: Float64Array;
  misses = 0;
  queries = 0;

  /** `halfU`: lateral half-extent covered (u); `rows`: s rows kept (ring) */
  constructor(private readonly field: TerrainField, halfU = 320, rows = 256) {
    this.cols = Math.ceil((2 * halfU) / HeightGrid.CELL) + 1;
    this.rows = rows;
    this.data = new Float64Array(this.cols * rows);
    this.rowKey = new Float64Array(rows).fill(NaN);
    this.rowWaterY = new Float64Array(rows);
    this.rowRiverC = new Float64Array(rows);
    this.rowRiverR = new Float64Array(rows);
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
      this.field.riverAt(r * C, _riv);
      this.rowWaterY[slot] = _riv.y;
      this.rowRiverC[slot] = _riv.centre;
      this.rowRiverR[slot] = _riv.reach;
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

  /** water surface world Y at path-relative (s, u), NaN where dry (the sim's splash / drag; nearest row) */
  water(s: number, u: number): number {
    const r = Math.round(s / HeightGrid.CELL);
    const slot = ((r % this.rows) + this.rows) % this.rows;
    let y: number, c: number, reach: number;
    if (this.rowKey[slot] === r) {
      y = this.rowWaterY[slot];
      c = this.rowRiverC[slot];
      reach = this.rowRiverR[slot];
    } else {
      this.misses++;
      this.field.riverAt(r * HeightGrid.CELL, _riv);
      y = _riv.y;
      c = _riv.centre;
      reach = _riv.reach;
    }
    if (!(y === y) || Math.abs(u - c) >= reach) return NaN;
    return this.height(s, u) < y ? y : NaN;
  }
}
