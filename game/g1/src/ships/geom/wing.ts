// Faceted wing / canard / fin generator. Hard-surface profile (chamfered
// facets, not a smooth airfoil) so panels catch clean specular lines;
// optional control-surface split groove, chordwise "petal" fold grooves,
// trailing-edge cut-outs. Horizontal: span along x, chord along -z from the
// leading edge, thickness along y. Vertical (fins): thickness along x.
import { BufferGeometry, Float32BufferAttribute } from 'three';
import type { WingSpec } from '../types';
import { facet, mirrorX, mergeParts } from './util';

type P2 = [number, number]; // [chord fraction, half-thickness fraction]

function profile(flap: number): P2[] {
  const pts: P2[] = [[0, 0], [0.05, 0.42], [0.26, 1], [0.66, 0.74], [1, 0.07]];
  if (flap > 0) {
    // control-surface split: a thin notch in the upper skin at `flap`
    const h = 0.74 + (1 - (flap - 0.66) / 0.34) * 0; // near-flat region
    pts.splice(4, 0, [flap - 0.012, h * 0.98], [flap, h * 0.8], [flap + 0.012, h * 0.95]);
  }
  return pts;
}

const smoothBox = (x: number, a: number, b: number, e = 0.04) => {
  const s = (v: number) => Math.min(1, Math.max(0, v));
  const up = s((x - (a - e)) / (2 * e));
  const dn = s(((b + e) - x) / (2 * e));
  return Math.min(up, dn);
};

export function buildWing(spec: WingSpec): BufferGeometry {
  const prof = profile(spec.flapLine ?? 0);
  const lowerScale = 0.78;
  const S = spec.stations ?? 10;
  // span stations, with a groove triplet around each fold line
  const ss = new Set<number>();
  for (let i = 0; i <= S; i++) ss.add(i / S);
  for (const f of spec.foldLines ?? []) [f - 0.012, f, f + 0.012].forEach(v => v > 0 && v < 1 && ss.add(v));
  const spans = Array.from(ss).sort((a, b) => a - b);
  const folds = new Set(spec.foldLines ?? []);

  const loop: P2[] = [...prof.map(([f, h]) => [f, h] as P2), ...prof.slice(1, -1).reverse().map(([f, h]) => [f, -h * lowerScale] as P2)];
  const L = loop.length;
  const pos: number[] = [], uv: number[] = [], zone: number[] = [];
  for (const s of spans) {
    const le = spec.root.map((r, i) => r + (spec.tip[i] - r) * s) as [number, number, number];
    let chord = spec.rootChord + (spec.tipChord - spec.rootChord) * s;
    const cut = spec.cutout ? spec.cutout.depth * smoothBox(s, spec.cutout.from, spec.cutout.to) : 0;
    const thick = spec.thickness * (folds.has(s) ? 0.9 : 1) * (1 - s * 0.35);
    for (const [f, h] of loop) {
      const ff = f * (1 - cut); // cut-out shortens the chord from the trailing edge
      const along = ff * chord;
      const t = h * thick * spec.rootChord * (0.65 + 0.35 * (chord / spec.rootChord));
      let x: number, y: number;
      const z = le[2] - along;
      if (spec.vertical) {
        x = le[0] + t;
        y = le[1];
      } else {
        x = le[0];
        y = le[1] + t;
      }
      pos.push(x, y, z);
      uv.push(f, s);
      zone.push(spec.zone({ x, y, z, u: f, v: s }));
    }
    chord += 0; // (kept for clarity: chord is per-station)
  }
  const idx: number[] = [];
  const N = spans.length;
  for (let si = 0; si < N - 1; si++) {
    for (let k = 0; k < L; k++) {
      const a = si * L + k, b = si * L + ((k + 1) % L), c = (si + 1) * L + k, d = (si + 1) * L + ((k + 1) % L);
      idx.push(a, c, b, b, c, d);
    }
  }
  // root + tip caps (fan from the loop centroid)
  const cap = (si: number, flip: boolean) => {
    let cx = 0, cy = 0, cz = 0;
    for (let k = 0; k < L; k++) {
      cx += pos[(si * L + k) * 3];
      cy += pos[(si * L + k) * 3 + 1];
      cz += pos[(si * L + k) * 3 + 2];
    }
    const ci = pos.length / 3;
    pos.push(cx / L, cy / L, cz / L);
    uv.push(0.5, si === 0 ? 0 : 1);
    zone.push(zone[si * L]);
    for (let k = 0; k < L; k++) {
      const a = si * L + k, b = si * L + ((k + 1) % L);
      if (flip) idx.push(ci, b, a);
      else idx.push(ci, a, b);
    }
  };
  cap(0, false);
  cap(N - 1, true);

  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setAttribute('paintZone', new Float32BufferAttribute(zone, 1));
  g.setIndex(idx);
  let out = facet(g);
  // winding sanity: the loop runs LE->upper->TE->lower, spans run root->tip;
  // if the average normal of the upper skin points down, flip everything
  out = orientOutward(out, spec.vertical ? 0 : 1);
  if (spec.mirror) {
    const m = mirrorX(out);
    return mergeParts([out, m]);
  }
  return out;
}

/** Flip winding if the thickness-axis normals point inward (robust to spec direction). */
function orientOutward(g: BufferGeometry, axis: 0 | 1): BufferGeometry {
  const p = g.attributes.position, n = g.attributes.normal;
  // centroid along the thickness axis
  let c = 0;
  for (let i = 0; i < p.count; i++) c += p.getComponent(i, axis);
  c /= p.count;
  let score = 0;
  for (let i = 0; i < p.count; i++) score += (p.getComponent(i, axis) - c) * n.getComponent(i, axis);
  if (score >= 0) return g;
  const arrs = Object.values(g.attributes);
  for (const a of arrs) {
    const arr = a.array as Float32Array;
    const k = a.itemSize;
    for (let t = 0; t < a.count; t += 3) {
      for (let j = 0; j < k; j++) {
        const i1 = (t + 1) * k + j, i2 = (t + 2) * k + j;
        const tmp = arr[i1];
        arr[i1] = arr[i2];
        arr[i2] = tmp;
      }
    }
    a.needsUpdate = true;
  }
  g.deleteAttribute('normal');
  g.computeVertexNormals();
  return g;
}
