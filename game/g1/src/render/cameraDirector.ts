// Camera director: the single place camera pose lives. Choreography (GSAP
// timelines) and scene controllers write these plain fields; <CameraDirector/>
// applies them once per frame before rendering (CameraShaker adds on top).
import { Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import type { PerspectiveCamera } from 'three';

export const director = {
  pos: new Vector3(0, 6.6, 70),
  look: new Vector3(0, 6.9, 38),
  /** depth-of-field focus point (tweened with the shot, not tied to look) */
  focus: new Vector3(0, 6.64, 62),
  fov: 30,
  roll: 0,
};

export const VIEWS = {
  bootGate: { pos: [0, 6.6, 70], look: [0, 6.9, 38], focus: [0, 6.9, 38], fov: 30 },
  hangar: { pos: [0, 3.4, 33], look: [0, 1.9, 0], focus: [0, 1.9, 0], fov: 30 },
} as const;

/** Boot FX plane: 8 u in front of the gate camera. */
export const BOOT_FX_POS: [number, number, number] = [0, 6.64, 62];

export function setView(v: (typeof VIEWS)[keyof typeof VIEWS]): void {
  director.pos.set(v.pos[0], v.pos[1], v.pos[2]);
  director.look.set(v.look[0], v.look[1], v.look[2]);
  director.focus.set(v.focus[0], v.focus[1], v.focus[2]);
  director.fov = v.fov;
}

export function CameraDirector() {
  useFrame(({ camera }) => {
    const cam = camera as PerspectiveCamera;
    cam.position.copy(director.pos);
    cam.up.set(Math.sin(director.roll), Math.cos(director.roll), 0);
    cam.lookAt(director.look);
    if (Math.abs(cam.fov - director.fov) > 0.001) {
      cam.fov = director.fov;
      cam.updateProjectionMatrix();
    }
  }, -1);
  return null;
}
