// Ship geometry assembly (worker-safe: no DOM, no materials, no GSAP). Runs
// inside the bake worker at boot; the main thread only rebuilds
// BufferGeometries from the transferred arrays (see ShipFactory).
import { BufferGeometry, SphereGeometry, CylinderGeometry, Float32BufferAttribute, BufferAttribute } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ShipSpec } from './types';
import { loftHull } from './geom/loft';
import { buildWing } from './geom/wing';
import { buildEngine, buildCanopy, buildPod, greebleMatrices } from './geom/parts';
import { bakeWear, bakeSoot } from './geom/finalize';
import { curvatureWear } from './geom/curvature';
import { mergeParts } from './geom/util';

export type Lod = 0 | 1;

export type ShipGeometry = {
  paint: BufferGeometry;
  nozzle: BufferGeometry;
  guns: BufferGeometry | null;
  ring: BufferGeometry;
  core: BufferGeometry;
  plume: BufferGeometry;
  glass: BufferGeometry | null;
  frame: BufferGeometry | null;
  pilot: BufferGeometry | null;
  greebles: Float32Array; // packed 4x4 matrices
  navRed: BufferGeometry | null;
  navGreen: BufferGeometry | null;
  navWhite: BufferGeometry | null;
  repulsor: BufferGeometry | null;
  tris: number;
};

const GEO_KEYS = ['paint', 'nozzle', 'guns', 'ring', 'core', 'plume', 'glass', 'frame', 'pilot', 'navRed', 'navGreen', 'navWhite', 'repulsor'] as const;
type GeoKey = (typeof GEO_KEYS)[number];

function tagZone(g: BufferGeometry, zone: number): BufferGeometry {
  const n = g.attributes.position.count;
  if (!g.attributes.paintZone) g.setAttribute('paintZone', new Float32BufferAttribute(new Float32Array(n).fill(zone), 1));
  if (!g.attributes.uv) g.setAttribute('uv', new Float32BufferAttribute(new Float32Array(n * 2), 2));
  if (!g.attributes.aWear) g.setAttribute('aWear', new Float32BufferAttribute(new Float32Array(n), 1));
  return g;
}

function mergeSimple(list: BufferGeometry[]): BufferGeometry | null {
  if (!list.length) return null;
  const prepared = list.map(g => {
    const q = g.index ? g.toNonIndexed() : g;
    for (const name of Object.keys(q.attributes)) if (!['position', 'normal', 'uv'].includes(name)) q.deleteAttribute(name);
    if (!q.attributes.uv) q.setAttribute('uv', new Float32BufferAttribute(new Float32Array(q.attributes.position.count * 2), 2));
    return q;
  });
  return mergeGeometries(prepared, false);
}

const countTris = (g: BufferGeometry | null) => (g ? (g.index ? g.index.count : g.attributes.position.count) / 3 : 0);

export function buildShipGeometry(spec: ShipSpec, lod: Lod): ShipGeometry {
  const low = lod === 1;
  const hull = loftHull({
    ...spec.hull,
    stations: low ? Math.round(spec.hull.stations * 0.35) : spec.hull.stations,
    radial: low ? Math.round(spec.hull.radial * 0.5) : spec.hull.radial,
    grooves: low ? [] : spec.hull.grooves,
    seams: low ? [] : spec.hull.seams,
  });
  curvatureWear(hull);
  const painted: BufferGeometry[] = [hull];
  for (const w of spec.wings) painted.push(tagZone(buildWing({ ...w, stations: low ? 4 : w.stations, foldLines: low ? [] : w.foldLines, flapLine: low ? 0 : w.flapLine }), 0));
  const metal: BufferGeometry[] = [];
  for (const p of spec.pods) {
    const parts = buildPod(p);
    if (p.kind === 'cannon') metal.push(...parts);
    else painted.push(...parts.map(g => tagZone(g, p.zone ?? 3)));
  }
  const paint = mergeParts(painted.map(g => tagZone(g, 0)), ['position', 'normal', 'uv', 'paintZone', 'aWear']);
  const saved = Float32Array.from(paint.attributes.aWear.array as Float32Array);
  bakeWear(paint, 1.3);
  const hashed = paint.attributes.aWear.array as Float32Array;
  for (let i = 0; i < hashed.length; i++) hashed[i] = Math.max(hashed[i], saved[i]);
  bakeSoot(paint, spec.engines);

  const bodies: BufferGeometry[] = [], rings: BufferGeometry[] = [], cores: BufferGeometry[] = [], plumes: BufferGeometry[] = [];
  for (const e of spec.engines) {
    const eng = buildEngine(e, low ? 20 : 56);
    bodies.push(eng.body);
    rings.push(eng.ring);
    cores.push(eng.core);
    plumes.push(eng.plume);
  }
  const can = buildCanopy(spec.canopy);
  const bulb = (pos: [number, number, number]) => new SphereGeometry(0.07, 10, 8).translate(...pos);
  const nav = (c: 'red' | 'green' | 'white') => mergeSimple(spec.navLights.filter(l => l.color === c).map(l => bulb(l.pos)));
  const g: ShipGeometry = {
    paint,
    nozzle: mergeSimple(bodies)!,
    guns: mergeSimple(metal),
    ring: mergeSimple(rings)!,
    core: mergeSimple(cores)!,
    plume: mergeSimple(plumes)!,
    glass: can.glass,
    frame: low ? null : mergeSimple(can.frames),
    pilot: low ? null : mergeSimple(can.pilot),
    greebles: new Float32Array(low ? [] : greebleMatrices(spec).flatMap(m => m.elements)),
    navRed: nav('red'),
    navGreen: nav('green'),
    navWhite: nav('white'),
    repulsor: mergeSimple(
      spec.repulsors.flatMap(p => [
        new CylinderGeometry(0.34, 0.38, 0.06, 28).translate(p[0], p[1], p[2]),
        new CylinderGeometry(0.2, 0.2, 0.08, 20).translate(p[0], p[1] - 0.02, p[2]),
      ]),
    ),
    tris: 0,
  };
  g.tris = GEO_KEYS.reduce((a, k) => a + countTris(g[k]), 0) + (g.greebles.length / 16) * 12;
  return g;
}

// ------------------------------------------------------------ transfer
type GeoData = { attrs: { name: string; array: Float32Array; itemSize: number }[]; index: Uint32Array | Uint16Array | null } | null;
export type ShipGeometryData = Record<GeoKey, GeoData> & { greebles: Float32Array; tris: number };

function toData(g: BufferGeometry | null): GeoData {
  if (!g) return null;
  return {
    attrs: Object.entries(g.attributes).map(([name, a]) => ({ name, array: a.array as Float32Array, itemSize: a.itemSize })),
    index: g.index ? (g.index.array as Uint32Array | Uint16Array) : null,
  };
}

function fromData(d: GeoData): BufferGeometry | null {
  if (!d) return null;
  const g = new BufferGeometry();
  for (const a of d.attrs) g.setAttribute(a.name, new BufferAttribute(a.array, a.itemSize));
  if (d.index) g.setIndex(new BufferAttribute(d.index, 1));
  g.computeBoundingSphere();
  return g;
}

export function serializeShipGeometry(g: ShipGeometry): { data: ShipGeometryData; transfer: ArrayBuffer[] } {
  const data = { greebles: g.greebles, tris: g.tris } as ShipGeometryData;
  const transfer: ArrayBuffer[] = [g.greebles.buffer as ArrayBuffer];
  for (const k of GEO_KEYS) {
    const d = toData(g[k]);
    data[k] = d;
    if (d) {
      for (const a of d.attrs) transfer.push(a.array.buffer as ArrayBuffer);
      if (d.index) transfer.push(d.index.buffer as ArrayBuffer);
    }
  }
  return { data, transfer: Array.from(new Set(transfer)) };
}

export function deserializeShipGeometry(d: ShipGeometryData): ShipGeometry {
  const out = { greebles: d.greebles, tris: d.tris } as ShipGeometry;
  for (const k of GEO_KEYS) (out as Record<GeoKey, BufferGeometry | null>)[k] = fromData(d[k]);
  return out;
}

export function disposeShipGeometry(g: ShipGeometry): void {
  for (const k of GEO_KEYS) g[k]?.dispose();
}
