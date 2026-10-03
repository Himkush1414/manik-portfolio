// THIRD PERSON + CHASE rigs (brief §8). Implement the Phase 1 CameraRig
// contract and produce a RigPose the switcher blends into the director.
//   third: offset (0, 3.2, 12), FOV 70, position lag 0.08 s
//   chase: offset (0, 1.6, 6.5), FOV 78, lag 0.04 s, more speed, less ship
// Control / Camera / Boundary addendum — the settings ATTACHMENT decides how
// the rig follows (data/mission.ts CAMERA_ATTACH), blended by
// rigFlight.attach (0 steady .. 1 attached) so a change never cuts:
//  - FULLY ATTACHED: a rigid boom. The camera sits at ship + q (0, up, back)
//    and looks along q, q = the ship's pitch + nose yaw + bank x roll
//    strength (+ 40 % of a barrel roll): the ship holds its spot on screen
//    and the world rolls and slides past it.
//  - STEADY HORIZON: the boom never turns (<= 2 deg cosmetic sway); it
//    translates a computed share of the ship's offset, from the MEASURED
//    free space on the ship's side, so the ship sweeps the screen, and never
//    leaves 90 % of the half-screen.
// Camera collision changes distance + height only: near terrain the boom
// pulls in to the reduced rig. Mouse look-ahead is an opt-in setting: by
// default the mouse never moves the camera. No allocation per frame.
import { Euler, Quaternion, Vector3, type Camera, type Object3D, type PerspectiveCamera } from 'three';
import type { CameraRig } from '../cameraRig';
import { RIGS, PLAYER, CAMERA_ATTACH } from '../../data/mission';
import { useSettings } from '../../state/settings.store';
import { createPose, fovKick, rigAim, rigFlight, type RigPose } from './rigState';

const _e = new Euler(0, 0, 0, 'YXZ');
const _q = new Quaternion();
const _r = new Quaternion();
const _boom = new Vector3();
const _full = new Vector3();
const _zero = new Vector3();

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export class FollowRig implements CameraRig {
  readonly pose: RigPose = createPose();
  private target: Object3D | null = null;
  private camera: PerspectiveCamera | null = null;
  /** STEADY HORIZON: eased follow fractions + the smoothed camera translation (mission-local u) */
  private fx = -1;
  private fy = -1;
  private cx = 0;
  private cy = 0;
  /** camera collision: 0 = the full rig .. 1 = the reduced rig */
  private tight = 0;
  private primed = false;
  /** offset scale for the flown ship's size (RIGS.refLength) */
  scale = 1;

  constructor(readonly mode: 'third' | 'chase') {}

  attach(camera: Camera, target: Object3D): void {
    this.target = target;
    this.camera = (camera as PerspectiveCamera).isPerspectiveCamera ? (camera as PerspectiveCamera) : null;
    this.primed = false;
    this.tight = 0;
  }

  update(dt: number): void {
    const t = this.target;
    if (!t) return;
    const R = RIGS[this.mode], A = CAMERA_ATTACH, S = A.steady, f = rigFlight, k = this.scale;
    const o = t.parent ? t.parent.position : _zero; // mission frame origin
    const sx = t.position.x, sy = t.position.y;
    const w = f.attach;
    // ---- boom geometry (collision pulls it in: distance + height only)
    const up = (R.offset[1] + (A.reduced.up - R.offset[1]) * this.tight) * k;
    const back = (R.offset[2] + (A.reduced.back - R.offset[2]) * this.tight) * k;
    const tilt = Math.atan2(up, R.lookDist + back);
    const tanV = Math.tan(((this.pose.fov || R.fov) * Math.PI) / 360), tanH = tanV * (this.camera?.aspect ?? 16 / 9);
    // the ship's depth along the view axis at rest -> frustum half-extents there (the follow formula)
    const depth = back * Math.cos(tilt) + up * Math.sin(tilt);
    const W = depth * tanH, H = depth * tanV;
    // ---- STEADY HORIZON: follow from the measured free space on the ship's side (no world: the envelope)
    const world = f.freeL > 0 || f.freeR > 0;
    const freeX = world ? (sx >= 0 ? f.freeR : f.freeL) : f.envA;
    const freeY = world ? (sy >= 0 ? f.freeUp : f.freeDown) : f.envB;
    const fx = clamp(1 - (S.edge * W) / Math.max(1, Math.min(freeX, S.cap)), S.min, S.max);
    const fy = clamp(1 - (S.edge * H) / Math.max(1, Math.min(freeY, S.cap)), S.min, S.max);
    if (!this.primed) {
      this.fx = fx;
      this.fy = fy;
    }
    const ef = 1 - Math.exp(-dt / S.tau);
    this.fx += (fx - this.fx) * ef;
    this.fy += (fy - this.fy) * ef;
    // frame keep, solved exactly for the tilted boom: a ship dy above the camera's base sits at
    // NDC y = ((dy - up) cos t + back sin t) / (tanV (back cos t - (dy - up) sin t)), and its depth (so its
    // lateral band) shrinks as it rises
    const ct = Math.cos(tilt), st = Math.sin(tilt);
    const dyAt = (e: number) => up + (back * (e * tanV * ct - st)) / (ct + e * tanV * st);
    const dyHi = dyAt(S.keep), dyLo = dyAt(-S.keep);
    const kx = S.keep * tanH * Math.max(0.2 * back, back * ct - (sy - this.cy - up) * st);
    const keepX = (v: number) => clamp(v, sx - kx, sx + kx);
    const keepY = (v: number) => clamp(v, sy - dyHi, sy - dyLo);
    const tx = keepX(sx * this.fx), ty = keepY(sy * this.fy);
    if (!this.primed) {
      this.cx = tx;
      this.cy = ty;
    }
    const kp = 1 - Math.exp(-dt / R.posLag);
    this.cx = keepX(this.cx + (tx - this.cx) * kp);
    this.cy = keepY(this.cy + (ty - this.cy) * kp);
    // ---- FULLY ATTACHED: the boom turns with the ship (rigid: no lag, the attitude is already sprung)
    const strength = f.reduceMotion ? Math.min(f.rollStrength, RIGS.reduceRoll) : f.rollStrength;
    _e.set(w * f.pitch, w * f.yaw, w * (f.bank * strength + f.roll * A.rollShare * (f.reduceMotion ? 0 : 1)), 'YXZ');
    _q.setFromEuler(_e);
    const bx = o.x + this.cx + (sx - this.cx) * w, by = o.y + this.cy + (sy - this.cy) * w, bz = o.z + t.position.z;
    _boom.set(0, up, back).applyQuaternion(_q);
    const P = this.pose;
    P.pos.set(bx + _boom.x, by + _boom.y, bz + _boom.z);
    // ---- camera collision: test where the FULL rig would be; pull in / let go with hysteresis
    if (f.clearAt) {
      _full.set(0, R.offset[1] * k, R.offset[2] * k).applyQuaternion(_q);
      const c = Math.min(f.clearAt(bx + _full.x - o.x, by + _full.y - o.y, bz + _full.z - o.z), f.clearAt(P.pos.x - o.x, P.pos.y - o.y, P.pos.z - o.z));
      const want = c < A.clearance + A.collide.in ? 1 : c > A.clearance + A.collide.out ? 0 : this.tight > 0.5 ? 1 : 0;
      this.tight += (want - this.tight) * (1 - Math.exp(-dt / A.collide.tau));
    }
    // ---- orientation: boom, look-down tilt, cosmetic bend sway (capped in steady), opt-in look-ahead
    const sway = f.reduceMotion ? 0.3 : 1;
    // (attached: the roll is exactly bank x strength; steady: the cosmetic bend sway only, <= 2 deg)
    const swayRoll = clamp(f.swayBank * sway, -S.swayMax, S.swayMax) * (1 - w);
    let laYaw = 0, laPitch = 0;
    if (rigAim.lookAhead) {
      const C = PLAYER.aim.convergence, L = R.lookDist + back;
      laYaw = -Math.atan2(Math.tan(rigAim.yaw) * C * R.lookAhead, L);
      laPitch = Math.atan2(Math.tan(rigAim.pitch) * C * R.lookAhead, L);
    }
    _e.set(laPitch - tilt, laYaw, swayRoll, 'YXZ');
    _r.setFromEuler(_e);
    P.quat.copy(_q).multiply(_r);
    P.focus.copy(t.position).add(o);
    const base = R.fov * (useSettings.getState().camera.fov / RIGS.fovBase);
    P.fov = base + fovKick.value;
    this.primed = true;
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
