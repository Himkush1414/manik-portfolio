// Fixed-step clock (brief §3): the sim always advances in exact 1/60 s
// steps; the renderer interpolates between the last two states with `alpha`.
// Accumulator with a spiral-of-death guard (max steps per frame) and a frame
// clamp (tab switches / breakpoints resync instead of fast-forwarding).
// Time scale (hit-stop, slow-mo) stretches REAL time before it is fed in —
// presentation only: the headless balance harness steps the sim directly.
import { SIM } from '../../data/mission';

export const STEP = 1 / SIM.hz;

export class FixedStepper {
  acc = 0;
  /** 0..1: how far the render frame sits between the previous and current sim state */
  alpha = 0;
  /** steps dropped by the spiral guard (QA) */
  dropped = 0;

  /** How many sim steps to run for a frame of `frameDt` real seconds at `timeScale`. */
  advance(frameDt: number, timeScale = 1): number {
    const dt = Math.min(Math.max(0, frameDt), SIM.dtClamp) * timeScale;
    this.acc += dt;
    // epsilon: 0.5 + 0.5 steps of float error must still count as one full step
    let n = Math.floor(this.acc / STEP + 1e-7);
    if (n > SIM.maxSteps) {
      this.dropped += n - SIM.maxSteps;
      n = SIM.maxSteps;
      this.acc = STEP * n + (this.acc % STEP); // keep the phase, drop the backlog
    }
    this.acc = Math.max(0, this.acc - n * STEP);
    this.alpha = Math.min(1, this.acc / STEP);
    return n;
  }

  /** after a pause / retry: no backlog, no interpolation */
  resync(): void {
    this.acc = 0;
    this.alpha = 0;
  }
}
