// Seeded RNG streams for the sim (brief §3). Gameplay draws ONLY from these;
// the renderer owns a separate vfx stream so visual effects can never perturb
// gameplay. Same seed + same input script = identical run (unit-tested).
// mulberry32 with exposed state so a stream can be snapshotted / restored.

export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0 || 0x9e3779b9;
  }
  /** [0, 1) */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }
  int(min: number, maxInclusive: number): number {
    return min + Math.floor(this.next() * (maxInclusive - min + 1));
  }
  sign(): 1 | -1 {
    return this.next() < 0.5 ? -1 : 1;
  }
  get state(): number {
    return this.s;
  }
  set state(v: number) {
    this.s = v >>> 0;
  }
}

/** Independent per-purpose streams derived from one level seed. */
export type RngStreams = { sim: Rng; ai: Rng; spawn: Rng };

const MIX = [0x85ebca6b, 0xc2b2ae35, 0x27d4eb2f] as const;

function derive(seed: number, k: number): number {
  let h = (seed ^ MIX[k]) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return (h ^ (h >>> 16)) >>> 0;
}

export function createStreams(seed: number): RngStreams {
  return { sim: new Rng(derive(seed, 0)), ai: new Rng(derive(seed, 1)), spawn: new Rng(derive(seed, 2)) };
}
