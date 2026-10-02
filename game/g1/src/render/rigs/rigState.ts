// Shared inputs of the mission camera rigs, written by the mission loop each
// frame (plain objects: no per-frame allocation), plus the ONE FOV-kick
// spring every rig reads (switching rigs never resets the speed feel).
import { Quaternion, Vector3 } from 'three';
import { SPEED_FX } from '../../data/speedfx';

/** reticle angles (rad) the look-ahead follows */
export const rigAim = { yaw: 0, pitch: 0 };

/** flight state for the camera feel */
export const rigFlight = {
  /** forward speed / cruise */
  speedRatio: 1,
  boost: false,
  reduceMotion: false,
  /** ship visual bank (rad, + = left wing up) and the barrel-roll angle */
  bank: 0,
  roll: 0,
  /** settings camera.rollCoupling (0..1.4) */
  rollCoupling: 1,
  /** cosmetic tunnel bend ahead: look-point offset (u) + bank into it (rad) */
  swayX: 0,
  swayY: 0,
  swayBank: 0,
  /** lateral acceleration of the ship (u/s^2): cockpit head inertia */
  ax: 0,
  ay: 0,
};

/** Critically damped FOV kick (deg): +12 % of the base per +100 % speed over cruise, + boost; none
 *  under reduce-motion. Advanced once per frame by the rig switcher. */
export const fovKick = {
  value: 0,
  vel: 0,
  update(dt: number, base: number): void {
    const f = rigFlight;
    const want = f.reduceMotion ? 0 : base * SPEED_FX.fovPerSpeed * Math.max(0, f.speedRatio - 1) + (f.boost ? SPEED_FX.fovBoostDeg : 0);
    const w = SPEED_FX.fovOmega;
    this.vel += (w * w * (want - this.value) - 2 * w * this.vel) * dt;
    this.value += this.vel * dt;
  },
  reset(): void {
    this.value = this.vel = 0;
  },
};

/** What a mission rig produces each frame; the switcher blends two of them into the director. */
export type RigPose = { pos: Vector3; quat: Quaternion; focus: Vector3; fov: number };

export function createPose(): RigPose {
  return { pos: new Vector3(), quat: new Quaternion(), focus: new Vector3(), fov: 70 };
}
