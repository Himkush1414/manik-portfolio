// Ship part builders: lathed engines, canopy loft + frames, pods, greeble
// placement, pilot silhouette. Everything returns plain BufferGeometry (or
// instance matrices) for the factory to merge per material.
import {
  BufferGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  LatheGeometry,
  Matrix4,
  Quaternion,
  SphereGeometry,
  TubeGeometry,
  CatmullRomCurve3,
  Vector2,
  Vector3,
  Euler,
} from 'three';
import type { CanopySpec, EngineSpec, PodSpec, ShipSpec } from '../types';
import { ringAt, ringPoint } from './loft';
import { createRng } from '../../core/rng';

const toZ = new Matrix4().makeRotationX(-Math.PI / 2); // lathe +y -> -z (exhaust direction)

function lathe(profile: [number, number][], segs: number): BufferGeometry {
  const g = new LatheGeometry(profile.map(([r, h]) => new Vector2(r, h)), segs);
  g.applyMatrix4(toZ);
  return g;
}

/** Engine: brushed shell (double-walled lip), heat ring, emissive core, plume. */
export function buildEngine(e: EngineSpec, segs = 48) {
  const R = e.radius, Lg = e.length;
  // lathe height h maps to -z; negative h therefore extends FORWARD (+z) into
  // the hull, h = 0 is the exit plane.
  // outer shell from buried front to the exit lip, then fold inside (double wall)
  const outer: [number, number][] = [
    [R * 0.98, -Lg],
    [R * 1.03, -Lg * 0.7],
    [R * 1.05, -Lg * 0.25],
    [R * 1.0, -0.02],
    [R * 0.96, 0.0], // lip
    [R * 0.84, -0.02],
    [R * 0.8, -Lg * 0.12],
    [R * 0.62, -Lg * 0.35], // throat
  ];
  const body = lathe(outer, segs);
  const ring = lathe([[R * 1.052, -Lg * 0.34], [R * 1.075, -Lg * 0.3], [R * 1.075, -Lg * 0.14], [R * 1.052, -Lg * 0.1]], segs);
  const core = lathe([[0.001, -Lg * 0.36], [R * 0.6, -Lg * 0.34], [R * 0.66, -Lg * 0.3], [0.001, -Lg * 0.29]], segs);
  // lathe/cylinder +y maps to -z (behind the exit): narrow far end on top
  const plume = new CylinderGeometry(R * 0.08, R * 0.62, R * 4.2, 32, 8, true);
  plume.translate(0, R * 2.1, 0);
  plume.applyMatrix4(toZ);
  const sx = e.scale?.[0] ?? 1, sy = e.scale?.[1] ?? 1;
  const place = new Matrix4().makeScale(sx, sy, 1).premultiply(new Matrix4().makeTranslation(...e.pos));
  for (const g of [body, ring, core, plume]) g.applyMatrix4(place);
  return { body, ring, core, plume };
}

/** Canopy glass bubble (top half-loft) + frame tubes + pilot silhouette. */
export function buildCanopy(c: CanopySpec) {
  const rings = 22, around = 28;
  const pos: number[] = [], uv: number[] = [];
  const shape = (t: number) => Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, t))), 0.55);
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const z = c.z0 + (c.z1 - c.z0) * t;
    // bubble leans forward: peak height ~40% from the rear
    const k = shape(t) * (1 - 0.35 * Math.max(0, t - 0.45));
    for (let j = 0; j <= around; j++) {
      const a = (j / around) * Math.PI; // 0..PI (starboard -> port over the top)
      const x = Math.cos(a) * c.w * k;
      const y = c.y + Math.sin(a) * c.h * k;
      pos.push(x, y, z);
      uv.push(j / around, t);
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < around; j++) {
      const a = i * (around + 1) + j, b = a + 1, cc = a + around + 1, d = cc + 1;
      idx.push(a, cc, b, b, cc, d);
    }
  }
  const glass = new BufferGeometry();
  glass.setAttribute('position', new Float32BufferAttribute(pos, 3));
  glass.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  glass.setIndex(idx);
  glass.computeVertexNormals();
  orientUp(glass, c.y);

  // frames: arches at chosen stations + a centre spine
  const frames: BufferGeometry[] = [];
  const arch = (t: number) => {
    const z = c.z0 + (c.z1 - c.z0) * t;
    const k = shape(t) * (1 - 0.35 * Math.max(0, t - 0.45)) * 1.02;
    const pts: Vector3[] = [];
    for (let j = 0; j <= 16; j++) {
      const a = (j / 16) * Math.PI;
      pts.push(new Vector3(Math.cos(a) * c.w * k, c.y + Math.sin(a) * c.h * k, z));
    }
    frames.push(new TubeGeometry(new CatmullRomCurve3(pts), 24, 0.045, 6, false));
  };
  for (let f = 1; f <= c.frames; f++) arch(0.2 + (0.55 * f) / (c.frames + 1));
  const spinePts: Vector3[] = [];
  for (let i = 0; i <= 20; i++) {
    const t = 0.04 + (i / 20) * 0.92;
    const k = shape(t) * (1 - 0.35 * Math.max(0, t - 0.45)) * 1.02;
    spinePts.push(new Vector3(0, c.y + c.h * k, c.z0 + (c.z1 - c.z0) * t));
  }
  frames.push(new TubeGeometry(new CatmullRomCurve3(spinePts), 40, 0.04, 6, false));
  // rim (sill) all around the base
  const sill: Vector3[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const k = shape(t) * (1 - 0.35 * Math.max(0, t - 0.45));
    sill.push(new Vector3(c.w * k * 1.02, c.y + 0.01, c.z0 + (c.z1 - c.z0) * t));
  }
  for (let i = 24; i >= 0; i--) {
    const t = i / 24;
    const k = shape(t) * (1 - 0.35 * Math.max(0, t - 0.45));
    sill.push(new Vector3(-c.w * k * 1.02, c.y + 0.01, c.z0 + (c.z1 - c.z0) * t));
  }
  frames.push(new TubeGeometry(new CatmullRomCurve3(sill, true), 80, 0.05, 6, true));

  // pilot silhouette: helmet + shoulders, sitting low in the canopy
  const pz = c.z0 + (c.z1 - c.z0) * 0.4;
  const helmet = new SphereGeometry(c.h * 0.36, 20, 14);
  helmet.scale(0.92, 1.05, 1.08);
  helmet.translate(0, c.y + c.h * 0.46, pz);
  const shoulders = new CylinderGeometry(c.w * 0.42, c.w * 0.52, c.h * 0.42, 16, 1);
  shoulders.scale(1, 1, 0.55);
  shoulders.translate(0, c.y + c.h * 0.08, pz - 0.05);
  return { glass, frames, pilot: [helmet, shoulders] };
}

function orientUp(g: BufferGeometry, baseY: number) {
  const p = g.attributes.position, n = g.attributes.normal;
  let score = 0;
  for (let i = 0; i < p.count; i++) score += (p.getY(i) - baseY) * n.getY(i);
  if (score < 0) {
    const idx = g.index!.array as Uint32Array | Uint16Array;
    for (let t = 0; t < idx.length; t += 3) {
      const tmp = idx[t + 1];
      idx[t + 1] = idx[t + 2];
      idx[t + 2] = tmp;
    }
    g.index!.needsUpdate = true;
    g.computeVertexNormals();
  }
}

/** Pods: cannon (barrel + muzzle brake), pod (capsule), dome, turret. */
export function buildPod(p: PodSpec): BufferGeometry[] {
  const out: BufferGeometry[] = [];
  const R = p.radius, L = p.length;
  const make = (): BufferGeometry[] => {
    if (p.kind === 'cannon') {
      const housing = lathe([[0.001, L * 0.05], [R, 0], [R * 1.05, -L * 0.25], [R * 0.9, -L * 0.45], [R * 0.45, -L * 0.5], [R * 0.4, -L * 0.95], [R * 0.55, -L * 0.96], [R * 0.55, -L], [0.001, -L]], 24);
      // negative lathe heights map to +z: the barrel already points forward
      return [housing];
    }
    if (p.kind === 'pod') {
      const body = lathe([[0.001, L * 0.5], [R * 0.7, L * 0.42], [R, L * 0.2], [R, -L * 0.3], [R * 0.8, -L * 0.48], [0.001, -L * 0.5]], 24);
      return [body];
    }
    if (p.kind === 'turret') {
      const base = new SphereGeometry(R, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
      const b1 = new CylinderGeometry(R * 0.12, R * 0.12, L, 10);
      b1.rotateX(Math.PI / 2);
      b1.translate(R * 0.25, R * 0.35, L * 0.45);
      const b2 = b1.clone();
      b2.translate(-R * 0.5, 0, 0);
      return [base, b1, b2];
    }
    if (p.kind === 'intake') {
      // chamfered scoop: rounded-rect cross-section lofted with a raked mouth
      return [intakeScoop(R, L)];
    }
    const dome = new SphereGeometry(R, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    return [dome];
  };
  const parts = make();
  for (const g of parts) g.translate(...p.pos);
  out.push(...parts);
  if (p.mirror) {
    for (const g of make()) {
      g.translate(-p.pos[0], p.pos[1], p.pos[2]);
      out.push(g);
    }
  }
  return out;
}

/** Seeded greeble transforms on the hull surface (mirrored to both sides). */
export function greebleMatrices(spec: ShipSpec): Matrix4[] {
  const out: Matrix4[] = [];
  const up = new Vector3(0, 0, 1);
  for (const gr of spec.greebles) {
    const rng = createRng(gr.seed);
    for (let i = 0; i < gr.count; i++) {
      const z = rng.range(gr.region.z[0], gr.region.z[1]);
      const r = ringAt(spec.hull.rings, z);
      const a =
        gr.region.side === 'top' ? Math.PI / 2 + rng.range(0.25, 0.85) * rng.sign() : gr.region.side === 'bottom' ? -Math.PI / 2 + rng.range(-0.7, 0.7) : rng.range(-0.3, 0.3);
      const [x, y] = ringPoint(r, a);
      const [x2, y2] = ringPoint(r, a + 0.01);
      const tangent = new Vector3(x2 - x, y2 - y, 0).normalize();
      const normal = new Vector3(tangent.y, -tangent.x, 0).normalize();
      if (normal.x * x + normal.y * (y - r.y) < 0) normal.negate();
      const q = new Quaternion().setFromUnitVectors(up, normal);
      const spin = new Quaternion().setFromEuler(new Euler(0, 0, rng.range(-0.1, 0.1)));
      const s = new Vector3(rng.range(0.08, 0.3), rng.range(0.05, 0.16), rng.range(0.02, 0.05));
      for (const side of [1, -1]) {
        const m = new Matrix4().compose(new Vector3(x * side, y, z).addScaledVector(new Vector3(normal.x * side, normal.y, 0), s.z * 0.4), side > 0 ? q.clone().multiply(spin) : new Quaternion().setFromUnitVectors(up, new Vector3(-normal.x, normal.y, 0)).multiply(spin), s);
        out.push(m);
      }
    }
  }
  return out;
}

/** Side intake scoop: chamfered rounded-rect section, raked mouth, closed back. */
function intakeScoop(R: number, L: number): BufferGeometry {
  const around = 24, along = 10;
  const w = R * 0.95, h = R * 1.15, n = 5;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= along; i++) {
    const t = i / along;
    const z = L * 0.5 - t * L - (i === 0 ? 0 : 0);
    const taper = 1 - Math.pow(t, 3) * 0.55;
    const rake = i === 0 ? 1 : 1;
    for (let j = 0; j < around; j++) {
      const a = (j / around) * Math.PI * 2;
      const c = Math.cos(a), s = Math.sin(a);
      const x = w * taper * Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
      const y = h * taper * Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
      // raked mouth: the top lip leads the bottom lip
      pos.push(x, y, z + (i === 0 ? y * 0.35 * rake : 0));
    }
  }
  for (let i = 0; i < along; i++) {
    for (let j = 0; j < around; j++) {
      const a = i * around + j, b = i * around + ((j + 1) % around), c = (i + 1) * around + j, d = (i + 1) * around + ((j + 1) % around);
      idx.push(a, b, c, b, d, c);
    }
  }
  // mouth + back caps
  for (const [ring, face] of [[0, 1], [along, -1]] as const) {
    const ci = pos.length / 3;
    let cx = 0, cy = 0, cz = 0;
    for (let j = 0; j < around; j++) {
      cx += pos[(ring * around + j) * 3];
      cy += pos[(ring * around + j) * 3 + 1];
      cz += pos[(ring * around + j) * 3 + 2];
    }
    pos.push(cx / around, cy / around, cz / around - (face > 0 ? 0.35 : 0)); // recessed mouth
    for (let j = 0; j < around; j++) {
      const a = ring * around + j, b = ring * around + ((j + 1) % around);
      if (face > 0) idx.push(ci, b, a);
      else idx.push(ci, a, b);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
