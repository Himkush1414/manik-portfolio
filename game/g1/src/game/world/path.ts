// Flight path (Phase 2R §4): pure TS, deterministic, no three.js.
// Horizontal centripetal Catmull-Rom (alpha 0.5) through the authored
// waypoints -> dense samples -> a 1 u arc-length table. Altitude = the
// valley-floor profile + the clearance profile (both eased between
// waypoints by arc length), so the path always flies the valley. Rail space
// is unchanged: s = arc length, x along R(s), y along U(s), where
// T = unit tangent (3D), R = normalize(T x worldUp), U = R x T (no roll;
// visual bank is cosmetic and applied by the renderer).
import type { PathDef } from './pathDef';
import { PATH_RULES } from './pathDef';

export type PathFrame = {
  /** world position of the path point */
  px: number; py: number; pz: number;
  /** unit tangent (forward), right, up */
  tx: number; ty: number; tz: number;
  rx: number; ry: number; rz: number;
  ux: number; uy: number; uz: number;
};

export function createFrame(): PathFrame {
  return { px: 0, py: 0, pz: 0, tx: 0, ty: 0, tz: -1, rx: 1, ry: 0, rz: 0, ux: 0, uy: 1, uz: 0 };
}

/** dense horizontal sampling: chords of at most this length (u) before arc-length resampling — coarse
 *  chords alias the heading (piecewise-constant -> curvature spikes, camera jitter) */
const CHORD = 0.25;

function catmullRom(p0: number, p1: number, p2: number, p3: number, t0: number, t1: number, t2: number, t3: number, t: number): number {
  // Barry-Goldman pyramid (non-uniform knots)
  const a1 = ((t1 - t) / (t1 - t0)) * p0 + ((t - t0) / (t1 - t0)) * p1;
  const a2 = ((t2 - t) / (t2 - t1)) * p1 + ((t - t1) / (t2 - t1)) * p2;
  const a3 = ((t3 - t) / (t3 - t2)) * p2 + ((t - t2) / (t3 - t2)) * p3;
  const b1 = ((t2 - t) / (t2 - t0)) * a1 + ((t - t0) / (t2 - t0)) * a2;
  const b2 = ((t3 - t) / (t3 - t1)) * a2 + ((t - t1) / (t3 - t1)) * a3;
  return ((t2 - t) / (t2 - t1)) * b1 + ((t - t1) / (t2 - t1)) * b2;
}

const smooth = (x: number) => x * x * (3 - 2 * x);

export class FlightPath {
  /** total arc length (u), horizontal + vertical */
  readonly length: number;
  /** per-metre tables (index = floor(s)) */
  readonly x: Float64Array;
  readonly z: Float64Array;
  readonly y: Float64Array;
  readonly floor: Float64Array;
  readonly clearance: Float32Array;
  readonly envA: Float32Array;
  readonly envB: Float32Array;
  readonly bank: Float32Array;
  /** horizontal heading (rad, atan2(dx, -dz)) and signed curvature (1/u) per metre */
  readonly heading: Float32Array;
  readonly curvature: Float32Array;
  /** arc length of each waypoint */
  readonly waypointS: Float64Array;

  constructor(readonly def: PathDef) {
    const w = def.waypoints;
    const n = w.length;
    // phantom end points (reflection) so the curve passes through every waypoint
    const P = (i: number): [number, number] => {
      if (i < 0) return [2 * w[0].x - w[1].x, 2 * w[0].z - w[1].z];
      if (i >= n) return [2 * w[n - 1].x - w[n - 2].x, 2 * w[n - 1].z - w[n - 2].z];
      return [w[i].x, w[i].z];
    };
    // 1) dense horizontal polyline + its cumulative horizontal length
    const hx: number[] = [], hz: number[] = [], hL: number[] = [0], wpIdx: number[] = [0];
    hx.push(w[0].x);
    hz.push(w[0].z);
    for (let i = 0; i < n - 1; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      const k = (a: [number, number], b: [number, number]) => Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])) || 1e-6;
      const t0 = 0, t1 = t0 + k(p0, p1), t2 = t1 + k(p1, p2), t3 = t2 + k(p2, p3);
      const sub = Math.max(16, Math.ceil((Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * 1.3) / CHORD));
      for (let j = 1; j <= sub; j++) {
        const t = t1 + ((t2 - t1) * j) / sub;
        const x = catmullRom(p0[0], p1[0], p2[0], p3[0], t0, t1, t2, t3, t);
        const z = catmullRom(p0[1], p1[1], p2[1], p3[1], t0, t1, t2, t3, t);
        hL.push(hL[hL.length - 1] + Math.hypot(x - hx[hx.length - 1], z - hz[hz.length - 1]));
        hx.push(x);
        hz.push(z);
      }
      wpIdx.push(hx.length - 1);
    }
    const H = hL[hL.length - 1];
    // 2) vertical profiles by horizontal arc length, eased between waypoints
    const wpH = wpIdx.map(i => hL[i]);
    const profileAt = (h: number, get: (i: number) => number): number => {
      let i = 0;
      while (i < n - 2 && wpH[i + 1] < h) i++;
      const f = Math.min(1, Math.max(0, (h - wpH[i]) / Math.max(1e-9, wpH[i + 1] - wpH[i])));
      return get(i) + (get(i + 1) - get(i)) * smooth(f);
    };
    const floorOf = (i: number) => w[i].floor ?? def.datum;
    // 3) resample to a 1 u table along the 3D arc length (horizontal step 1 u, then integrate 3D)
    const steps = Math.max(2, Math.ceil(H));
    const tx = new Float64Array(steps + 1), tz = new Float64Array(steps + 1), ty = new Float64Array(steps + 1);
    let seg = 0;
    for (let k = 0; k <= steps; k++) {
      const h = (k / steps) * H;
      while (seg < hL.length - 2 && hL[seg + 1] < h) seg++;
      const f = (h - hL[seg]) / Math.max(1e-9, hL[seg + 1] - hL[seg]);
      tx[k] = hx[seg] + (hx[seg + 1] - hx[seg]) * f;
      tz[k] = hz[seg] + (hz[seg + 1] - hz[seg]) * f;
      ty[k] = profileAt(h, floorOf) + profileAt(h, i => w[i].clearance);
    }
    const L3: number[] = [0];
    for (let k = 1; k <= steps; k++) L3.push(L3[k - 1] + Math.hypot(tx[k] - tx[k - 1], ty[k] - ty[k - 1], tz[k] - tz[k - 1]));
    this.length = L3[steps];
    const m = Math.floor(this.length) + 2;
    this.x = new Float64Array(m);
    this.z = new Float64Array(m);
    this.y = new Float64Array(m);
    this.floor = new Float64Array(m);
    this.clearance = new Float32Array(m);
    this.envA = new Float32Array(m);
    this.envB = new Float32Array(m);
    this.bank = new Float32Array(m);
    this.heading = new Float32Array(m);
    this.curvature = new Float32Array(m);
    let k = 0;
    for (let s = 0; s < m; s++) {
      const target = Math.min(s, this.length);
      while (k < steps - 1 && L3[k + 1] < target) k++;
      const f = Math.min(1, (target - L3[k]) / Math.max(1e-9, L3[k + 1] - L3[k]));
      const h = ((k + f) / steps) * H;
      this.x[s] = tx[k] + (tx[k + 1] - tx[k]) * f;
      this.z[s] = tz[k] + (tz[k + 1] - tz[k]) * f;
      this.y[s] = ty[k] + (ty[k + 1] - ty[k]) * f;
      this.floor[s] = profileAt(h, floorOf);
      this.clearance[s] = profileAt(h, i => w[i].clearance);
      this.envA[s] = profileAt(h, i => w[i].envA);
      this.envB[s] = profileAt(h, i => w[i].envB);
      this.bank[s] = profileAt(h, i => w[i].bank);
    }
    // headings from real samples only (entries past the end are clamped copies of the end point)
    const last = Math.max(1, Math.floor(this.length));
    for (let s = 0; s < m; s++) {
      const c = Math.min(s, last);
      const a = Math.max(0, c - 1), b = Math.min(last, c + 1);
      this.heading[s] = Math.atan2(this.x[b] - this.x[a], -(this.z[b] - this.z[a]));
    }
    // curvature from the heading change over +-10 u (smooth, robust)
    for (let s = 0; s < m; s++) {
      const c = Math.min(s, last);
      const a = Math.max(0, c - 10), b = Math.min(last, c + 10);
      let d = this.heading[b] - this.heading[a];
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.curvature[s] = b > a ? d / (b - a) : 0;
    }
    this.waypointS = new Float64Array(wpIdx.map(i => {
      // nearest table entry to the waypoint's horizontal position
      const wx = hx[i], wz = hz[i];
      let best = 0, bd = Infinity;
      for (let s = 0; s < m; s++) {
        const d = (this.x[s] - wx) ** 2 + (this.z[s] - wz) ** 2;
        if (d < bd) { bd = d; best = s; }
      }
      return best;
    }));
  }

  private sample(arr: Float64Array | Float32Array, s: number): number {
    const c = Math.min(Math.max(s, 0), this.x.length - 1.000001);
    const i = Math.floor(c), f = c - i;
    return arr[i] + (arr[i + 1] - arr[i]) * f;
  }

  floorAt(s: number): number { return this.sample(this.floor, s); }
  clearanceAt(s: number): number { return this.sample(this.clearance, s); }
  bankAt(s: number): number { return this.sample(this.bank, s); }
  curvatureAt(s: number): number { return this.sample(this.curvature, s); }
  envelopeAt(s: number, out: { a: number; b: number }): { a: number; b: number } {
    out.a = this.sample(this.envA, s);
    out.b = this.sample(this.envB, s);
    return out;
  }

  /** frame at arc length s (clamped); no allocation */
  frameAt(s: number, out: PathFrame): PathFrame {
    out.px = this.sample(this.x, s);
    out.py = this.sample(this.y, s);
    out.pz = this.sample(this.z, s);
    const a = s - 1, b = s + 1;
    let tx = this.sample(this.x, b) - this.sample(this.x, a);
    let ty = this.sample(this.y, b) - this.sample(this.y, a);
    let tz = this.sample(this.z, b) - this.sample(this.z, a);
    const tl = Math.hypot(tx, ty, tz) || 1;
    tx /= tl; ty /= tl; tz /= tl;
    // R = T x worldUp(0,1,0) = (-tz, 0, tx) normalised
    let rx = -tz, rz = tx;
    const rl = Math.hypot(rx, rz) || 1;
    rx /= rl; rz /= rl;
    // U = R x T
    out.tx = tx; out.ty = ty; out.tz = tz;
    out.rx = rx; out.ry = 0; out.rz = rz;
    out.ux = -rz * ty; // (ry*tz - rz*ty) with ry = 0
    out.uy = rz * tx - rx * tz;
    out.uz = rx * ty; // (rx*ty - ry*tx)
    return out;
  }

  /** rail space (s, x, y) -> world point */
  toWorld(s: number, x: number, y: number, f: PathFrame, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
    this.frameAt(s, f);
    out.x = f.px + f.rx * x + f.ux * y;
    out.y = f.py + f.ry * x + f.uy * y;
    out.z = f.pz + f.rz * x + f.uz * y;
    return out;
  }
}

/** Path rules that need the built path (and optionally the terrain): curvature, pitch, continuity,
 *  envelope clearance. `ground(s, u)` = terrain world height at the path-relative point. */
export function validatePath(p: FlightPath, ground?: (s: number, u: number) => number): string[] {
  const e: string[] = [];
  const rMin = PATH_RULES.curvatureFactor * PATH_RULES.ribbonHalfWidth;
  const maxPitch = Math.tan((PATH_RULES.maxPitchDeg * Math.PI) / 180);
  let worstR = Infinity, worstRS = 0, worstP = 0, worstPS = 0;
  for (let s = 1; s < p.length - 1; s++) {
    const k = Math.abs(p.curvature[s]);
    if (k > 1e-9 && 1 / k < worstR) { worstR = 1 / k; worstRS = s; }
    const dy = p.y[s + 1] - p.y[s - 1];
    const dh = Math.hypot(p.x[s + 1] - p.x[s - 1], p.z[s + 1] - p.z[s - 1]);
    const pitch = Math.abs(dy) / Math.max(1e-9, dh);
    if (pitch > worstP) { worstP = pitch; worstPS = s; }
    const step = Math.hypot(p.x[s] - p.x[s - 1], p.y[s] - p.y[s - 1], p.z[s] - p.z[s - 1]);
    if (step > 1.02 || step < 0.98) { e.push(`continuity: step ${step.toFixed(3)} u at s=${s}`); break; }
  }
  if (worstR < rMin) e.push(`curvature: radius ${worstR.toFixed(0)} u at s=${worstRS} < ${rMin} u`);
  if (worstP > maxPitch) e.push(`pitch: ${((Math.atan(worstP) * 180) / Math.PI).toFixed(1)} deg at s=${worstPS} > ${PATH_RULES.maxPitchDeg}`);
  if (ground) {
    const f = createFrame(), env = { a: 0, b: 0 };
    for (let s = 0; s < p.length; s += 4) {
      p.frameAt(s, f);
      p.envelopeAt(s, env);
      // the 8 envelope points (ellipse every 45 deg)
      for (let k = 0; k < 8; k++) {
        const ang = (k * Math.PI) / 4;
        const u = Math.cos(ang) * env.a, v = Math.sin(ang) * env.b;
        const wy = f.py + f.ry * u + f.uy * v;
        const g = ground(s, u);
        if (wy - g < PATH_RULES.envelopeMargin) {
          e.push(`envelope: point (${u.toFixed(1)}, ${v.toFixed(1)}) only ${(wy - g).toFixed(1)} u above terrain at s=${s}`);
          return e;
        }
      }
    }
  }
  return e;
}
