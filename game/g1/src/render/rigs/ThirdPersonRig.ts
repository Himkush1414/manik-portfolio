// THIRD PERSON rig (brief §8): offset (0, 3.2, 12) behind the ship, FOV 70
// (scaled by the settings FOV), position lag 0.08 s, rotation lag 0.12 s,
// 25 % look-ahead toward the reticle. Implements the Phase 1 CameraRig
// contract; writes the camera director (CameraDirector applies it once per
// frame, CameraShaker adds trauma on top). No allocation per frame.
import { Vector3, type Camera, type Object3D } from 'three';
import type { CameraRig } from '../cameraRig';
import { director } from '../cameraDirector';
import { RIGS, PLAYER } from '../../data/mission';
import { useSettings } from '../../state/settings.store';
import { SPEED_FX } from '../../data/tunnel';

const _want = new Vector3();
const _look = new Vector3();

/** reticle angles the look-ahead follows (written by the mission loop each frame) */
export const rigAim = { yaw: 0, pitch: 0 };
/** flight state for FOV feel: speed / cruise ratio, boosting, reduce-motion */
export const rigFlight = { speedRatio: 1, boost: false, reduceMotion: false };

export class ThirdPersonRig implements CameraRig {
  readonly mode = 'third' as const;
  private target: Object3D | null = null;
  private pos = new Vector3();
  private look = new Vector3();
  private primed = false;
  /** critically damped FOV kick (deg) */
  private fovKick = 0;
  private fovVel = 0;

  attach(_camera: Camera, target: Object3D): void {
    this.target = target;
    this.primed = false;
  }

  update(dt: number): void {
    const t = this.target;
    if (!t) return;
    const R = RIGS.third;
    const o = t.parent ? t.parent.position : _look.set(0, 0, 0); // mission frame origin
    // ship position in world space (the ship group's parent is the mission root)
    _want.set(t.position.x + o.x + R.offset[0], t.position.y + o.y + R.offset[1], t.position.z + o.z + R.offset[2]);
    const C = PLAYER.aim.convergence;
    const ax = Math.tan(rigAim.yaw) * C * R.lookAhead, ay = Math.tan(rigAim.pitch) * C * R.lookAhead;
    const lx = t.position.x + o.x + ax, ly = t.position.y + o.y + ay, lz = t.position.z + o.z - R.lookDist;
    if (!this.primed) {
      this.pos.copy(_want);
      this.look.set(lx, ly, lz);
      this.primed = true;
    }
    const kp = 1 - Math.exp(-dt / R.posLag), kr = 1 - Math.exp(-dt / R.rotLag);
    this.pos.lerp(_want, kp);
    this.look.x += (lx - this.look.x) * kr;
    this.look.y += (ly - this.look.y) * kr;
    this.look.z += (lz - this.look.z) * kr;
    director.pos.copy(this.pos);
    director.look.copy(this.look);
    director.focus.copy(t.position).add(o);
    // FOV widens with speed (+12 % per +100 % over cruise) and kicks on boost; none under reduce-motion
    const base = R.fov * (useSettings.getState().camera.fov / RIGS.fovBase);
    const kick = rigFlight.reduceMotion ? 0 : base * SPEED_FX.fovPerSpeed * Math.max(0, rigFlight.speedRatio - 1) + (rigFlight.boost ? SPEED_FX.fovBoostDeg : 0);
    const w = SPEED_FX.fovOmega;
    this.fovVel += (w * w * (kick - this.fovKick) - 2 * w * this.fovVel) * dt;
    this.fovKick += this.fovVel * dt;
    director.fov = base + this.fovKick;
    director.roll = 0;
  }

  detach(): void {
    this.target = null;
  }
}
