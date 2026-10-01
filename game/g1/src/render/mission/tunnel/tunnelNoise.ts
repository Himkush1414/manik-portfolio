// Seamless RGBA noise for the wormhole (brief §6: "noise from a baked
// seamless RGBA 256^2 texture built at load — no per-pixel fbm"). Each
// channel is periodic fbm at its own base frequency, so the texture tiles in
// both directions (the shader wraps it around the tube with integer repeats:
// no seam at theta = 0). Baked in idle slices (one row block per step).
import { DataTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, RGBAFormat, UnsignedByteType } from 'three';
import { Rng } from '../../../game/core/rng';

/** periodic gradient noise lattice */
function lattice(period: number, rng: Rng): Float32Array {
  const g = new Float32Array(period * period * 2);
  for (let i = 0; i < period * period; i++) {
    const a = rng.next() * Math.PI * 2;
    g[i * 2] = Math.cos(a);
    g[i * 2 + 1] = Math.sin(a);
  }
  return g;
}

function corner(g: Float32Array, period: number, ix: number, iy: number, dx: number, dy: number): number {
  const k = (((iy % period) + period) % period) * period + (((ix % period) + period) % period);
  return g[k * 2] * dx + g[k * 2 + 1] * dy;
}

function grad(g: Float32Array, period: number, x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10), v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
  const n00 = corner(g, period, xi, yi, xf, yf), n10 = corner(g, period, xi + 1, yi, xf - 1, yf);
  const n01 = corner(g, period, xi, yi + 1, xf, yf - 1), n11 = corner(g, period, xi + 1, yi + 1, xf - 1, yf - 1);
  return n00 + (n10 - n00) * u + (n01 - n00) * v + (n00 - n10 - n01 + n11) * u * v; // ~[-0.7, 0.7]
}

/** periodic fbm in [0, 1] */
function fbm(lats: Float32Array[], periods: number[], x: number, y: number): number {
  let s = 0, a = 0.5, n = 0;
  for (let o = 0; o < lats.length; o++) {
    s += a * grad(lats[o], periods[o], x * periods[o], y * periods[o]);
    n += a;
    a *= 0.5;
  }
  return Math.min(1, Math.max(0, 0.5 + (s / n) * 0.9));
}

/** channel base periods (lattice cells across the tile) */
const CHANNELS = [3, 6, 12, 24] as const;
const OCTAVES = 4;

export function* bakeTunnelNoise(size: number, seed: number): Generator<void, DataTexture, void> {
  const rng = new Rng(seed);
  const data = new Uint8Array(size * size * 4);
  const lat: Float32Array[][] = [], per: number[][] = [];
  for (let c = 0; c < 4; c++) {
    lat.push([]);
    per.push([]);
    for (let o = 0; o < OCTAVES; o++) {
      const p = CHANNELS[c] << o;
      per[c].push(p);
      lat[c].push(lattice(p, rng));
    }
  }
  yield;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size, i = (y * size + x) * 4;
      for (let c = 0; c < 4; c++) data[i + c] = Math.round(fbm(lat[c], per[c], u, v) * 255);
    }
    if ((y & 7) === 7) yield;
  }
  const tex = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}
