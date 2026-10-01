// Mission camera switcher (brief §8): owns the three rigs, runs the active
// one (and the outgoing one while blending), blends their poses over 0.6 s
// (smootherstep; position lerp, orientation slerp, FOV lerp — never a hard
// cut) and writes the camera director. The director takes the blended
// QUATERNION (director.quat) so the cockpit interior, which rides on the
// same orientation, never swims. `onView` fires when the cockpit interior
// should appear / disappear: late in a blend INTO the cockpit (the camera is
// almost at the eye) and early in a blend out of it.
import type { Camera, Object3D } from 'three';
import type { CameraMode, CameraRig } from '../cameraRig';
import { director } from '../cameraDirector';
import { RIGS } from '../../data/mission';
import { useSettings } from '../../state/settings.store';
import { FollowRig } from './FollowRig';
import { CockpitRig } from './CockpitRig';
import { createPose, fovKick, type RigPose } from './rigState';

type PoseRig = CameraRig & { readonly pose: RigPose };

const smoother = (x: number) => x * x * x * (x * (x * 6 - 15) + 10);
/** blend progress at which the cockpit interior switches (in / out) */
const VIEW_IN = 0.72, VIEW_OUT = 0.22;

export class RigSwitcher implements CameraRig {
  readonly cockpit = new CockpitRig();
  readonly rigs: Record<CameraMode, PoseRig> = { third: new FollowRig('third'), chase: new FollowRig('chase'), cockpit: this.cockpit };
  mode: CameraMode = 'third';
  private from: CameraMode | null = null;
  private t = 1;
  private out: RigPose = createPose();
  private interior = false;
  /** the cockpit interior should show (true) / hide (false) */
  onView: ((cockpit: boolean) => void) | null = null;

  attach(camera: Camera, target: Object3D, mode: CameraMode = this.mode): void {
    for (const k in this.rigs) this.rigs[k as CameraMode].attach(camera, target);
    this.mode = mode;
    this.from = null;
    this.t = 1;
    fovKick.reset();
    this.setInterior(mode === 'cockpit');
    director.quat = this.out.quat;
  }

  /** Switch rigs with the 0.6 s blend (instant when `blend` is false). */
  set(mode: CameraMode, blend = true): void {
    if (mode === this.mode) return;
    this.from = blend ? this.mode : null;
    this.mode = mode;
    this.t = blend ? 0 : 1;
    if (!blend) this.setInterior(mode === 'cockpit');
  }

  /** the flown ship's length: follow offsets scale by max(1, length / RIGS.refLength) */
  setShipLength(length: number): void {
    const k = Math.max(1, length / RIGS.refLength);
    (this.rigs.third as FollowRig).scale = k;
    (this.rigs.chase as FollowRig).scale = k;
  }

  get blending(): boolean {
    return this.t < 1;
  }

  update(dt: number): void {
    const cur = this.rigs[this.mode];
    const base = this.mode === 'cockpit' ? RIGS.cockpit.fov : RIGS[this.mode].fov;
    fovKick.update(dt, base * (useSettings.getState().camera.fov / RIGS.fovBase));
    cur.update(dt);
    const o = this.out;
    if (this.from && this.t < 1) {
      const prev = this.rigs[this.from];
      prev.update(dt);
      this.t = Math.min(1, this.t + dt / RIGS.blend);
      const w = smoother(this.t);
      o.pos.lerpVectors(prev.pose.pos, cur.pose.pos, w);
      o.quat.slerpQuaternions(prev.pose.quat, cur.pose.quat, w);
      o.focus.lerpVectors(prev.pose.focus, cur.pose.focus, w);
      o.fov = prev.pose.fov + (cur.pose.fov - prev.pose.fov) * w;
      if (this.mode === 'cockpit' && this.t >= VIEW_IN) this.setInterior(true);
      if (this.from === 'cockpit' && this.t >= VIEW_OUT) this.setInterior(false);
      if (this.t >= 1) this.from = null;
    } else {
      o.pos.copy(cur.pose.pos);
      o.quat.copy(cur.pose.quat);
      o.focus.copy(cur.pose.focus);
      o.fov = cur.pose.fov;
    }
    director.pos.copy(o.pos);
    director.focus.copy(o.focus);
    // keep `look` meaningful for anything that reads it (forward, 10 u ahead)
    director.look.set(0, 0, -10).applyQuaternion(o.quat).add(o.pos);
    director.fov = o.fov;
    director.roll = 0;
    director.quat = o.quat;
  }

  detach(): void {
    for (const k in this.rigs) this.rigs[k as CameraMode].detach();
    this.setInterior(false);
    director.quat = null;
  }

  private setInterior(on: boolean): void {
    if (on === this.interior) return;
    this.interior = on;
    this.onView?.(on);
  }
}
