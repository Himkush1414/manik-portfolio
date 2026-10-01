// THIRD PERSON + CHASE rigs (brief §8). Implement the Phase 1 CameraRig
// contract and produce a RigPose the switcher blends into the director.
//   third: offset (0, 3.2, 12), FOV 70, position lag 0.08 s, rotation lag 0.12 s, 25 % look-ahead
//   chase: offset (0, 1.6, 6.5), FOV 78, lag 0.04 s, roll coupling 1.4x, more speed, less ship
// Feel (data/mission.ts RIGS): the camera follows only a fraction of the
// ship's lateral offset, so the ship visibly moves across the screen and the
// tunnel never swings 1:1 with every strafe; the camera rolls a little with
// the ship's bank (x settings roll coupling, capped under reduce-motion) and
// sways with the cosmetic bend of the tunnel ahead. No allocation per frame.
import { Matrix4, Vector3, type Camera, type Object3D } from 'three';
import type { CameraRig } from '../cameraRig';
import { RIGS, PLAYER } from '../../data/mission';
import { useSettings } from '../../state/settings.store';
import { createPose, fovKick, rigAim, rigFlight, type RigPose } from './rigState';

const _want = new Vector3();
const _look = new Vector3();
const _up = new Vector3();
const _m = new Matrix4();

export class FollowRig implements CameraRig {
  readonly pose: RigPose = createPose();
  private target: Object3D | null = null;
  private pos = new Vector3();
  private look = new Vector3();
  private rollS = 0;
  private primed = false;
  /** offset scale for the flown ship's size (RIGS.refLength) */
  scale = 1;

  constructor(readonly mode: 'third' | 'chase') {}

  attach(_camera: Camera, target: Object3D): void {
    this.target = target;
    this.primed = false;
  }

  update(dt: number): void {
    const t = this.target;
    if (!t) return;
    const R = RIGS[this.mode];
    const f = rigFlight;
    const o = t.parent ? t.parent.position : _look.set(0, 0, 0); // mission frame origin
    const fx = t.position.x * R.follow[0], fy = t.position.y * R.follow[1];
    const k = this.scale;
    _want.set(o.x + fx + R.offset[0] * k, o.y + fy + R.offset[1] * k, o.z + t.position.z + R.offset[2] * k);
    const C = PLAYER.aim.convergence;
    const ax = Math.tan(rigAim.yaw) * C * R.lookAhead, ay = Math.tan(rigAim.pitch) * C * R.lookAhead;
    const sway = f.reduceMotion ? 0.3 : 1;
    const lx = o.x + fx + ax + f.swayX * sway, ly = o.y + fy + ay + f.swayY * sway, lz = o.z + t.position.z - R.lookDist;
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
    // roll: a share of the ship's bank (never the barrel roll), + the tunnel bend
    const coupling = f.reduceMotion ? Math.min(f.rollCoupling, RIGS.reduceRoll) : f.rollCoupling;
    const rollT = -f.bank * R.roll * coupling + f.swayBank * sway;
    this.rollS += (rollT - this.rollS) * kr;
    const P = this.pose;
    P.pos.copy(this.pos);
    _up.set(Math.sin(this.rollS), Math.cos(this.rollS), 0);
    _m.lookAt(this.pos, this.look, _up);
    P.quat.setFromRotationMatrix(_m);
    P.focus.copy(t.position).add(o);
    const base = R.fov * (useSettings.getState().camera.fov / RIGS.fovBase);
    P.fov = base + fovKick.value;
  }

  detach(): void {
    this.target = null;
  }
}

/** Phase 2 names (brief §8) */
export class ThirdPersonRig extends FollowRig {
  constructor() {
    super('third');
  }
}
export class ChaseRig extends FollowRig {
  constructor() {
    super('chase');
  }
}
