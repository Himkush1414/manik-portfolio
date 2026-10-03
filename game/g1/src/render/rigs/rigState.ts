// Shared inputs of the mission camera rigs, written by the mission loop each
// frame (plain objects: no per-frame allocation), plus the ONE FOV-kick
// spring every rig reads (switching rigs never resets the speed feel).
import { Quaternion, Vector3, type Camera } from 'three';
import { SPEED_FX } from '../../data/speedfx';

/** the aim (rad) through the reticle; `cursor`: a human's reticle drawn at the screen cursor (cx, cy NDC);
 *  `lookAhead`: settings controls.reticleLookAhead (the follow cameras lean toward the aim) */
export const rigAim = { yaw: 0, pitch: 0, cursor: false, cx: 0, cy: 0, lookAhead: false };

/** the camera the mission rendered with last (QA projections: __G1__.flight) */
export const rigCamera = { cam: null as Camera | null };

/** flight state for the camera feel */
export const rigFlight = {
  /** forward speed / cruise */
  speedRatio: 1,
  boost: false,
  reduceMotion: false,
  /** ship visual bank (rad, + = left wing up), barrel-roll angle, nose yaw (rad, three rotation.y) + pitch */
  bank: 0,
  roll: 0,
  yaw: 0,
  pitch: 0,
  /** settings camera.rollStrength (0..1) */
  rollStrength: 1,
  /** camera attachment weight: 0 STEADY HORIZON .. 1 FULLY ATTACHED, eased over CAMERA_ATTACH.blend s
   *  toward the setting (MissionDriver), so a change never cuts */
  attach: 1,
  /** clearance (u) of a mission-local point above the terrain (camera collision); null = no world */
  clearAt: null as ((x: number, y: number, z: number) => number) | null,
  /** the cockpit interior's roll / pitch relative to the rail (combiner horizon) */
  interiorRoll: 0,
  interiorPitch: 0,
  /** cosmetic tunnel bend ahead: look-point offset (u) + bank into it (rad) */
  swayX: 0,
  swayY: 0,
  swayBank: 0,
  /** lateral acceleration of the ship (u/s^2): cockpit head inertia */
  ax: 0,
  ay: 0,
  /** the design envelope at the player (u): fallback when no free space is measured (no world) */
  envA: 18,
  envB: 10.5,
  /** measured free space at the path line (u, sim player.freeL / R / Up / Down; 0 = no world) */
  freeL: 0,
  freeR: 0,
  freeUp: 0,
  freeDown: 0,
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
