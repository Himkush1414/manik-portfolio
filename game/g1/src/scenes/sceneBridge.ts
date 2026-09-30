// Handles shared between the 3D world and choreography/UI layers without
// either importing the other's components.
import { DoorController } from './shared/doors/DoorController';

export const bootDoors = new DoorController('boot');
export const DOOR_Z = 38;

import type { Camera, Scene, WebGLRenderer } from 'three';

export type WorldHandles = { gl: WebGLRenderer; scene: Scene; camera: Camera };
let world: WorldHandles | null = null;
let resolveWorld: ((w: WorldHandles) => void) | null = null;
const worldPromise = new Promise<WorldHandles>(r => (resolveWorld = r));

/** Called by <World/> once it is mounted (loader's shader/warm-up tasks wait on it). */
export function markWorldMounted(w: WorldHandles): void {
  world = w;
  resolveWorld?.(w);
}

export function whenWorldMounted(): Promise<WorldHandles> {
  return world ? Promise.resolve(world) : worldPromise;
}
