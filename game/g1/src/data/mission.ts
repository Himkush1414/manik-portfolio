// Mission tunables (brief §4, §5, §7, §10). The sim (src/game) and the
// mission renderer read every number from here — no magic numbers elsewhere.
// Units: 1 u = 1 m, seconds, u/s. Angles in radians unless named *Deg.

const DEG = Math.PI / 180;

/** Fixed-step simulation (brief §3). */
export const SIM = {
  hz: 60,
  /** spiral-of-death guard: at most this many steps per rendered frame */
  maxSteps: 5,
  /** a frame delta above this (tab switch, breakpoint) is clamped and the accumulator resynced */
  dtClamp: 0.1,
  /** the HUD bus refreshes every N steps (60 / 3 = 20 Hz) */
  hudEvery: 3,
} as const;

/** Live-entity caps (brief §4). Pools are allocated once at these sizes. */
export const CAPS = {
  playerBullets: 256,
  enemyBullets: 192,
  enemies: 40,
  capital: 1,
  drones: 12,
  hazards: 96,
  pickups: 24,
  debris: 128,
  healthBars: 48,
  events: 2048,
  threats: 8,
} as const;

/** Rail frame + tunnel (brief §5). */
export const RAIL = {
  tunnelRadius: 46,
  envelope: { a: 18, b: 10.5 },
  arenaEnvelope: { a: 24, b: 14 },
  /** soft boundary: spring-back acceleration per unit of overshoot (ellipse-normalised) */
  envelopeSpring: 340,
  /** a graze-spark event at most this often while pressing the boundary */
  grazeEvery: 0.18,
  /** overshoot beyond the ellipse before the spring saturates (normalised) */
  envelopeSoft: 0.12,
  /** enemies emerge from the haze here (d ahead of the player) */
  spawnAhead: 300,
  /** anything this far behind the player is recycled */
  despawnBehind: 40,
} as const;

/** Player flight + weapons (brief §5, §7). Stat formulas live in data/stats.ts. */
export const PLAYER = {
  hurtRadius: 1.6, // vs projectiles
  hazardRadius: 2.4, // vs hazards
  accel: 120,
  /** decel is max(accel, lateralSpeed / stopTime) */
  stopTime: 0.18,
  /** forward speed eases toward its target at this rate (1/s) */
  speedResponse: 2.6,
  boost: { base: 1.25, perSpd: 0.03, energy: 100, drain: 40, regen: 18, regenDelay: 1.0, lockout: 1.5 },
  brake: 0.65,
  roll: { duration: 0.55, impulse: 6, iframeFrom: 0.1, iframeTo: 0.4, cooldown: 1.1 },
  /** hull-damage immunity after any hit (no chain deaths) */
  hullImmunity: 0.6,
  aim: {
    coneX: 22 * DEG,
    coneY: 14 * DEG,
    convergence: 120,
    /** mouse fine positioning: 15 % of the reticle offset (at convergence) becomes a lateral target */
    steer: 0.15,
    steerTau: 0.25,
    /** visual: nose yaws 30 % toward the reticle */
    noseYaw: 0.3,
  },
  bullet: { speed: 380, range: 320, radius: 0.35 },
  /** cannon muzzles (ship-local, x right / y up / z forward), alternating */
  muzzles: [
    [-2.1, -0.15, 3.2],
    [2.1, -0.15, 3.2],
  ] as const,
  shield: { regen: 22, delay: 2.2, delayPerTier: 0.05 },
  magnet: 14,
  pickupRadius: 2.2,
} as const;

/** Aim assist tiers (brief §7): bullet steering limit + acquisition cone (deg). */
export const AIM_ASSIST = {
  off: { steerDeg: 0, coneDeg: 0, magnet: 0 },
  low: { steerDeg: 4, coneDeg: 3, magnet: 0.12 },
  med: { steerDeg: 5, coneDeg: 3, magnet: 0.22 },
  high: { steerDeg: 6, coneDeg: 3, magnet: 0.34 },
} as const;
export type AimAssist = keyof typeof AIM_ASSIST;

/** Time scale (brief §5): hit-stop / slow-mo, real seconds. Presentation only — the sim always steps at SIM.hz. */
export const TIME_SCALE = {
  hitStop: { big: 0.04, subsystem: 0.08, phaseBreak: 0.12, hullHit: 0.03 },
  death: { scale: 0.3, duration: 1.4 },
  bossDeath: { scale: 0.35, duration: 1.2 },
  complete: { scale: 0.5, duration: 1.0 },
  phaseBreak: { scale: 0.5, duration: 0.6 },
} as const;

/** Damage model (brief §10). */
export const DAMAGE = {
  collision: { pebble: 3, rock: 8, boulderMin: 18, boulderMax: 30 },
  /** knockback impulse (u/s) applied away from a hazard on impact */
  knockback: 14,
  /** repair-kit drop chance multiplier when hull < 40 % */
  lowHullRepairBoost: 2.2,
  lowHull: 0.25,
} as const;

/** Combo + scoring (brief §10). */
export const SCORING = {
  comboWindow: 3,
  comboStep: 0.25,
  comboMax: 4,
  accuracyBonus: 2000, // x accuracy (0..1)
  noDamageBonus: 3000,
  timeBonusPerSecUnder: 25,
} as const;

/** Attack tokens + fairness (brief §11). */
export const FAIRNESS = {
  /** pre-fire tell (muzzle glow + sound) */
  tell: 0.35,
  /** minimum aim error of any enemy shot (rad) */
  minAimError: 2.2 * DEG,
  /** every lethal (non-orb) attack telegraphs at least this long */
  lethalTelegraph: 0.8,
  /** enemies never fire from closer than this (d) or from behind */
  minFireDepth: 18,
} as const;

/** Input feel (brief §7). */
export const INPUT = {
  /** reticle radians per mouse count at sensitivity 1 (full cone width ~ 600 counts) */
  radPerCount: 0.00065,
  /** mouse idle this long -> the reticle eases back to centre (keyboard play) */
  idleRecenter: 0.8,
  /** recentre rate (1/s, exponential) */
  recenterRate: 3.2,
  /** settings smoothing 0..1 maps to this aim time constant (s) */
  smoothingTau: 0.09,
  /** fine positioning (reticle steers the ship) only while the mouse moved this recently */
  steerActive: 0.8,
} as const;

/** Camera rigs (brief §8). Offsets in ship space (x right, y up, z = behind).
 *  follow: fraction of the ship's lateral offset the camera follows (< 1: the ship visibly moves
 *  across the screen, the tunnel does not swing 1:1 — Star Fox readability).
 *  roll: camera roll per radian of ship bank (x the settings roll coupling; reduce-motion caps it). */
export const RIGS = {
  third: { offset: [0, 3.2, 12] as const, fov: 70, posLag: 0.08, rotLag: 0.12, lookAhead: 0.25, lookDist: 60, follow: [0.84, 0.8] as const, roll: 0.2 },
  chase: { offset: [0, 1.6, 6.5] as const, fov: 78, posLag: 0.04, rotLag: 0.07, lookAhead: 0.3, lookDist: 50, follow: [0.93, 0.9] as const, roll: 0.2 * 1.4 },
  cockpit: { fov: 82 },
  /** speed-line amount per view: the close chase camera reads speed harder (brief §8) */
  streakGain: { third: 1, chase: 1.3, cockpit: 1 },
  /** the settings FOV (default 75) scales every rig's base FOV */
  fovBase: 75,
  /** blend between rigs (s), never a hard cut */
  blend: 0.6,
  /** the brief's offsets assume a ~7.5 u fighter; ours are 11-17 u, so follow offsets scale by
   *  max(1, ship length / refLength) — the whole ship + wing tips stay in frame (deviation, logged) */
  refLength: 7.5,
  /** reduce-motion: camera roll coupling at most this fraction (brief §18) */
  reduceRoll: 0.3,
  /** cosmetic tunnel curvature: look-point sway toward the bend ahead + bank into it */
  sway: { look: 0.6, bankPerCurv: 900, maxBank: 4 * DEG },
} as const;

/** Cockpit rig (brief §8): head inertia (+-0.12 u lagging lateral acceleration), combiner focus,
 *  share of the speed FOV kick (the cockpit already reads speed through the canopy). */
export const COCKPIT_RIG = {
  headMax: 0.12,
  headPerAccel: 0.0011,
  headTau: 0.11,
  focusDist: 0.64,
  fovKickShare: 0.6,
} as const;

/** Cockpit hands (brief §8 COCKPIT): stick tilt with the stick input (rad at full deflection), throttle
 *  lever travel for boost / brake, recoil kick per shot, smoothing (s). Reduce-motion scales the recoil. */
export const COCKPIT_HANDS = {
  stickPitch: 0.2,
  stickRoll: 0.24,
  throttleBoost: 0.16,
  throttleBrake: 0.12,
  tau: 0.07,
  recoil: 0.035,
  recoilTau: 0.05,
  reduceRecoil: 0.3,
} as const;

/** Cockpit lights in the mission (the Phase 1 cockpit key + dash point, placed on the eye each
 *  frame while the interior shows): positions in cockpit-root space, intensities as in Phase 1. */
export const COCKPIT_LIGHTS = {
  key: [-1.2, 4.5, 3] as const,
  keyIntensity: 1.1,
  dash: [0, -0.12, -0.7] as const,
  dashBase: 0.15,
  dashPower: 0.3,
} as const;

/** Ship attitude feel (brief §7 VISUALS: bank -k vx, pitch k vy, nose yaw to the reticle 30 %).
 *  A critically-damped-ish spring (zeta < 1: a hint of overshoot = mass) toward targets built
 *  from the interpolated lateral velocity plus a lead from lateral acceleration, so a key tap
 *  banks before the velocity has built up. */
export const FEEL = {
  bankMax: 38 * DEG,
  pitchMax: 15 * DEG,
  /** extra bank / pitch per (u/s^2) of lateral acceleration, capped by the max */
  bankLead: 0.002,
  pitchLead: 0.0015,
  /** the nose also yaws a little into lateral motion */
  yawFromVx: 6 * DEG,
  spring: { omega: 14, zeta: 0.68 },
  /** acceleration estimate smoothing (s) */
  accelTau: 0.05,
  /** barrel roll visual: eased (front-loaded like the impulse), full turn */
  rollEase: 1.6,
  /** idle life: tiny bob + roll noise in the corridor's turbulence (reduce-motion: 25 %) */
  wobble: { amp: 0.06, rollDeg: 0.8, pitchDeg: 0.35, hz: [0.37, 0.61, 0.83] as const },
  /** shudder while the shield presses the envelope (s of decay) */
  graze: { kick: 2.2 * DEG, decay: 0.12 },
} as const;

/** Borrowed light rig in the mission frame (brief §4 rule 3; render/lightRig.ts). Offsets from MISSION_ORIGIN. */
export const MISSION_LIGHTS = {
  key: { pos: [8, 34, 95] as const, color: '#ffe8d9', intensity: 3.4, angle: 0.5, penumbra: 0.6 },
  target: [0, -2, -120] as const,
  /** core backlight: far ahead, shining back at the play space (rims on every silhouette) */
  rimA: { pos: [-34, 16, -430] as const, color: '#7B5BFF', intensity: 2.6, angle: 0.32, penumbra: 0.7 },
  rimB: { pos: [36, -12, -430] as const, color: '#7FD1FF', intensity: 2.0, angle: 0.32, penumbra: 0.7 },
  hemi: { sky: '#2a3168', ground: '#04050A', intensity: 0.4 },
  fog: { color: '#1A1F5C', near: 150, far: 520 },
} as const;

/** Launch sequence (brief §14 LAUNCH SEQUENCE), seconds / u / deg. */
export const LAUNCH = {
  countdown: 1.0, // per digit (3, 2, 1)
  catapult: 3.3, // clamps release -> gate
  /** launch-tunnel travel at the gate (cockpit-local u): mouth at 84, gate beyond */
  travel: 350,
  gateZ: -344,
  gateRadius: 57,
  fovPunch: 16,
  flash: 7,
  flashIn: 0.22,
  flashOut: 0.7,
  /** retries: the fast relaunch inside the corridor */
  fast: 1.6,
  stripStretch: 0.09,
  /** sky sphere radius (inside the 1000 u far plane) and the bay mouth (travel at which the window plane hides) */
  skyRadius: 860,
  mouthTravel: 80,
} as const;
