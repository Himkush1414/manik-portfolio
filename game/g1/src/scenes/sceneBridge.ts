// Handles shared between the 3D world and choreography/UI layers without
// either importing the other's components.
import { detectGpuClass } from '../render/gpuClass';
import { DoorController } from './shared/doors/DoorController';

export const bootDoors = new DoorController('boot');
export const DOOR_Z = 38;
/** Launch bulkhead (camera-attached BlastDoors, 1G). */
export const launchDoors = new DoorController('launch');

/** The cockpit + launch tunnel live far from the hangar: outside every
 *  hangar light cone and beyond the camera's far plane from the bay. */
export const COCKPIT_ORIGIN: [number, number, number] = [0, 0, -2600];
/** Render layers: 2 = display ship (contact shadow), 3 = seen only by the
 *  cockpit mirrors (own ship), 4 = the mirror surfaces (never in a mirror). */
export const MIRROR_LAYER = 3;
export const MIRROR_SURFACE_LAYER = 4;
/** 5 = the mission world as the cockpit mirrors see it (terrain tiles; W4: reduced vegetation); in
 *  a mission the mirror cameras see only this + MIRROR_LAYER (no interior, no VFX). */
export const MIRROR_WORLD_LAYER = 5;

/** Phase 2 mission frame: 3000 u below the hangar, ~4 km from the cockpit
 *  (beyond both far planes). Render places entities at z = -(s - playerS). */
export const MISSION_ORIGIN: [number, number, number] = [0, -3000, 0];

import type { Camera, Object3D, Scene, WebGLRenderer } from 'three';

/** Phase 2 cockpit rig (additive): while `on`, the Phase 1 cockpit root rides on the flown ship's
 *  eye in the mission frame (render/rigs/CockpitRig.ts places it), its interior + mirrors render,
 *  and the launch tunnel + its own display ship stay hidden. <Cockpit/> registers `root`. */
export const cockpitInMission = { on: false, root: null as Object3D | null, hands: null as { stick: Object3D; throttle: Object3D } | null };

export type WorldHandles = { gl: WebGLRenderer; scene: Scene; camera: Camera };
let world: WorldHandles | null = null;
let resolveWorld: ((w: WorldHandles) => void) | null = null;
const worldPromise = new Promise<WorldHandles>(r => (resolveWorld = r));

/** Called by <World/> once it is mounted (loader's shader/warm-up tasks wait on it). */
export function markWorldMounted(w: WorldHandles): void {
  world = w;
  detectGpuClass(w.gl);
  resolveWorld?.(w);
}

export function whenWorldMounted(): Promise<WorldHandles> {
  return world ? Promise.resolve(world) : worldPromise;
}

let contentReady = false;
let resolveContent: (() => void) | null = null;
const contentPromise = new Promise<void>(r => (resolveContent = r));

/** Called once every staged part of the world content has mounted. */
export function markContentReady(): void {
  contentReady = true;
  resolveContent?.();
}

/** Resolves when the world AND all of its staged content are mounted. */
export async function whenContentReady(): Promise<WorldHandles> {
  const w = await whenWorldMounted();
  if (!contentReady) await contentPromise;
  return w;
}

// ------------------------------------------------------------- cockpit mount
// The cockpit is pre-warmed during hangar idle (brief §15: "no hitch"): the
// hangar asks for it a few seconds after it settles; START MISSION asks at
// once. <World/> mounts it; the cockpit reports ready after its compile.
type Listener = () => void;
let cockpitWanted = false;
const wantListeners = new Set<Listener>();
let cockpitReady = false;
let resolveCockpit: Listener | null = null;
const cockpitPromise = new Promise<void>(r => (resolveCockpit = r));

export const cockpitMount = {
  get wanted(): boolean {
    return cockpitWanted;
  },
  want(): void {
    if (cockpitWanted) return;
    cockpitWanted = true;
    wantListeners.forEach(l => l());
  },
  subscribe(l: Listener): () => void {
    wantListeners.add(l);
    return () => wantListeners.delete(l);
  },
  markReady(): void {
    cockpitReady = true;
    resolveCockpit?.();
  },
  whenReady(): Promise<void> {
    return cockpitReady ? Promise.resolve() : cockpitPromise;
  },
};
