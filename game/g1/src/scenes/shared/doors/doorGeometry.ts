// Procedural blast-door geometry (brief §9). All real geometry: extruded
// panels with bevels and interlocking chevron teeth, raised armour plates,
// instanced rivets, frame with wall pockets, guide rails with rack teeth,
// hydraulic pistons. Built once (during boot), merged per material.
import {
  Shape,
  ExtrudeGeometry,
  BufferGeometry,
  CylinderGeometry,
  SphereGeometry,
  BoxGeometry,
  Matrix4,
  Vector3,
  Quaternion,
  Euler,
  Float32BufferAttribute,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { DOOR } from './doorSpec';

/** Non-indexed copy (or the same geometry if it already is — ExtrudeGeometry is). */
function flat(g: BufferGeometry): BufferGeometry {
  return g.index ? g.toNonIndexed() : g;
}

/** Mirror a non-indexed geometry across X, fixing winding. */
export function mirrorX(g: BufferGeometry): BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g.clone();
  out.applyMatrix4(new Matrix4().makeScale(-1, 1, 1));
  for (const name of Object.keys(out.attributes)) {
    const a = out.attributes[name];
    const arr = a.array as Float32Array;
    const n = a.itemSize;
    for (let t = 0; t < a.count; t += 3) {
      for (let k = 0; k < n; k++) {
        const i1 = (t + 1) * n + k;
        const i2 = (t + 2) * n + k;
        const tmp = arr[i1];
        arr[i1] = arr[i2];
        arr[i2] = tmp;
      }
    }
    a.needsUpdate = true;
  }
  return out;
}

/** Planar UVs from world-ish XY (1 unit = 1/`scale` of texture) for every vertex. */
function planarUV(g: BufferGeometry, scale: number, ox = 0, oy = 0): void {
  const pos = g.attributes.position;
  const nrm = g.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const ax = Math.abs(nrm.getX(i)), ay = Math.abs(nrm.getY(i));
    // box-project: side faces use z along their length so textures don't smear
    if (ax > 0.7) { uv[i * 2] = (z + oy) / scale; uv[i * 2 + 1] = (y + oy) / scale; }
    else if (ay > 0.7) { uv[i * 2] = (x + ox) / scale; uv[i * 2 + 1] = (z + oy) / scale; }
    else { uv[i * 2] = (x + ox) / scale; uv[i * 2 + 1] = (y + oy) / scale; }
  }
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
}

/**
 * Panel outline. The leading edge (x = seam) runs top -> bottom as half-pitch
 * segments alternating an outward tooth (into the other panel's side) and an
 * inward notch. The right panel starts with a tooth, the left (built the same
 * way, then mirrored) starts with a notch, so every tooth meets a notch.
 */
function panelShape(startWithTooth: boolean): Shape {
  const { W, H, seamGap: s, toothPitch: p, toothDepth: td } = DOOR;
  const c = 0.14; // outer corner chamfer
  const half = p / 2;
  const shape = new Shape();
  shape.moveTo(s, 0);
  shape.lineTo(W - c, 0);
  shape.lineTo(W, c);
  shape.lineTo(W, H - c);
  shape.lineTo(W - c, H);
  shape.lineTo(s, H);
  const segments = Math.floor(H / half);
  const margin = (H - segments * half) / 2;
  if (margin > 0) shape.lineTo(s, H - margin);
  let tooth = startWithTooth;
  for (let k = 0; k < segments; k++) {
    const top = H - margin - k * half;
    shape.lineTo(tooth ? s - td : s + td, top - half / 2);
    shape.lineTo(s, top - half);
    tooth = !tooth;
  }
  shape.lineTo(s, 0);
  return shape;
}

export type PanelGeometries = {
  body: BufferGeometry; // painted armour
  plates: BufferGeometry;
  rivets: Matrix4[]; // instance transforms (panel local)
  ledStrip: BufferGeometry; // emissive edge strips
};

function buildPanel(startWithTooth: boolean): PanelGeometries {
  const { D, bevel } = DOOR;
  const body = new ExtrudeGeometry(panelShape(startWithTooth), {
    depth: D,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 1,
  });
  body.translate(0, 0, -D / 2);
  body.computeVertexNormals();
  planarUV(body, 12);

  const P = DOOR.plates;
  const pw = (P.x1 - P.x0 - (P.cols - 1) * P.gap) / P.cols;
  const ph = (P.y1 - P.y0 - (P.rows - 1) * P.gap) / P.rows;
  const plateGeos: BufferGeometry[] = [];
  const rivets: Matrix4[] = [];
  const zFace = D / 2 + bevel;
  const q = new Quaternion().setFromEuler(new Euler(Math.PI / 2, 0, 0));
  const scl = new Vector3(1, 1, 1);
  for (let r = 0; r < P.rows; r++) {
    for (let c = 0; c < P.cols; c++) {
      const x = P.x0 + c * (pw + P.gap);
      const y = P.y0 + r * (ph + P.gap);
      const ch = 0.1;
      const sh = new Shape();
      sh.moveTo(x + ch, y);
      sh.lineTo(x + pw - ch, y);
      sh.lineTo(x + pw, y + ch);
      sh.lineTo(x + pw, y + ph - ch);
      sh.lineTo(x + pw - ch, y + ph);
      sh.lineTo(x + ch, y + ph);
      sh.lineTo(x, y + ph - ch);
      sh.lineTo(x, y + ch);
      sh.closePath();
      const g = new ExtrudeGeometry(sh, { depth: P.depth, bevelEnabled: true, bevelThickness: P.bevel, bevelSize: P.bevel, bevelSegments: 2 });
      g.translate(0, 0, zFace);
      g.computeVertexNormals();
      plateGeos.push(g);
      // rivets around the plate perimeter
      const R = DOOR.rivet;
      const edges: [number, number, number, number][] = [
        [x + R.inset, y + R.inset, x + pw - R.inset, y + R.inset],
        [x + pw - R.inset, y + R.inset, x + pw - R.inset, y + ph - R.inset],
        [x + pw - R.inset, y + ph - R.inset, x + R.inset, y + ph - R.inset],
        [x + R.inset, y + ph - R.inset, x + R.inset, y + R.inset],
      ];
      for (const [ax, ay, bx, by] of edges) {
        const len = Math.hypot(bx - ax, by - ay);
        const count = Math.max(2, Math.round(len / R.spacing));
        for (let k = 0; k < count; k++) {
          const t = k / count;
          const m = new Matrix4().compose(new Vector3(ax + (bx - ax) * t, ay + (by - ay) * t, zFace + P.depth + P.bevel), q, scl);
          rivets.push(m);
        }
      }
    }
  }
  const plates = mergeGeometries(plateGeos.map(flat))!;
  planarUV(plates, 12, 0.37, 0.21);
  plateGeos.forEach(g => g.dispose());

  // LED strips: top edge + a vertical run just outside the hazard band
  const strips = [
    new BoxGeometry(DOOR.W - 0.8, 0.07, 0.05).translate(DOOR.W / 2 + 0.2, DOOR.H - 0.28, zFace + 0.03),
    new BoxGeometry(0.06, DOOR.H - 1.2, 0.05).translate(DOOR.hazard.x1 + 0.1, DOOR.H / 2, zFace + 0.03),
  ];
  const ledStrip = mergeGeometries(strips)!;
  strips.forEach(g => g.dispose());

  return { body: flat(body), plates, rivets, ledStrip };
}

export type DoorGeometrySet = {
  right: PanelGeometries;
  left: PanelGeometries; // pre-mirrored: place at -x without negative scale
  rivet: BufferGeometry;
  frame: BufferGeometry;
  frameTrim: BufferGeometry; // brushed-steel lips / rails / rack
  pistonSleeve: BufferGeometry; // unit length along +x
  pistonRod: BufferGeometry; // unit length along +x
  dispose(): void;
};

function buildFrame(): { frame: BufferGeometry; trim: BufferGeometry } {
  const F = DOOR.frame;
  const outer = new Shape();
  outer.moveTo(-F.outerX, F.bottom);
  outer.lineTo(F.outerX, F.bottom);
  outer.lineTo(F.outerX, F.top);
  outer.lineTo(-F.outerX, F.top);
  outer.closePath();
  const hole = new Shape();
  const c = 0.6;
  hole.moveTo(-F.holeX, -0.02);
  hole.lineTo(F.holeX, -0.02);
  hole.lineTo(F.holeX, F.holeTop - c);
  hole.lineTo(F.holeX - c, F.holeTop);
  hole.lineTo(-F.holeX + c, F.holeTop);
  hole.lineTo(-F.holeX, F.holeTop - c);
  hole.closePath();
  outer.holes.push(hole);
  const face = new ExtrudeGeometry(outer, { depth: F.depth, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2, curveSegments: 1 });
  face.computeVertexNormals();

  // pilasters + lintel: bevelled blocks proud of the frame face
  const blocks: BufferGeometry[] = [flat(face)];
  const block = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const s = new Shape();
    const k = 0.18;
    s.moveTo(-w / 2 + k, -h / 2);
    s.lineTo(w / 2 - k, -h / 2);
    s.lineTo(w / 2, -h / 2 + k);
    s.lineTo(w / 2, h / 2 - k);
    s.lineTo(w / 2 - k, h / 2);
    s.lineTo(-w / 2 + k, h / 2);
    s.lineTo(-w / 2, h / 2 - k);
    s.lineTo(-w / 2, -h / 2 + k);
    s.closePath();
    const g = new ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2 });
    g.translate(x, y, z);
    g.computeVertexNormals();
    blocks.push(flat(g));
  };
  for (const sx of [-1, 1]) {
    block(2.2, F.top - F.bottom - 1.2, 0.7, sx * (F.holeX + 1.35), (F.top + F.bottom) / 2, F.depth);
    block(1.1, 5.2, 0.5, sx * (F.holeX + 3.4), 4.2, F.depth);
    block(1.1, 5.2, 0.5, sx * (F.holeX + 3.4), 10.2, F.depth);
  }
  block(2 * F.holeX + 4.2, 1.5, 0.6, 0, F.holeTop + 1.15, F.depth);
  block(2 * F.holeX + 7.5, 0.7, 0.4, 0, F.bottom + 0.6, F.depth);
  const frame = mergeGeometries(blocks)!;
  planarUV(frame, 12, 3.1, 1.7);
  blocks.forEach(g => g.dispose());

  // trim: floor + top guide rails, rack teeth on the top rail, lip around the hole
  const trim: BufferGeometry[] = [];
  const railZ = -0.62;
  trim.push(new BoxGeometry(2 * (F.holeX + 9), 0.22, 0.34).translate(0, -0.11, railZ));
  trim.push(new BoxGeometry(2 * (F.holeX + 9), 0.26, 0.4).translate(0, DOOR.H + 0.2, railZ));
  for (let x = -(F.holeX + 8.8); x <= F.holeX + 8.8; x += 0.3) {
    trim.push(new BoxGeometry(0.13, 0.12, 0.3).translate(x, DOOR.H + 0.39, railZ));
  }
  const lip = 0.12;
  trim.push(new BoxGeometry(lip, F.holeTop - 0.6, 0.5).translate(-F.holeX - lip / 2, (F.holeTop - 0.6) / 2, F.depth - 0.1));
  trim.push(new BoxGeometry(lip, F.holeTop - 0.6, 0.5).translate(F.holeX + lip / 2, (F.holeTop - 0.6) / 2, F.depth - 0.1));
  const flatTrim = trim.map(flat);
  const trimGeo = mergeGeometries(flatTrim)!;
  trim.forEach(g => g.dispose());
  flatTrim.forEach(g => g.dispose());
  return { frame, trim: trimGeo };
}

export function buildDoorGeometry(): DoorGeometrySet {
  const right = buildPanel(true);
  const leftRaw = buildPanel(false);
  const left: PanelGeometries = {
    body: mirrorX(leftRaw.body),
    plates: mirrorX(leftRaw.plates),
    ledStrip: mirrorX(leftRaw.ledStrip),
    // mirror rivet POSITIONS only: a negative-scale instance matrix flips the
    // dome's winding and gets back-face culled
    rivets: leftRaw.rivets.map(m => {
      const e = m.elements.slice();
      const out = new Matrix4().fromArray(e);
      out.elements[12] = -out.elements[12];
      return out;
    }),
  };
  [leftRaw.body, leftRaw.plates, leftRaw.ledStrip].forEach(g => g.dispose());

  const rivet = new SphereGeometry(DOOR.rivet.radius, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2);
  const { frame, trim } = buildFrame();
  const pistonSleeve = new CylinderGeometry(0.16, 0.16, 1, 18, 1).rotateZ(Math.PI / 2).translate(0.5, 0, 0);
  const pistonRod = new CylinderGeometry(0.075, 0.075, 1, 14, 1).rotateZ(Math.PI / 2).translate(0.5, 0, 0);

  const all = [right.body, right.plates, right.ledStrip, left.body, left.plates, left.ledStrip, rivet, frame, trim, pistonSleeve, pistonRod];
  return {
    right,
    left,
    rivet,
    frame,
    frameTrim: trim,
    pistonSleeve,
    pistonRod,
    dispose: () => all.forEach(g => g.dispose()),
  };
}
