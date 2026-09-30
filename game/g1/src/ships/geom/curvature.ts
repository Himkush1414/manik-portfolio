// Curvature wear for smooth indexed meshes (hull): 1 - min(dot(n, neighbour n)).
import { BufferGeometry, Float32BufferAttribute } from 'three';

export function curvatureWear(g: BufferGeometry, gain = 9): void {
  const idx = g.index!.array;
  const n = g.attributes.normal;
  const count = n.count;
  const minDot = new Float32Array(count).fill(1);
  const upd = (a: number, b: number) => {
    const d = n.getX(a) * n.getX(b) + n.getY(a) * n.getY(b) + n.getZ(a) * n.getZ(b);
    if (d < minDot[a]) minDot[a] = d;
    if (d < minDot[b]) minDot[b] = d;
  };
  for (let t = 0; t < idx.length; t += 3) {
    upd(idx[t], idx[t + 1]);
    upd(idx[t + 1], idx[t + 2]);
    upd(idx[t + 2], idx[t]);
  }
  const wear = new Float32Array(count);
  for (let i = 0; i < count; i++) wear[i] = Math.min(1, (1 - minDot[i]) * gain);
  g.setAttribute('aWear', new Float32BufferAttribute(wear, 1));
}
