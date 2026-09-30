// Camera-mode contract. Phase 1 ships the selector + state; the three rigs
// themselves are Phase 2 implementations of CameraRig.
import type { Camera, Object3D } from 'three';

export const CAMERA_MODES = ['third', 'chase', 'cockpit'] as const;
export type CameraMode = (typeof CAMERA_MODES)[number];

export function isCameraMode(v: unknown): v is CameraMode {
  return typeof v === 'string' && (CAMERA_MODES as readonly string[]).includes(v);
}

export interface CameraRig {
  readonly mode: CameraMode;
  /** Attach to the player ship and take control of the camera. */
  attach(camera: Camera, target: Object3D): void;
  /** Per-frame update (dt seconds). Must not allocate. */
  update(dt: number): void;
  /** Release the camera; restore nothing (the next rig owns it). */
  detach(): void;
}
