// Door GPU assets, built once during boot by the loader's 'geometry' task
// and shared by every BlastDoors instance (boot gate, launch bulkhead).
import { MeshPhysicalMaterial, MeshStandardMaterial, Color, type Texture } from 'three';
import { buildDoorGeometry, type DoorGeometrySet } from './doorGeometry';
import { bakeMetalSet, type MetalSet } from '../../../render/tex/metalSet';
import { bakeDecalAtlas } from '../../../render/tex/decalAtlas';
import { hdr } from '../../../render/palette';

export type DoorAssets = {
  geo: DoorGeometrySet;
  metal: MetalSet;
  frameMetal: MetalSet;
  atlas: Texture;
  mats: {
    panel: MeshPhysicalMaterial;
    plate: MeshPhysicalMaterial;
    frame: MeshPhysicalMaterial;
    trim: MeshPhysicalMaterial;
    rivet: MeshStandardMaterial;
    rod: MeshPhysicalMaterial;
    sleeve: MeshStandardMaterial;
    led: MeshStandardMaterial;
    decal: MeshStandardMaterial;
  };
  dispose(): void;
};

let cache: DoorAssets | null = null;
const nextFrame = () => new Promise<void>(r => requestAnimationFrame(() => r()));

function armour(set: MetalSet, tint: string, clearcoat = 0): MeshPhysicalMaterial {
  return new MeshPhysicalMaterial({
    color: new Color(tint),
    map: set.map,
    normalMap: set.normal,
    roughnessMap: set.orm,
    metalnessMap: set.orm,
    aoMap: set.orm,
    aoMapIntensity: 0.9,
    roughness: 1,
    metalness: 1,
    clearcoat,
    clearcoatRoughness: 0.35,
  });
}

/** Builds (or returns the cached) door assets, yielding between heavy steps. */
export async function loadDoorAssets(): Promise<DoorAssets> {
  if (cache) return cache;
  const metal = bakeMetalSet({ seed: 11, paint: [44, 49, 60], bare: [150, 156, 168], wear: 0.34, streaks: 0.55 });
  await nextFrame();
  const frameMetal = bakeMetalSet({ seed: 23, paint: [30, 34, 43], bare: [128, 134, 146], wear: 0.24, streaks: 0.7, roughPaint: [0.46, 0.7] });
  await nextFrame();
  const atlas = bakeDecalAtlas();
  await nextFrame();
  const geo = buildDoorGeometry();
  const mats = {
    panel: armour(metal, '#ffffff'),
    plate: armour(metal, '#d6dbe6', 0.25),
    frame: armour(frameMetal, '#ffffff'),
    trim: new MeshPhysicalMaterial({ color: '#8d94a3', metalness: 1, roughness: 0.3, anisotropy: 0.8 }),
    rivet: new MeshStandardMaterial({ color: '#9aa1ae', metalness: 0.95, roughness: 0.34 }),
    rod: new MeshPhysicalMaterial({ color: '#c9ced8', metalness: 1, roughness: 0.14, anisotropy: 0.9, anisotropyRotation: Math.PI / 2 }),
    sleeve: new MeshStandardMaterial({ color: '#23262e', metalness: 0.6, roughness: 0.5 }),
    led: new MeshStandardMaterial({ color: '#000000', emissive: hdr('danger', 1), emissiveIntensity: 4, toneMapped: false }),
    decal: new MeshStandardMaterial({
      map: atlas,
      transparent: true,
      roughness: 0.62,
      metalness: 0.1,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  };
  cache = {
    geo,
    metal,
    frameMetal,
    atlas,
    mats,
    dispose() {
      geo.dispose();
      metal.dispose();
      frameMetal.dispose();
      atlas.dispose();
      Object.values(mats).forEach(m => m.dispose());
      cache = null;
    },
  };
  return cache;
}

export function getDoorAssets(): DoorAssets | null {
  return cache;
}
