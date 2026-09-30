// Seeded RNG (mulberry32) — deterministic procedural content and QA (?seed=n).

export type Rng = {
  next(): number; // [0,1)
  range(min: number, max: number): number;
  int(min: number, maxInclusive: number): number;
  pick<T>(items: readonly T[]): T;
  sign(): 1 | -1;
};

export function createRng(seed: number): Rng {
  let s = seed >>> 0 || 0x9e3779b9;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min, max) => min + (max - min) * next(),
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: items => items[Math.floor(next() * items.length)],
    sign: () => (next() < 0.5 ? -1 : 1),
  };
}

/** Stable 32-bit hash of a string (seed derivation for named content). */
export function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
