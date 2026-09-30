// Procedural worn-gunmetal PBR set (albedo + ORM + normal), tileable.
// Painted gunmetal over bare steel: chips and edge scuffs reveal metal
// (metalness 0.9), painted areas stay dielectric; vertical grime streaks
// raise roughness; scratches + orange-peel go into the normal map.
import type { Texture } from 'three';
import { ValueNoise } from './noise';
import { makeCanvas, toTexture, heightToNormal } from './bake';
import { createRng } from '../../core/rng';

export type MetalSetOptions = {
  size?: number;
  seed?: number;
  paint: [number, number, number]; // sRGB 0..255
  bare: [number, number, number];
  wear?: number; // 0..1 chip coverage
  streaks?: number; // 0..1 grime streak strength
  roughPaint?: [number, number];
  roughBare?: [number, number];
};

export type MetalSet = { map: Texture; orm: Texture; normal: Texture; dispose(): void };

export function bakeMetalSet(opts: MetalSetOptions): MetalSet {
  const size = opts.size ?? 1024;
  const seed = opts.seed ?? 7;
  const wear = opts.wear ?? 0.35;
  const streaks = opts.streaks ?? 0.5;
  const [rp0, rp1] = opts.roughPaint ?? [0.36, 0.58];
  const [rb0, rb1] = opts.roughBare ?? [0.22, 0.4];
  const n = new ValueNoise(seed);
  const n2 = new ValueNoise(seed * 31 + 5);
  const rng = createRng(seed * 977);

  const height = new Float32Array(size * size);
  const bareMask = new Float32Array(size * size);
  const grime = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const chips = n.fbm(u, v, 12, 4);
      const chipEdge = n2.fbm(u, v, 48, 2);
      const c = chips + (chipEdge - 0.5) * 0.12;
      const bare = c > 1 - wear * 0.42 ? Math.min(1, (c - (1 - wear * 0.42)) * 14) : 0;
      bareMask[i] = bare;
      // vertical grime streaks: stretched noise along v
      const s = n2.fbm(u * 1, v * 0.08, 64, 3);
      grime[i] = Math.max(0, s - 0.45) * 2 * streaks;
      // orange peel + chip depressions
      height[i] = n.noise(u * 380, v * 380, 380) * 0.012 - bare * 0.18;
    }
  }

  // scratches: short straight gouges, mostly near-horizontal
  for (let k = 0; k < 150; k++) {
    const x0 = rng.next() * size;
    const y0 = rng.next() * size;
    const ang = (rng.next() - 0.5) * 0.9 + (rng.next() < 0.3 ? Math.PI / 2 : 0);
    const len = 8 + rng.next() * 70;
    const depth = 0.05 + rng.next() * 0.12;
    for (let t = 0; t < len; t++) {
      const px = Math.round(x0 + Math.cos(ang) * t);
      const py = Math.round(y0 + Math.sin(ang) * t);
      const i = ((py % size) + size) % size * size + (((px % size) + size) % size);
      height[i] -= depth;
      bareMask[i] = Math.max(bareMask[i], 0.28);
    }
  }

  const albedo = makeCanvas(size, size);
  const orm = makeCanvas(size, size);
  const aImg = albedo.ctx.createImageData(size, size);
  const oImg = orm.ctx.createImageData(size, size);
  const A = aImg.data;
  const O = oImg.data;
  const [pr, pg, pb] = opts.paint;
  const [br, bg, bb] = opts.bare;
  for (let i = 0; i < size * size; i++) {
    const u = (i % size) / size;
    const v = Math.floor(i / size) / size;
    const tone = 0.86 + n.fbm(u, v, 6, 3) * 0.28;
    const b = bareMask[i];
    const g = grime[i];
    const dark = 1 - g * 0.45;
    A[i * 4] = (pr * tone * (1 - b) + br * b) * dark;
    A[i * 4 + 1] = (pg * tone * (1 - b) + bg * b) * dark;
    A[i * 4 + 2] = (pb * tone * (1 - b) + bb * b) * dark;
    A[i * 4 + 3] = 255;
    const rough = (rp0 + (rp1 - rp0) * n2.fbm(u, v, 8, 3)) * (1 - b) + (rb0 + (rb1 - rb0) * n.fbm(u, v, 16, 2)) * b + g * 0.25;
    O[i * 4] = 255 * (1 - g * 0.3); // AO
    O[i * 4 + 1] = Math.min(1, rough) * 255; // roughness
    O[i * 4 + 2] = (0.05 + b * 0.85) * 255; // metalness
    O[i * 4 + 3] = 255;
  }
  albedo.ctx.putImageData(aImg, 0, 0);
  orm.ctx.putImageData(oImg, 0, 0);
  const normalCanvas = heightToNormal(height, size, size, 3.2);

  const set = {
    map: toTexture(albedo.canvas, 'color'),
    orm: toTexture(orm.canvas, 'data'),
    normal: toTexture(normalCanvas, 'data'),
    dispose() {
      set.map.dispose();
      set.orm.dispose();
      set.normal.dispose();
    },
  };
  return set;
}
