// Cockpit hands (brief §8 COCKPIT): in the mission cockpit view the flight
// stick tilts with the stick input the sim consumed (pitch with moveY, roll
// with moveX), the throttle lever rides boost / brake, and each shot kicks
// the stick back a touch. Rotations of the pre-built cockpit groups only
// (fists ride along); smoothed toward the targets, put back when the view
// ends. Presentation only, no allocation.
import type { SimInput } from '../../game/input';
import { COCKPIT_HANDS as H } from '../../data/mission';
import { cockpitInMission } from '../sceneBridge';

export class CockpitHands {
  private sx = 0;
  private sz = 0;
  private thr = 0;
  private recoil = 0;
  private shots = -1;
  private applied = false;

  /** per frame; `shots` = the sim's shots-fired counter */
  update(dt: number, input: SimInput, shots: number, reduceMotion: boolean): void {
    const hands = cockpitInMission.hands;
    if (!cockpitInMission.on || !hands) {
      if (this.applied) this.reset();
      return;
    }
    this.applied = true;
    if (this.shots < 0) this.shots = shots;
    if (shots > this.shots) this.recoil = H.recoil * (reduceMotion ? H.reduceRecoil : 1);
    this.shots = shots;
    const k = 1 - Math.exp(-dt / H.tau);
    // pull back to climb (stick top toward the pilot = +x rotation), right roll = top to +x
    this.sx += (input.moveY * H.stickPitch - this.sx) * k;
    this.sz += (-input.moveX * H.stickRoll - this.sz) * k;
    const thrWant = input.boost ? -H.throttleBoost : input.brake ? H.throttleBrake : 0;
    this.thr += (thrWant - this.thr) * k;
    this.recoil *= Math.exp(-dt / H.recoilTau);
    hands.stick.rotation.set(this.sx + this.recoil, 0, this.sz);
    hands.throttle.rotation.x = this.thr;
  }

  /** the view ended / a new mission: hands back at rest */
  reset(): void {
    this.sx = this.sz = this.thr = this.recoil = 0;
    this.shots = -1;
    this.applied = false;
    const hands = cockpitInMission.hands;
    if (!hands) return;
    hands.stick.rotation.set(0, 0, 0);
    hands.throttle.rotation.x = 0;
  }
}
