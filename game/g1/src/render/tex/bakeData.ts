// DOM-free bake math (runs inside the bake worker). Canvas/texture wrapping
// happens on the main thread.
import { ValueNoise } from './noise';
import { createRng } from '../../core/rng';

/**
 * Height (0..1, w*h) -> RGBA tangent-space normal map (tileable Sobel).
 * `rowsUp`: true for DataTextures (row index grows with +v), false for canvas
 * textures uploaded with flipY (row index grows with -v).
 */
export function heightToNormalData(height: Float32Array, w: number, h: number, strength: number, rowsUp = true): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  const at = (x: number, y: number) => height[((y + h) % h) * w + ((x + w) % w)];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tl = at(x - 1, y - 1), t = at(x, y - 1), tr = at(x + 1, y - 1);
      const l = at(x - 1, y), r = at(x + 1, y);
      const bl = at(x - 1, y + 1), b = at(x, y + 1), br = at(x + 1, y + 1);
      const dx = (tr + 2 * r + br - (tl + 2 * l + bl)) * strength;
      const dy = (bl + 2 * b + br - (tl + 2 * t + tr)) * strength;
      const nx = -dx, ny = rowsUp ? -dy : dy, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      const i = (y * w + x) * 4;
      d[i] = ((nx / len) * 0.5 + 0.5) * 255;
      d[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      d[i + 2] = ((nz / len) * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  }
  return d;
}

export type MetalSetOptions = {
  size?: number;
  seed?: number;
  paint: [number, number, number];
  bare: [number, number, number];
  wear?: number;
  streaks?: number;
  roughPaint?: [number, number];
  roughBare?: [number, number];
};

export type MetalSetData = { size: number; albedo: Uint8ClampedArray; orm: Uint8ClampedArray; normal: Uint8ClampedArray };

/** Worn painted-metal PBR set as raw RGBA arrays. */
export function computeMetalSet(opts: MetalSetOptions): MetalSetData {
  const size = opts.size ?? 1024;
  const seed = opts.seed ?? 7;
  const wear = opts.wear ?? 0.35;
  const streaks = opts.streaks ?? 0.5;
  const [rp0, rp1] = opts.roughPaint ?? [0.36, 0.58];
  const [rb0, rb1] = opts.roughBare ?? [0.22, 0.4];
  const n = new ValueNoise(seed);
  const n2 = new ValueNoise(seed * 31 + 5);
  const rng = createRng(seed * 977);
  const N = size * size;
  const height = new Float32Array(N);
  const bareMask = new Float32Array(N);
  const grime = new Float32Array(N);
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const c = n.fbm(u, v, 12, 4) + (n2.fbm(u, v, 48, 2) - 0.5) * 0.12;
      const bare = c > 1 - wear * 0.42 ? Math.min(1, (c - (1 - wear * 0.42)) * 14) : 0;
      bareMask[i] = bare;
      grime[i] = Math.max(0, n2.fbm(u, v * 0.08, 64, 3) - 0.45) * 2 * streaks;
      height[i] = n.noise(u * 380, v * 380, 380) * 0.012 - bare * 0.18;
    }
  }
  for (let k = 0; k < 150; k++) {
    const x0 = rng.next() * size, y0 = rng.next() * size;
    const ang = (rng.next() - 0.5) * 0.9 + (rng.next() < 0.3 ? Math.PI / 2 : 0);
    const len = 8 + rng.next() * 70;
    const depth = 0.05 + rng.next() * 0.12;
    for (let t = 0; t < len; t++) {
      const px = Math.round(x0 + Math.cos(ang) * t), py = Math.round(y0 + Math.sin(ang) * t);
      const i = (((py % size) + size) % size) * size + (((px % size) + size) % size);
      height[i] -= depth;
      bareMask[i] = Math.max(bareMask[i], 0.28);
    }
  }
  const A = new Uint8ClampedArray(N * 4), O = new Uint8ClampedArray(N * 4);
  const [pr, pg, pb] = opts.paint, [br, bg, bb] = opts.bare;
  for (let i = 0; i < N; i++) {
    const u = (i % size) / size, v = Math.floor(i / size) / size;
    const tone = 0.86 + n.fbm(u, v, 6, 3) * 0.28;
    const b = bareMask[i], g = grime[i], dark = 1 - g * 0.45;
    A[i * 4] = (pr * tone * (1 - b) + br * b) * dark;
    A[i * 4 + 1] = (pg * tone * (1 - b) + bg * b) * dark;
    A[i * 4 + 2] = (pb * tone * (1 - b) + bb * b) * dark;
    A[i * 4 + 3] = 255;
    const rough = (rp0 + (rp1 - rp0) * n2.fbm(u, v, 8, 3)) * (1 - b) + (rb0 + (rb1 - rb0) * n.fbm(u, v, 16, 2)) * b + g * 0.25;
    O[i * 4] = 255 * (1 - g * 0.3);
    O[i * 4 + 1] = Math.min(1, rough) * 255;
    O[i * 4 + 2] = (0.05 + b * 0.85) * 255;
    O[i * 4 + 3] = 255;
  }
  return { size, albedo: A, orm: O, normal: heightToNormalData(height, size, size, 3.2) };
}

/** Stencil wear on an RGBA atlas: knock alpha out where noise dips, per rect. */
export function erodeData(
  data: Uint8ClampedArray,
  width: number,
  rects: { x: number; y: number; w: number; h: number; amount: number }[],
  seed = 4071,
): void {
  const noise = new ValueNoise(seed);
  for (const r of rects) {
    for (let j = 0; j < r.h; j++) {
      for (let i = 0; i < r.w; i++) {
        const k = ((r.y + j) * width + (r.x + i)) * 4 + 3;
        if (data[k] === 0) continue;
        const nv = noise.fbm((r.x + i) / width, (r.y + j) / width, 40, 3);
        const fine = noise.noise((r.x + i) * 0.9, (r.y + j) * 0.9, 921);
        data[k] = nv + fine * 0.18 > r.amount ? data[k] : data[k] * 0.15;
      }
    }
  }
}
