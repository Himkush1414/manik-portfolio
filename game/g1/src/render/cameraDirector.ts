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

const DEG = Math.PI / 180;
/** Hangar product-shot orbit (brief §11); scenes/hangar/hangarCamera.ts animates it. */
export const HANGAR_ORBIT = {
  target: [-0.3, 2.35, 0] as const, // look point left of the ship => ship sits at ~52% x
  focus: [0, 2.3, 0] as const,
  dist: 32,
  elev: 13.5 * DEG,
  azim: 0,
  fov: 30,
  breathe: 0.4,
  breathePeriod: 9,
  noise: 0.02,
  parallax: 0.5,
  pushFrom: 1.32, // distance multiplier at the start of the load push-in
} as const;

function orbitRest(): [number, number, number] {
  const o = HANGAR_ORBIT;
  return [
    o.target[0] + Math.sin(o.azim) * Math.cos(o.elev) * o.dist,
    o.target[1] + Math.sin(o.elev) * o.dist,
    o.target[2] + Math.cos(o.azim) * Math.cos(o.elev) * o.dist,
  ];
}

export const VIEWS = {
  bootGate: { pos: [0, 6.6, 70], look: [0, 6.9, 38], focus: [0, 6.9, 38], fov: 30 },
  hangar: { pos: orbitRest(), look: HANGAR_ORBIT.target, focus: HANGAR_ORBIT.focus, fov: HANGAR_ORBIT.fov },
  // ship QA angles (brief §10 iteration loop)
  ship3q: { pos: [18, 7.5, 22], look: [0, 1.9, 0], focus: [0, 1.9, 0], fov: 30 },
  shipSide: { pos: [33, 2.6, 0.01], look: [0, 2.1, 0], focus: [0, 2.1, 0], fov: 30 },
  shipTop: { pos: [0, 36, 0.6], look: [0, 2.1, 0], focus: [0, 2.1, 0], fov: 30 },
  shipRear: { pos: [-13, 5.5, -26], look: [0, 2.1, 0], focus: [0, 2.1, 0], fov: 30 },
  shipLow: { pos: [9, 0.7, 25], look: [0, 2.4, 0], focus: [0, 2.2, 0], fov: 30 },
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
