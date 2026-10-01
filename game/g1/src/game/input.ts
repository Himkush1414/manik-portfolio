// What the sim consumes each fixed step (brief §7). Produced by the DOM
// InputManager (human) or the bot; the sim never reads devices itself.
// Aim = reticle offset from ship forward, in radians (yaw right +, pitch up +),
// already clamped to the aim cone by the producer.

export type SimInput = {
  /** keyboard axes -1..1 */
  moveX: number;
  moveY: number;
  aimYaw: number;
  aimPitch: number;
  /** mouse fine positioning active (reticle offset steers the ship) */
  aimSteer: boolean;
  fire: boolean;
  boost: boolean;
  brake: boolean;
  /** edge-triggered: -1 left, +1 right, 0 none (latched by the producer until consumed) */
  roll: -1 | 0 | 1;
};

export function emptyInput(): SimInput {
  return { moveX: 0, moveY: 0, aimYaw: 0, aimPitch: 0, aimSteer: false, fire: false, boost: false, brake: false, roll: 0 };
}

export function copyInput(src: SimInput, dst: SimInput): SimInput {
  dst.moveX = src.moveX;
  dst.moveY = src.moveY;
  dst.aimYaw = src.aimYaw;
  dst.aimPitch = src.aimPitch;
  dst.aimSteer = src.aimSteer;
  dst.fire = src.fire;
  dst.boost = src.boost;
  dst.brake = src.brake;
  dst.roll = src.roll;
  return dst;
}
