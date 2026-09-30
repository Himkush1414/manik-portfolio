// Hangar bay architecture (brief §11 BAY, ~60 x 34 x 22). Built once, merged
// per material (a handful of draw calls; the floor reflection renders the bay
// a second time, so every call counts). Box-projected world-space UVs at 1
// repeat / 4 m keep the gunmetal texel density constant.
//   x: +-17 side walls   y: 0 floor .. 22 ceiling   z: -24 (space end) .. 38 (door wall)
import { BoxGeometry, BufferGeometry, CatmullRomCurve3, CylinderGeometry, Float32BufferAttribute, Matrix4, Quaternion, TubeGeometry, Vector3, Euler } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createRng } from '../../../core/rng';

export const BAY = { x: 17, y: 22, zBack: -24, zFront: 38, ribStep: 6.2, catwalkY: 7, opening: { x: 13, y0: 1.6, y1: 18.6 } } as const;

export type BayGeometry = {
  steel: BufferGeometry; // painted gunmetal structure
  bare: BufferGeometry; // bare metal: rails, pipes, flanges
  dark: BufferGeometry; // cables, grating, rubber
  glowCool: BufferGeometry; // Frost/Ice light strips
  glowWarm: BufferGeometry; // ceiling fixtures (shaft sources)
  ribZ: number[];
};

type Parts = BufferGeometry[];

function box(parts: Parts, w: number, h: number, d: number, x: number, y: number, z: number, rot?: [number, number, number]) {
  const g = new BoxGeometry(w, h, d);
  if (rot) g.applyMatrix4(new Matrix4().makeRotationFromEuler(new Euler(...rot)));
  g.translate(x, y, z);
  parts.push(g);
}

function cyl(parts: Parts, r: number, len: number, from: Vector3, dir: Vector3, seg = 12) {
  const g = new CylinderGeometry(r, r, len, seg, 1, false);
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir.clone().normalize());
  g.applyMatrix4(new Matrix4().compose(from.clone().addScaledVector(dir.clone().normalize(), len / 2), q, new Vector3(1, 1, 1)));
  parts.push(g);
}

/** Box projection by dominant normal axis (world units / scale). */
function boxUV(g: BufferGeometry, scale: number): BufferGeometry {
  const p = g.attributes.position, n = g.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const [u, v] = ax >= ay && ax >= az ? [z, y] : ay >= az ? [x, z] : [x, y];
    uv[i * 2] = u / scale;
    uv[i * 2 + 1] = v / scale;
  }
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  return g;
}

function merge(parts: Parts, uvScale = 4): BufferGeometry {
  const prepared = parts.map(g => {
    const q = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(q.attributes)) if (k !== 'position' && k !== 'normal') q.deleteAttribute(k);
    return q;
  });
  const m = mergeGeometries(prepared, false)!;
  parts.forEach(g => g.dispose());
  return boxUV(m, uvScale);
}

export function buildBayGeometry(): BayGeometry {
  const steel: Parts = [], bare: Parts = [], dark: Parts = [], cool: Parts = [], warm: Parts = [];
  const rng = createRng(4207);
  const { x: X, y: Y, zBack: Z0, zFront: Z1, catwalkY: CY } = BAY;
  const ribZ: number[] = [];
  for (let z = Z0 + 2.4; z < Z1 - 2; z += BAY.ribStep) ribZ.push(z);

  for (const s of [-1, 1]) {
    // wall plates between ribs: 3 rows, varied inset
    const edges = [Z0, ...ribZ, Z1];
    for (let i = 0; i < edges.length - 1; i++) {
      const za = edges[i] + 0.5, zb = edges[i + 1] - 0.5;
      const rows: [number, number][] = [[0, CY - 0.2], [CY + 0.2, 14.6], [14.8, Y]];
      for (const [y0, y1] of rows) {
        const inset = rng.range(0, 0.18);
        box(steel, 0.3, y1 - y0 - 0.14, zb - za - 0.14, s * (X + 0.15 + inset), (y0 + y1) / 2, (za + zb) / 2);
      }
      // lower vent grille (slats) in every other bay
      if (i % 2 === 0) {
        const zc = (za + zb) / 2;
        for (let k = 0; k < 9; k++) box(dark, 0.08, 0.1, 2.6, s * (X - 0.02), 1.1 + k * 0.22, zc, [0.5 * s, 0, 0]);
        box(steel, 0.18, 0.14, 2.9, s * (X - 0.06), 0.95, zc);
        box(steel, 0.18, 0.14, 2.9, s * (X - 0.06), 3.05, zc);
      }
    }
    // ribs: column + inner flange + ceiling knee
    for (const z of ribZ) {
      box(steel, 1.4, Y, 0.9, s * (X - 0.7), Y / 2, z);
      box(steel, 0.25, Y - 1, 1.3, s * (X - 1.45), (Y - 1) / 2, z);
      box(steel, 3.6, 0.8, 0.8, s * (X - 2.4), Y - 1.9, z, [0, 0, s * 0.62]);
      // ceiling truss across the bay: top + bottom chords + diagonals
      if (s === 1) {
        box(steel, 2 * X, 0.7, 0.8, 0, Y - 0.35, z);
        box(steel, 2 * X - 4, 0.45, 0.6, 0, Y - 2.6, z);
        for (let k = -6; k < 6; k++) {
          const x0 = k * 2.6 + 1.3;
          box(bare, 0.18, 2.6, 0.18, x0, Y - 1.45, z, [0, 0, (k % 2 ? 1 : -1) * 0.78]);
        }
      }
    }
    // catwalk: deck, grating, toe board, rails + posts, brackets
    const cw = 2.6, cx = s * (X - cw / 2);
    box(steel, cw, 0.18, Z1 - Z0 - 1, cx, CY, (Z0 + Z1) / 2);
    box(dark, cw - 0.3, 0.04, Z1 - Z0 - 1.4, cx, CY + 0.11, (Z0 + Z1) / 2);
    box(steel, 0.05, 0.22, Z1 - Z0 - 1, s * (X - cw), CY + 0.2, (Z0 + Z1) / 2);
    const railX = s * (X - cw + 0.06);
    cyl(bare, 0.045, Z1 - Z0 - 1, new Vector3(railX, CY + 1.1, Z0 + 0.5), new Vector3(0, 0, 1), 8);
    cyl(bare, 0.03, Z1 - Z0 - 1, new Vector3(railX, CY + 0.6, Z0 + 0.5), new Vector3(0, 0, 1), 8);
    for (let z = Z0 + 1; z < Z1 - 0.5; z += 2) box(bare, 0.06, 1.1, 0.06, railX, CY + 0.55, z);
    for (const z of ribZ) box(steel, 0.2, 2.2, 0.3, s * (X - 1.6), CY - 1.0, z, [0, 0, s * -0.75]);
    // under-catwalk cool light strip
    box(cool, 0.08, 0.05, Z1 - Z0 - 2, s * (X - cw + 0.3), CY - 0.12, (Z0 + Z1) / 2);
    // pipe runs with flanges; a few vertical drops at ribs
    for (const [py, pr] of [[2.4, 0.2], [3.0, 0.13], [12.2, 0.16]] as const) {
      cyl(bare, pr, Z1 - Z0 - 1, new Vector3(s * (X - 0.55), py, Z0 + 0.5), new Vector3(0, 0, 1), 14);
      for (const z of ribZ) cyl(bare, pr * 1.45, 0.16, new Vector3(s * (X - 0.55), py, z + 0.55), new Vector3(0, 0, 1), 14);
    }
    for (const z of ribZ.filter((_, i) => i % 3 === 1)) cyl(bare, 0.15, Y - 3.4, new Vector3(s * (X - 1.9), 0, z + 0.9), new Vector3(0, 1, 0), 12);
    // cable bundles sagging between ribs (upper wall)
    for (let i = 0; i < ribZ.length - 1; i++) {
      for (let k = 0; k < 3; k++) {
        const y = 16.2 + k * 0.22, sag = 0.7 + k * 0.18 + rng.range(0, 0.2);
        const a = new Vector3(s * (X - 0.9 - k * 0.12), y, ribZ[i] + 0.5), b = new Vector3(s * (X - 0.9 - k * 0.12), y, ribZ[i + 1] - 0.5);
        const mid = a.clone().lerp(b, 0.5).add(new Vector3(0, -sag, 0));
        const curve = new CatmullRomCurve3([a, a.clone().lerp(mid, 0.5).add(new Vector3(0, -sag * 0.25, 0)), mid, b.clone().lerp(mid, 0.5).add(new Vector3(0, -sag * 0.25, 0)), b]);
        dark.push(new TubeGeometry(curve, 16, 0.05 + k * 0.015, 6, false));
      }
    }
    // crane rails (I-beams) under the ceiling
    box(steel, 0.9, 0.2, Z1 - Z0 - 2, s * 11, 19.9, (Z0 + Z1) / 2);
    box(steel, 0.18, 0.8, Z1 - Z0 - 2, s * 11, 20.4, (Z0 + Z1) / 2);
    box(steel, 0.9, 0.2, Z1 - Z0 - 2, s * 11, 20.9, (Z0 + Z1) / 2);
  }

  // ceiling plates + warm fixtures (four over the pad feed the light shafts)
  box(steel, 2 * X, 0.3, Z1 - Z0, 0, Y + 0.15, (Z0 + Z1) / 2);
  for (const [fx, fz] of [[-5.5, -3], [5.5, -3], [-5.5, 5], [5.5, 5]]) {
    box(steel, 3.2, 0.5, 1.6, fx, Y - 0.25, fz);
    box(warm, 2.8, 0.06, 1.2, fx, Y - 0.52, fz);
  }

  // back wall (space end) with the force-field opening
  const O = BAY.opening;
  box(steel, X - O.x, Y, 1.2, -(O.x + X) / 2, Y / 2, Z0 - 0.6);
  box(steel, X - O.x, Y, 1.2, (O.x + X) / 2, Y / 2, Z0 - 0.6);
  box(steel, 2 * O.x, Y - O.y1, 1.2, 0, (Y + O.y1) / 2, Z0 - 0.6);
  box(steel, 2 * O.x, O.y0, 1.6, 0, O.y0 / 2, Z0 - 0.4);
  // opening frame: chunky bevelled jambs + emitter strips
  for (const s of [-1, 1]) {
    box(steel, 0.9, O.y1 - O.y0 + 1.2, 2.2, s * (O.x + 0.2), (O.y0 + O.y1) / 2, Z0 - 0.3);
    box(cool, 0.08, O.y1 - O.y0 - 0.4, 0.1, s * (O.x - 0.28), (O.y0 + O.y1) / 2, Z0 + 0.6);
  }
  box(steel, 2 * O.x + 1.8, 0.9, 2.2, 0, O.y1 + 0.2, Z0 - 0.3);
  box(cool, 2 * O.x - 0.6, 0.08, 0.1, 0, O.y1 - 0.28, Z0 + 0.6);
  box(cool, 2 * O.x - 0.6, 0.08, 0.1, 0, O.y0 + 0.12, Z0 + 0.6);

  // door wall above the blast-door frame (frame top 16.5) and its sides
  box(steel, 2 * X, Y - 16.3, 1.2, 0, (Y + 16.3) / 2, Z1 + 0.9);

  return {
    steel: merge(steel),
    bare: merge(bare, 2),
    dark: merge(dark, 2),
    glowCool: merge(cool),
    glowWarm: merge(warm),
    ribZ,
  };
}
