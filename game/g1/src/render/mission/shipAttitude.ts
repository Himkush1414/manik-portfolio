// The flown ship's visual attitude (brief §7 VISUALS) — presentation only,
// the sim never reads it. Springs (data/mission.ts FEEL) pull bank / pitch /
// yaw toward targets made from the lateral velocity, a lead from lateral
// acceleration (a key tap banks before the velocity builds; a release swings
// through a small counter-bank = mass) and terrain contact (shudder while the
// hull scrapes / slides). The reticle never moves the ship (Control / Camera /
// Boundary addendum): the nose yaws into the MOTION only. The barrel roll
// is a front-loaded eased full turn matching the sim's decaying impulse.
// Plain numbers in, plain numbers out: unit-testable, no allocation.
import { FEEL } from '../../data/mission';
import { Quaternion, Vector3 } from 'three';
import { rollAngle } from './rollProfile';

const _qa = new Quaternion(), _qb = new Quaternion();
const _AX = new Vector3(1, 0, 0), _AY = new Vector3(0, 1, 0), _AZ = new Vector3(0, 0, 1);
/** q = yaw(Y) * pitch(X) * bank(Z) * roll(Z, LOCAL forward): the barrel roll composed last, in the ship's
 *  own frame, by quaternion multiplication (Planet 1 §1.2) — never an Euler lerp */
export function composeAttitude(q: Quaternion, yaw: number, pitch: number, bank: number, roll: number): Quaternion {
  return q.setFromAxisAngle(_AY, yaw).multiply(_qa.setFromAxisAngle(_AX, pitch)).multiply(_qb.setFromAxisAngle(_AZ, bank)).multiply(_qa.setFromAxisAngle(_AZ, roll));
}

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const SUB = 1 / 120;

export class ShipAttitude {
  bank = 0;
  pitch = 0;
  yaw = 0;
  /** barrel roll angle (rad), added to bank */
  roll = 0;
  /** vertical bob (u) */
  bob = 0;
  /** output-only noise (kept apart so the springs never integrate it) */
  noiseBank = 0;
  noisePitch = 0;
  private bankV = 0;
  private pitchV = 0;
  private yawV = 0;
  private vx0 = 0;
  private vy0 = 0;
  /** lateral bank cap (rad): FEEL.bankMax, less while the camera is FULLY ATTACHED (it rolls with the
   *  bank: CAMERA_ATTACH.bankMax) — set by the mission loop */
  bankLimit: number = FEEL.bankMax;
  /** smoothed lateral acceleration (u/s^2): cockpit head inertia reads it */
  ax = 0;
  ay = 0;
  private shudder = 0;
  private t = 0;
  private primed = false;

  reset(): void {
    this.bank = this.pitch = this.yaw = this.roll = this.bob = 0;
    this.bankV = this.pitchV = this.yawV = 0;
    this.ax = this.ay = 0;
    this.shudder = 0;
    this.primed = false;
  }

  /**
   * dt: render seconds (time-scaled); vx / vy: lateral velocity (u/s); lat: max lateral speed;
   * rollT: seconds into the roll (-1 = none), rollDur, rollDir; contact: terrain contact this step
   * (0..1, sim player.contact); life: wobble scale (1, 0.25 reduce-motion, 0 off).
   */
  update(dt: number, vx: number, vy: number, lat: number, rollT: number, rollDur: number, rollDir: number, contact: number, life: number): void {
    if (dt <= 0) return;
    this.t += dt;
    if (!this.primed) {
      this.vx0 = vx;
      this.vy0 = vy;
      this.primed = true;
    }
    // lateral acceleration estimate (velocity changes in 60 Hz steps: smooth it)
    const k = 1 - Math.exp(-dt / FEEL.accelTau);
    this.ax += ((vx - this.vx0) / dt - this.ax) * k;
    this.ay += ((vy - this.vy0) / dt - this.ay) * k;
    this.vx0 = vx;
    this.vy0 = vy;
    const nx = lat > 0 ? vx / lat : 0, ny = lat > 0 ? vy / lat : 0;
    const bMax = this.bankLimit * 1.15, pMax = FEEL.pitchMax * 1.15;
    const bankT = clamp(-(nx * this.bankLimit + this.ax * FEEL.bankLead), bMax);
    const pitchT = clamp(ny * FEEL.pitchMax + this.ay * FEEL.pitchLead, pMax);
    const yawT = nx * FEEL.yawFromVx;
    // springs, sub-stepped (stable for any frame time up to the 0.1 s clamp)
    const w = FEEL.spring.omega, z = FEEL.spring.zeta;
    for (let left = dt; left > 1e-6; left -= SUB) {
      const h = Math.min(SUB, left);
      this.bankV += (w * w * (bankT - this.bank) - 2 * z * w * this.bankV) * h;
      this.bank += this.bankV * h;
      this.pitchV += (w * w * (pitchT - this.pitch) - 2 * z * w * this.pitchV) * h;
      this.pitch += this.pitchV * h;
      const wy = w * 1.25;
      this.yawV += (wy * wy * (yawT - this.yaw) - 2 * wy * this.yawV) * h;
      this.yaw += this.yawV * h;
    }
    // barrel roll (Planet 1 §1.2): an explicit angle 0 -> 2 pi about the local forward axis (wind-up /
    // spin / settle profile), unwrapped while it runs; 2 pi == 0, so its end is no snap
    this.roll = rollT >= 0 && rollDur > 0 ? rollAngle(rollT, rollDur, -rollDir) : 0;
    // life: bob + roll / pitch noise (three incommensurate sines), shudder while in terrain contact
    const W = FEEL.wobble, t = this.t;
    const s1 = Math.sin(t * TAU * W.hz[0]), s2 = Math.sin(t * TAU * W.hz[1] + 1.7), s3 = Math.sin(t * TAU * W.hz[2] + 4.1);
    this.bob = W.amp * life * (0.6 * s1 + 0.4 * s3);
    this.shudder = Math.max(this.shudder * Math.exp(-dt / FEEL.graze.decay), Math.min(1, contact) * FEEL.graze.kick);
    const shake = this.shudder * Math.sin(t * 47) * Math.max(0.25, life);
    this.noiseBank = (W.rollDeg * DEG * (0.55 * s2 + 0.45 * s1) * life) + shake;
    this.noisePitch = W.pitchDeg * DEG * (0.5 * s3 + 0.5 * s2) * life;
  }
}

function clamp(v: number, lim: number): number {
  return v > lim ? lim : v < -lim ? -lim : v;
}
