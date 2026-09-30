// ShipFactory (brief §10, §19): builds any ship from its ShipSpec.
//   ShipFactory.build(shipId, { livery, lod }) -> { group, hardpoints, dispose(), ... }
// Geometry is built OFF the main thread by the bake worker during boot
// (preloadShipGeometry) and cached per (ship, lod); if something asks before
// the worker delivered, it is built synchronously as a fallback. Materials are
// per instance (liveries animate per instance). Merged per material: paint,
// nozzle, guns, heat ring, core, plume, glass, frame, pilot, greebles
// (instanced), nav lights x3, repulsors.
import { BoxGeometry, Group, InstancedMesh, Matrix4, Mesh, type BufferGeometry, type Material } from 'three';
import gsap from 'gsap';
import type { Hardpoint } from './types';
import { buildShipGeometry, deserializeShipGeometry, disposeShipGeometry, type ShipGeometry, type Lod } from './geometry';
import { createHullPaint, liveryColors, finishId, type HullPaint } from './materials/hullPaint';
import { createShipMaterials, createEngineGlow, type ShipMaterials, type EngineGlow } from './materials/shipMaterials';
import { SPECS } from './specs';
import { liveriesFor, clampLivery } from '../data/liveries';
import type { ShipId } from '../data/ships';
import { bakeClient } from '../workers/bakeClient';

export type { Lod } from './geometry';

const cache = new Map<string, ShipGeometry>();
const key = (id: ShipId, lod: Lod) => `${id}:${lod}`;

/** Worker-built geometry into the cache (boot loader). */
export async function preloadShipGeometry(id: ShipId, lod: Lod): Promise<void> {
  if (cache.has(key(id, lod))) return;
  const data = await bakeClient.shipGeometry(id, lod);
  if (!cache.has(key(id, lod))) cache.set(key(id, lod), deserializeShipGeometry(data));
}

function geometryFor(id: ShipId, lod: Lod): ShipGeometry {
  const k = key(id, lod);
  let g = cache.get(k);
  if (!g) {
    g = buildShipGeometry(SPECS[id], lod); // fallback (not during boot)
    cache.set(k, g);
  }
  return g;
}

export type BuiltShip = {
  group: Group;
  hardpoints: Hardpoint[];
  paint: HullPaint;
  tris: number;
  setLivery(index: number, animate?: boolean): void;
  setDissolve(v: number): void;
  setEngineLevel(level: number): void;
  update(t: number): void;
  dispose(): void;
};

const greebleBox = new BoxGeometry(1, 1, 1);
const tmpM = new Matrix4();

export const ShipFactory = {
  build(shipId: ShipId, opts: { livery?: number; lod?: Lod } = {}): BuiltShip {
    const spec = SPECS[shipId];
    const lod = opts.lod ?? 0;
    const geo = geometryFor(shipId, lod);
    const liveries = liveriesFor(shipId);
    const zRange: [number, number] = [spec.hull.rings[0].z, spec.hull.rings[spec.hull.rings.length - 1].z];
    const paintMat = createHullPaint(liveries[clampLivery(shipId, opts.livery ?? 0)], zRange);
    const mats: ShipMaterials = createShipMaterials();
    const glow: EngineGlow = createEngineGlow(spec.engines[0]?.core ?? 'annular', spec.emissiveTrim === 'nebula-edges' ? 'nebula' : 'ignition');
    let engineLevel = 0.25;

    const group = new Group();
    group.name = `ship:${shipId}`;
    const add = (g: BufferGeometry | null, m: Material, o: { shadow?: boolean; order?: number } = {}) => {
      if (!g) return null;
      const mesh = new Mesh(g, m);
      mesh.castShadow = !!o.shadow;
      mesh.receiveShadow = !!o.shadow;
      if (o.order !== undefined) mesh.renderOrder = o.order;
      group.add(mesh);
      return mesh;
    };
    const paintMesh = add(geo.paint, paintMat, { shadow: true })!;
    add(geo.nozzle, mats.nozzle, { shadow: true });
    add(geo.guns, mats.gun, { shadow: true });
    add(geo.ring, mats.heatRing, { shadow: true });
    add(geo.core, glow.core);
    add(geo.plume, glow.plume, { order: 10 });
    add(geo.frame, mats.frame, { shadow: true });
    add(geo.pilot, mats.pilot);
    add(geo.glass, mats.glass, { order: 9 });
    add(geo.navRed, mats.navRed);
    add(geo.navGreen, mats.navGreen);
    add(geo.navWhite, mats.navWhite);
    add(geo.repulsor, mats.repulsor);
    let greebleMesh: InstancedMesh | null = null;
    const gCount = geo.greebles.length / 16;
    if (gCount) {
      greebleMesh = new InstancedMesh(greebleBox, mats.greeble, gCount);
      for (let i = 0; i < gCount; i++) greebleMesh.setMatrixAt(i, tmpM.fromArray(geo.greebles, i * 16));
      greebleMesh.instanceMatrix.needsUpdate = true;
      greebleMesh.castShadow = true;
      group.add(greebleMesh);
    }

    let tween: gsap.core.Tween | null = null;
    return {
      group,
      hardpoints: spec.hardpoints,
      paint: paintMat,
      tris: geo.tris,
      setLivery(index, animate = true) {
        const l = liveries[clampLivery(shipId, index)];
        const u = paintMat.uniforms;
        // freeze the current look as "previous", sweep the band to the new one
        u.uPrev.value.forEach((c, i) => c.copy(u.uCol.value[i]));
        u.uPrevFinish.value = u.uFinish.value;
        liveryColors(l).forEach((c, i) => u.uCol.value[i].copy(c));
        u.uFinish.value = finishId(l.finish);
        tween?.kill();
        if (!animate) {
          u.uRepaint.value = 1;
          return;
        }
        u.uRepaint.value = 0;
        tween = gsap.to(u.uRepaint, { value: 1, duration: 0.55, ease: 'power2.inOut' });
      },
      setDissolve(v) {
        paintMat.uniforms.uDissolve.value = v;
        for (const child of group.children) {
          if (child === paintMesh) continue;
          child.visible = v < 0.5; // non-paint parts pop out mid-dissolve
        }
      },
      setEngineLevel(level) {
        engineLevel = level;
      },
      update(t) {
        glow.setLevel(engineLevel, t);
        const blink = Math.sin(t * 3.1) > 0.2 ? 1 : 0.15;
        const strobe = t % 1.6 < 0.07 ? 1 : 0.05;
        mats.navRed.emissiveIntensity = 5 * blink;
        mats.navGreen.emissiveIntensity = 5 * blink;
        mats.navWhite.emissiveIntensity = 8 * strobe;
      },
      dispose() {
        tween?.kill();
        paintMat.dispose();
        glow.core.dispose();
        glow.plume.dispose();
        Object.values(mats).forEach(m => m.dispose());
        greebleMesh?.dispose();
        // geometry is cached + shared: see disposeShipCache()
      },
    };
  },
};

export function disposeShipCache(): void {
  for (const g of cache.values()) disposeShipGeometry(g);
  cache.clear();
}
