// Geometry utilities shared by the ship builders.
import { BufferGeometry, Float32BufferAttribute, Matrix4 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Mirror across X (port copy) and fix winding. Works on (non-)indexed input. */
export function mirrorX(g: BufferGeometry): BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g.clone();
  out.applyMatrix4(new Matrix4().makeScale(-1, 1, 1));
  for (const name of Object.keys(out.attributes)) {
    const a = out.attributes[name];
    const arr = a.array as Float32Array;
    const n = a.itemSize;
    for (let t = 0; t < a.count; t += 3) {
      for (let k = 0; k < n; k++) {
        const i1 = (t + 1) * n + k, i2 = (t + 2) * n + k;
        const tmp = arr[i1];
        arr[i1] = arr[i2];
        arr[i2] = tmp;
      }
    }
    a.needsUpdate = true;
  }
  return out;
}

/** Non-indexed + flat (faceted) normals. */
export function facet(g: BufferGeometry): BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g;
  out.deleteAttribute('normal');
  out.computeVertexNormals();
  return out;
}

/** Ensure the attribute set every merged ship part must share. */
export function withAttrs(g: BufferGeometry, zone = 0): BufferGeometry {
  const n = g.attributes.position.count;
  if (!g.attributes.uv) g.setAttribute('uv', new Float32BufferAttribute(new Float32Array(n * 2), 2));
  if (!g.attributes.paintZone) g.setAttribute('paintZone', new Float32BufferAttribute(new Float32Array(n).fill(zone), 1));
  if (!g.attributes.normal) g.computeVertexNormals();
  return g;
}

/** Merge parts (converted to non-indexed with identical attribute sets). */
export function mergeParts(parts: BufferGeometry[], keep: string[] = ['position', 'normal', 'uv', 'paintZone']): BufferGeometry {
  const prepared = parts.map(p => {
    const q = p.index ? p.toNonIndexed() : p;
    for (const name of Object.keys(q.attributes)) if (!keep.includes(name)) q.deleteAttribute(name);
    return q;
  });
  const merged = mergeGeometries(prepared, false);
  if (!merged) throw new Error('mergeParts: attribute mismatch');
  return merged;
}
