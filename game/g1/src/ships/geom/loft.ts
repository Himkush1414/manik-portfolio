// Lofted hull: super-ellipse key rings (separate top/bottom heights, dorsal
// ridge, ventral keel) Catmull-Rom interpolated along z, with REAL panel
// grooves (circumferential + longitudinal insets) so specular lines break
// where panels meet. Closed at both ends (watertight, CSG-safe).
import { BufferGeometry, Float32BufferAttribute } from 'three';
import type { HullSpec, Ring } from '../types';

const catmull = (p0: number, p1: number, p2: number, p3: number, t: number) => {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
};

type R = Required<Pick<Ring, 'z' | 'w' | 'top' | 'bot' | 'n'>> & { y: number; ridge: number; ridgeW: number; keel: number };
const norm = (r: Ring): R => ({ z: r.z, w: r.w, top: r.top, bot: r.bot, n: r.n, y: r.y ?? 0, ridge: r.ridge ?? 0, ridgeW: r.ridgeW ?? 0.2, keel: r.keel ?? 0 });

/** Ring at any z (monotone-in-z key rings, Catmull-Rom per parameter). */
export function ringAt(rings: Ring[], z: number): R {
  const k = rings.map(norm);
  if (z <= k[0].z) return k[0];
  if (z >= k[k.length - 1].z) return k[k.length - 1];
  let i = 0;
  while (i < k.length - 2 && z > k[i + 1].z) i++;
  const a = k[Math.max(0, i - 1)], b = k[i], c = k[i + 1], d = k[Math.min(k.length - 1, i + 2)];
  const t = (z - b.z) / (c.z - b.z || 1);
  const f = (key: keyof R) => catmull(a[key], b[key], c[key], d[key], t);
  return { z, w: Math.max(0.001, f('w')), top: Math.max(0.001, f('top')), bot: Math.max(0.001, f('bot')), n: Math.max(1.2, f('n')), y: f('y'), ridge: Math.max(0, f('ridge')), ridgeW: Math.max(0.02, f('ridgeW')), keel: Math.max(0, f('keel')) };
}

/** Point on a ring at angle th (0 = +x, PI/2 = top). */
export function ringPoint(r: R, th: number): [number, number] {
  const c = Math.cos(th), s = Math.sin(th);
  const e = 2 / r.n;
  const x = r.w * Math.sign(c) * Math.pow(Math.abs(c), e);
  const up = s >= 0;
  let y = (up ? r.top : r.bot) * Math.sign(s) * Math.pow(Math.abs(s), e);
  if (up && r.ridge > 0) y += r.ridge * Math.exp(-((x / r.ridgeW) ** 2)) * Math.pow(Math.abs(s), 0.5);
  if (!up && r.keel > 0) y -= r.keel * Math.exp(-((x / (r.w * 0.35)) ** 2)) * Math.pow(Math.abs(s), 0.5);
  return [x, y + r.y];
}

const GROOVE_DEPTH = 0.014;
const GROOVE_HALF = 0.022;

export function loftHull(spec: HullSpec): BufferGeometry {
  const rings = spec.rings;
  const z0 = rings[0].z, z1 = rings[rings.length - 1].z;
  // stations: uniform + a (before, centre, after) triplet around every groove
  const zs = new Set<number>();
  for (let i = 0; i <= spec.stations; i++) zs.add(z0 + ((z1 - z0) * i) / spec.stations);
  for (const g of spec.grooves ?? []) [g - GROOVE_HALF, g, g + GROOVE_HALF].forEach(v => zs.add(v));
  const zList = Array.from(zs).filter(z => z >= z0 && z <= z1).sort((a, b) => a - b);
  // angles: uniform + triplets around each longitudinal seam
  const th = new Set<number>();
  for (let i = 0; i < spec.radial; i++) th.add((i / spec.radial) * Math.PI * 2);
  for (const sAng of spec.seams ?? []) [sAng - 0.012, sAng, sAng + 0.012].forEach(a => th.add(((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)));
  // Ridge / keel sampling: a boxy super-ellipse crowds its top into very few
  // angles (x jumps ~0.7 u between neighbours), so a narrow ridge would
  // interpolate into a wide tent. Add angles placed by x across the ridge.
  const byRidge = rings.map(r => ringAt(rings, r.z)).reduce((a, b) => (b.ridge > a.ridge ? b : a));
  if (byRidge.ridge > 0) {
    for (let j = 1; j <= 12; j++) {
      const x = byRidge.ridgeW * 3.2 * (j / 12);
      const c = Math.pow(Math.min(0.999, x / byRidge.w), byRidge.n / 2);
      const a = Math.acos(c);
      th.add(a);
      th.add(Math.PI - a);
    }
  }
  const byKeel = rings.map(r => ringAt(rings, r.z)).reduce((a, b) => (b.keel > a.keel ? b : a));
  if (byKeel.keel > 0) {
    for (let j = 1; j <= 8; j++) {
      const x = byKeel.w * 0.35 * 2.6 * (j / 8);
      const c = Math.pow(Math.min(0.999, x / byKeel.w), byKeel.n / 2);
      const a = Math.acos(c);
      th.add(Math.PI + a);
      th.add(2 * Math.PI - a);
    }
  }
  const thList = Array.from(th).sort((a, b) => a - b);
  const M = thList.length;
  const grooveZ = new Set(spec.grooves ?? []);
  const seamSet = new Set((spec.seams ?? []).map(a => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)));

  const pos: number[] = [], uv: number[] = [], zone: number[] = [];
  for (let si = 0; si < zList.length; si++) {
    const z = zList[si];
    const r = ringAt(rings, z);
    const inGroove = grooveZ.has(z);
    for (let k = 0; k < M; k++) {
      const a = thList[k];
      let [x, y] = ringPoint(r, a);
      const seam = seamSet.has(a);
      if (inGroove || seam) {
        // inset toward the ring centre along the local radius
        const cy = r.y;
        const dx = x, dy = y - cy;
        const len = Math.hypot(dx, dy) || 1;
        x -= (dx / len) * GROOVE_DEPTH;
        y -= (dy / len) * GROOVE_DEPTH;
      }
      pos.push(x, y, z);
      const u = a / (Math.PI * 2), v = (z - z0) / (z1 - z0);
      uv.push(u, v);
      zone.push(spec.zone({ x, y, z, u, v }));
    }
  }
  const idx: number[] = [];
  const S = zList.length;
  for (let si = 0; si < S - 1; si++) {
    for (let k = 0; k < M; k++) {
      const a = si * M + k, b = si * M + ((k + 1) % M), c = (si + 1) * M + k, d = (si + 1) * M + ((k + 1) % M);
      // outward winding: (b - a) × (c - a) = θ̂ × ẑ points away from the axis
      idx.push(a, b, c, b, d, c);
    }
  }
  // caps: tail plate (z min, faces -z) + nose tip (z max, faces +z)
  const addCap = (si: number, facesPlusZ: boolean) => {
    const r = ringAt(rings, zList[si]);
    const ci = pos.length / 3;
    pos.push(0, r.y, zList[si]);
    uv.push(0.5, si === 0 ? 0 : 1);
    zone.push(spec.zone({ x: 0, y: r.y, z: zList[si], u: 0.5, v: si === 0 ? 0 : 1 }));
    for (let k = 0; k < M; k++) {
      const a = si * M + k, b = si * M + ((k + 1) % M);
      if (facesPlusZ) idx.push(ci, a, b);
      else idx.push(ci, b, a);
    }
  };
  addCap(0, false);
  addCap(S - 1, true);

  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setAttribute('paintZone', new Float32BufferAttribute(zone, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
