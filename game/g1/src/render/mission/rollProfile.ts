// The barrel roll's angle (Planet 1 §1.2): theta 0 -> 2 pi about the ship's LOCAL forward axis over the
// roll's duration, from a trapezoidal angular-speed profile — wind-up (accelerate over the first 8 %),
// spin (constant over 77 %), settle (decelerate over the last 15 %). Monotonic, C1-continuous, exactly
// 2 pi at the end (== 0: no snap when the roll hands back to the bank spring). Pure; unit-tested.
export const ROLL_PHASES = { windUp: 0.08, spin: 0.77, settle: 0.15 } as const;

const W = ROLL_PHASES.windUp, S = ROLL_PHASES.settle;
/** peak speed so the area under the trapezoid is 1 */
const VMAX = 1 / (W / 2 + ROLL_PHASES.spin + S / 2);

/** fraction of the turn done at normalised time u (0..1) */
export function rollFraction(u: number): number {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  if (u < W) return (VMAX * u * u) / (2 * W);
  const a = (VMAX * W) / 2;
  if (u < 1 - S) return a + VMAX * (u - W);
  const d = 1 - u;
  return 1 - (VMAX * d * d) / (2 * S);
}

/** roll angle (rad, signed by dir) at t seconds into a roll of `duration` s */
export function rollAngle(t: number, duration: number, dir: number): number {
  return dir * 2 * Math.PI * rollFraction(t / duration);
}
