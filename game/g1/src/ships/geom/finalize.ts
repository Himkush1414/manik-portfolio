// Bakes per-vertex wear (edge/curvature) and engine soot into attributes the
// hull paint shader reads (brief §10: "curvature-based edge wear + engine soot
// from baked vertex colours"). Runs in the bake worker.
import { BufferGeometry, Float32BufferAttribute } from 'three';
import type { EngineSpec } from '../types';

/**
 * Edge wear from normal disagreement between vertices sharing a position.
 * Numeric spatial hash (quantised position -> bucket) instead of string keys:
 * ~20x faster on 100k+ vertices.
 */
export function bakeWear(g: BufferGeometry, gain = 1.6): void {
  const p = g.attributes.position.array as Float32Array;
  const n = g.attributes.normal.array as Float32Array;
  const count = p.length / 3;
  const Q = 400;
  const buckets = new Map<number, number[]>();
  const qx = new Int32Array(count), qy = new Int32Array(count), qz = new Int32Array(count);
  for (let i = 0; i < count; i++) {
    const x = Math.round(p[i * 3] * Q), y = Math.round(p[i * 3 + 1] * Q), z = Math.round(p[i * 3 + 2] * Q);
    qx[i] = x;
    qy[i] = y;
    qz[i] = z;
    const h = ((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) | 0;
    const arr = buckets.get(h);
    if (arr) arr.push(i);
    else buckets.set(h, [i]);
  }
  const wear = new Float32Array(count);
  for (const idx of buckets.values()) {
    if (idx.length < 2) continue;
    for (let a = 0; a < idx.length; a++) {
      const i = idx[a];
      let minDot = 1;
      for (let b = 0; b < idx.length; b++) {
        const j = idx[b];
        if (i === j || qx[i] !== qx[j] || qy[i] !== qy[j] || qz[i] !== qz[j]) continue; // hash collision guard
        const d = n[i * 3] * n[j * 3] + n[i * 3 + 1] * n[j * 3 + 1] + n[i * 3 + 2] * n[j * 3 + 2];
        if (d < minDot) minDot = d;
      }
      wear[i] = Math.min(1, (1 - minDot) * gain);
    }
  }
  g.setAttribute('aWear', new Float32BufferAttribute(wear, 1));
}

/** Soot: darkening near and behind each engine exit. */
export function bakeSoot(g: BufferGeometry, engines: EngineSpec[]): void {
  const p = g.attributes.position.array as Float32Array;
  const count = p.length / 3;
  const soot = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    let s = 0;
    for (const e of engines) {
      const dx = p[i * 3] - e.pos[0], dy = p[i * 3 + 1] - e.pos[1], dz = p[i * 3 + 2] - e.pos[2];
      const d = Math.hypot(dx, dy, dz * 0.6);
      s = Math.max(s, Math.max(0, 1 - d / (e.radius * 3.2)) * (dz < e.radius * 2 ? 1 : 0.3));
    }
    soot[i] = s * s;
  }
  g.setAttribute('aSoot', new Float32BufferAttribute(soot, 1));
}
