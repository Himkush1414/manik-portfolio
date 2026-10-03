// COCKPIT rig (brief §8): the Phase 1 interior flown inside the mission.
// The cockpit root (its interior, combiner, MFDs and the three mirror
// cameras) is placed on the flown ship's eye every frame. The eye adds head
// inertia (+-0.12 u, lagging lateral acceleration) and breathing. Eye FOV 82
// x the settings FOV / 75, + the shared speed kick.
// Camera attachment (Control / Camera / Boundary addendum, blended by
// rigFlight.attach): FULLY ATTACHED — the whole view rides the ship (pitch,
// nose yaw) and rolls with its bank x roll strength + the barrel roll, the
// interior rigid with it; STEADY HORIZON — the eye stays level on the path
// frame and the shell / hands / dash roll AROUND the view (bank x roll
// strength, <= 25 deg). Reduce-motion caps the roll strength at 30 % and
// never spins the view with the barrel roll (the ship still rolls, visible
// in the mirrors).
import { Euler, Quaternion, Vector3, type Camera, type Object3D } from 'three';
import type { CameraRig } from '../cameraRig';
import { RIGS, COCKPIT_RIG, CAMERA_ATTACH } from '../../data/mission';
import { useSettings } from '../../state/settings.store';
import { createPose, fovKick, rigFlight, type RigPose } from './rigState';
import { EYE_PITCH } from '../../scenes/cockpit/cockpitSpec';
import { cockpitInMission } from '../../scenes/sceneBridge';

const _e = new Vector3();
const _h = new Vector3();
const _q = new Quaternion();
const _root = new Quaternion();
const _shell = new Quaternion();
const _Z = new Vector3(0, 0, 1);
const _eu = new Euler(0, 0, 0, 'YXZ');
const _pitch = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), EYE_PITCH);
const _fwd = new Vector3();
const _w = new Vector3();

export class CockpitRig implements CameraRig {
  readonly mode = 'cockpit' as const;
  readonly pose: RigPose = createPose();
  private target: Object3D | null = null;
  /** eye in the attitude group's space (x right, y up, -z forward) */
  private eye = new Vector3(0, 1, 0);
  private hx = 0;
  private hy = 0;
  private t = 0;

  /** canopy eye point for the flown ship (from its spec) */
  setEye(x: number, y: number, z: number): void {
    this.eye.set(x, y, z);
  }

  attach(_camera: Camera, target: Object3D): void {
    this.target = target;
    this.hx = this.hy = 0;
  }

  update(dt: number): void {
    const t = this.target;
    if (!t) return;
    this.t += dt;
    const f = rigFlight;
    const reduce = f.reduceMotion;
    const w = f.attach;
    const strength = reduce ? Math.min(f.rollStrength, RIGS.reduceRoll) : f.rollStrength;
    // the view: ATTACHED rides the ship's attitude (bank x strength + the barrel roll), STEADY stays level
    const viewRoll = w * (f.bank * strength + (reduce ? 0 : f.roll));
    _eu.set(w * f.pitch, w * f.yaw, viewRoll, 'YXZ');
    _q.setFromEuler(_eu);
    // the interior: rigid with the view (ATTACHED) / rolling around it (STEADY, <= 25 deg)
    const lim = CAMERA_ATTACH.steady.interiorRoll;
    const shell = (1 - w) * Math.max(-lim, Math.min(lim, f.bank * strength));
    _root.copy(_q).multiply(_shell.setFromAxisAngle(_Z, shell));
    f.interiorRoll = viewRoll + shell;
    f.interiorPitch = w * f.pitch;
    // the eye point on the ship, carried by the view orientation (no swing in STEADY)
    _e.copy(this.eye).applyQuaternion(_q);
    t.getWorldPosition(_w);
    _e.add(_w);
    // head inertia: the head lags lateral acceleration (ship-local), critically smoothed
    const C = COCKPIT_RIG;
    const k = 1 - Math.exp(-dt / C.headTau);
    const wantX = clamp(-f.ax * C.headPerAccel, C.headMax), wantY = clamp(-f.ay * C.headPerAccel, C.headMax);
    this.hx += (wantX - this.hx) * k;
    this.hy += (wantY - this.hy) * k;
    // breathing + a whisper of head-bob (Phase 1 cockpit values)
    const tt = this.t;
    const bx = reduce ? 0 : Math.sin(tt * 0.9) * 0.0018 + Math.sin(tt * 2.3 + 1) * 0.0008;
    const by = reduce ? 0 : Math.sin(tt * Math.PI * 2 * 0.25) * 0.004 + Math.sin(tt * 1.7) * 0.001;
    _h.set(this.hx * (reduce ? 0.25 : 1) + bx, this.hy * (reduce ? 0.25 : 1) + by, 0).applyQuaternion(_q);
    const P = this.pose;
    P.pos.copy(_e).add(_h);
    P.quat.copy(_q).multiply(_pitch);
    // focus on the combiner (HUD text sharp)
    _fwd.set(0, 0, -1).applyQuaternion(P.quat);
    P.focus.copy(P.pos).addScaledVector(_fwd, C.focusDist);
    P.fov = RIGS.cockpit.fov * (useSettings.getState().camera.fov / RIGS.fovBase) + fovKick.value * C.fovKickShare;
  }

  /** Put the cockpit root on this frame's eye (the switcher calls it only while the interior shows:
   *  during a blend out, the outgoing rig still updates but must not drag the root along). */
  placeRoot(): void {
    const root = cockpitInMission.root;
    if (!root || !this.target) return;
    const parent = root.parent;
    root.position.copy(_e);
    if (parent) {
      parent.updateWorldMatrix(true, false);
      parent.worldToLocal(root.position);
    }
    root.quaternion.copy(_root);
    root.updateMatrixWorld();
  }

  detach(): void {
    this.target = null;
  }
}

function clamp(v: number, lim: number): number {
  return v > lim ? lim : v < -lim ? -lim : v;
}
