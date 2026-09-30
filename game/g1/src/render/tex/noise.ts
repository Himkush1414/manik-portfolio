// CPU value noise + fbm for texture bakes (seeded, allocation-free per call).
import { createRng } from '../../core/rng';

export class ValueNoise {
  private perm: Uint8Array;
  private vals: Float32Array;

  constructor(seed: number) {
    const rng = createRng(seed);
    this.perm = new Uint8Array(512);
    this.vals = new Float32Array(256);
    const p = Array.from({ length: 256 }, (_, i) => i);
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
    for (let i = 0; i < 256; i++) this.vals[i] = rng.next();
  }

  /** Tileable value noise in [0,1] with period `period` cells. */
  noise(x: number, y: number, period = 256): number {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const x0 = ((xi % period) + period) % period;
    const y0 = ((yi % period) + period) % period;
    const x1 = (x0 + 1) % period;
    const y1 = (y0 + 1) % period;
    const P = this.perm;
    const V = this.vals;
    const a = V[P[P[x0 & 255] + (y0 & 255)]];
    const b = V[P[P[x1 & 255] + (y0 & 255)]];
    const c = V[P[P[x0 & 255] + (y1 & 255)]];
    const d = V[P[P[x1 & 255] + (y1 & 255)]];
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  /** Tileable fbm over a unit square sampled at (u,v) ∈ [0,1). */
  fbm(u: number, v: number, baseCells: number, octaves: number, gain = 0.5): number {
    let sum = 0;
    let amp = 0.5;
    let norm = 0;
    let cells = baseCells;
    for (let o = 0; o < octaves; o++) {
      sum += amp * this.noise(u * cells, v * cells, cells);
      norm += amp;
      amp *= gain;
      cells *= 2;
    }
    return sum / norm;
  }
}
