// The flown ship's visual attitude (brief §7 VISUALS) — presentation only,
// the sim never reads it. Springs (data/mission.ts FEEL) pull bank / pitch /
// yaw toward targets made from the lateral velocity, a lead from lateral
// acceleration (a key tap banks before the velocity builds; a release swings
// through a small counter-bank = mass), the reticle (nose yaw 30 %) and the
// envelope (shudder while the shield presses the boundary). The barrel roll
// is a front-loaded eased full turn matching the sim's decaying impulse.
// Plain numbers in, plain numbers out: unit-testable, no allocation.
import { FEEL } from '../../data/mission';

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
   * aimYaw / aimPitch: reticle (rad); rollT: seconds into the roll (-1 = none), rollDur, rollDir;
   * press: how far past the envelope (0 = inside); life: wobble scale (1, 0.25 reduce-motion, 0 off).
   */
  update(dt: number, vx: number, vy: number, lat: number, aimYaw: number, aimPitch: number, rollT: number, rollDur: number, rollDir: number, press: number, life: number): void {
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
    const bMax = FEEL.bankMax * 1.15, pMax = FEEL.pitchMax * 1.15;
    const bankT = clamp(-(nx * FEEL.bankMax + this.ax * FEEL.bankLead), bMax);
    const pitchT = clamp(ny * FEEL.pitchMax + this.ay * FEEL.pitchLead, pMax) + aimPitch * 0.3;
    const yawT = aimYaw * 0.3 + nx * FEEL.yawFromVx;
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
    // barrel roll: eased like the impulse (fast start, soft finish)
    if (rollT >= 0 && rollDur > 0) {
      const u = Math.min(1, rollT / rollDur);
      this.roll = -rollDir * TAU * (1 - Math.pow(1 - u, FEEL.rollEase));
    } else this.roll = 0;
    // life: bob + roll / pitch noise (three incommensurate sines), shield shudder at the boundary
    const W = FEEL.wobble, t = this.t;
    const s1 = Math.sin(t * TAU * W.hz[0]), s2 = Math.sin(t * TAU * W.hz[1] + 1.7), s3 = Math.sin(t * TAU * W.hz[2] + 4.1);
    this.bob = W.amp * life * (0.6 * s1 + 0.4 * s3);
    this.shudder = Math.max(this.shudder * Math.exp(-dt / FEEL.graze.decay), Math.min(1, press * 8) * FEEL.graze.kick);
    const shake = this.shudder * Math.sin(t * 47) * Math.max(0.25, life);
    this.noiseBank = (W.rollDeg * DEG * (0.55 * s2 + 0.45 * s1) * life) + shake;
    this.noisePitch = W.pitchDeg * DEG * (0.5 * s3 + 0.5 * s2) * life;
  }
}

function clamp(v: number, lim: number): number {
  return v > lim ? lim : v < -lim ? -lim : v;
}
