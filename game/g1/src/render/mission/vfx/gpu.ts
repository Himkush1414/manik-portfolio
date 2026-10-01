// Small shared helpers for the mission VFX renderers: the presentation RNG
// (brief §3: VFX never draw from the sim streams) and allocation-free
// partial buffer uploads (three r169: attribute.updateRanges; the renderer
// merges + clears them after the upload, mutating the range objects in place,
// so each caller owns preallocated range objects it re-fills every frame).
import type { BufferAttribute, InstancedBufferAttribute } from 'three';
import { Rng } from '../../../game/core/rng';

/** the renderer's own random stream (sparks, flash timing, storm bolts) */
export const vfxRng = new Rng(0x7f4a7c15);

export type UploadRange = { start: number; count: number };

export function range(): UploadRange {
  return { start: 0, count: 0 };
}

/** queue [start, start + count) (in array elements) of `attr` for upload this frame */
export function queueRange(attr: BufferAttribute | InstancedBufferAttribute, r: UploadRange, start: number, count: number): void {
  if (count <= 0) return;
  r.start = start;
  r.count = count;
  attr.updateRanges.push(r);
  attr.needsUpdate = true;
}

/** uniform random in [a[0], a[1]) from the vfx stream */
export function pick(a: readonly [number, number]): number {
  return a[0] + (a[1] - a[0]) * vfxRng.next();
}
