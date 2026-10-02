// Deterministic 2D noise for the terrain (Phase 2R §5): seeded simplex noise
// with analytic derivatives (Gustavson's formulation), fBm, ridged
// multifractal, domain warp and derivative-damped "erosion" fBm. Pure TS, no
// allocation per call (results go into a caller-owned scratch object), same
// result on the main thread, in workers and in tests.

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;
/** 12 gradient directions (unit, evenly spread) */
const GX = new Float64Array(12), GY = new Float64Array(12);
for (let i = 0; i < 12; i++) {
  GX[i] = Math.cos((i / 12) * Math.PI * 2);
  GY[i] = Math.sin((i / 12) * Math.PI * 2);
}

/** value + partial derivatives */
export type NoiseOut = { v: number; dx: number; dy: number };
export const noiseOut = (): NoiseOut => ({ v: 0, dx: 0, dy: 0 });

/** mulberry32: small, fast, deterministic */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Simplex2 {
  private readonly perm = new Uint8Array(512);
  private readonly grad = new Uint8Array(512);

  constructor(seed: number) {
    const r = rng(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      const t = p[i];
      p[i] = p[j];
      p[j] = t;
    }
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
      this.grad[i] = this.perm[i] % 12;
    }
  }

  /** simplex noise in about [-1, 1] with derivatives into `o` */
  noise(x: number, y: number, o: NoiseOut): NoiseOut {
    const s = (x + y) * F2;
    const i = Math.floor(x + s), j = Math.floor(y + s);
    const t = (i + j) * G2;
    const x0 = x - (i - t), y0 = y - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    const P = this.perm, G = this.grad;
    let v = 0, dx = 0, dy = 0;
    // corner 0
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) {
      const g = G[ii + P[jj]];
      const gd = GX[g] * x0 + GY[g] * y0;
      const t2 = t0 * t0, t4 = t2 * t2;
      v += t4 * gd;
      const k = -8 * t2 * t0 * gd;
      dx += k * x0 + t4 * GX[g];
      dy += k * y0 + t4 * GY[g];
    }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) {
      const g = G[ii + i1 + P[jj + j1]];
      const gd = GX[g] * x1 + GY[g] * y1;
      const t2 = t1 * t1, t4 = t2 * t2;
      v += t4 * gd;
      const k = -8 * t2 * t1 * gd;
      dx += k * x1 + t4 * GX[g];
      dy += k * y1 + t4 * GY[g];
    }
    let t2_ = 0.5 - x2 * x2 - y2 * y2;
    if (t2_ > 0) {
      const g = G[ii + 1 + P[jj + 1]];
      const gd = GX[g] * x2 + GY[g] * y2;
      const t2 = t2_ * t2_, t4 = t2 * t2;
      v += t4 * gd;
      const k = -8 * t2 * t2_ * gd;
      dx += k * x2 + t4 * GX[g];
      dy += k * y2 + t4 * GY[g];
    }
    t0 = t1 = t2_ = 0;
    o.v = 70 * v;
    o.dx = 70 * dx;
    o.dy = 70 * dy;
    return o;
  }
}

const _n = noiseOut();

/** fBm in about [-1, 1] (normalised by the amplitude sum) */
export function fbm(n: Simplex2, x: number, y: number, octaves: number, lacunarity = 2, gain = 0.5): number {
  let sum = 0, amp = 1, norm = 0, f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += amp * n.noise(x * f + o * 17.3, y * f - o * 9.1, _n).v;
    norm += amp;
    amp *= gain;
    f *= lacunarity;
  }
  return sum / norm;
}

/** ridged multifractal in [0, 1]: sharp crests (1 - |n|)^2, each octave weighted by the previous */
export function ridged(n: Simplex2, x: number, y: number, octaves: number, lacunarity = 2.05, gain = 0.5): number {
  let sum = 0, amp = 0.5, norm = 0, f = 1, w = 1;
  for (let o = 0; o < octaves; o++) {
    let r = 1 - Math.abs(n.noise(x * f + o * 31.7, y * f + o * 7.9, _n).v);
    r *= r;
    r *= w;
    w = Math.min(1, r * 2);
    sum += r * amp;
    norm += amp;
    amp *= gain;
    f *= lacunarity;
  }
  return sum / norm;
}

/**
 * Derivative-damped fBm (the "erosion" trick): each octave is scaled by
 * 1 / (1 + |accumulated gradient|^2), so slopes stay smooth-streaked while
 * flats keep detail — reads as gullies and spurs instead of blobby hills.
 */
export function erodedFbm(n: Simplex2, x: number, y: number, octaves: number, lacunarity = 2, gain = 0.5): number {
  let sum = 0, amp = 1, norm = 0, f = 1, gx = 0, gy = 0;
  for (let o = 0; o < octaves; o++) {
    n.noise(x * f + o * 13.1, y * f - o * 5.3, _n);
    gx += _n.dx * amp * f;
    gy += _n.dy * amp * f;
    sum += (amp * _n.v) / (1 + gx * gx + gy * gy);
    norm += amp;
    amp *= gain;
    f *= lacunarity;
  }
  return sum / norm;
}

/** domain warp: offsets (x, y) by low-frequency noise (written into `o.dx`, `o.dy`) */
export function warp(n: Simplex2, x: number, y: number, strength: number, o: NoiseOut): NoiseOut {
  o.dx = n.noise(x + 5.2, y + 1.3, _n).v * strength;
  o.dy = n.noise(x - 3.7, y + 8.4, _n).v * strength;
  return o;
}
