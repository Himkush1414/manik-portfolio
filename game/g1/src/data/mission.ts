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

/** Terrain contact (Control/Camera/Boundary addendum §3 "THE MOUNTAIN IS THE WALL"): no invisible limit
 *  anywhere — the boundary is the terrain itself. Swept sphere vs the heightfield (a ring of samples +
 *  the gradient normal), two wing-tip spheres; push out along the contact normal and SLIDE (velocity
 *  projected onto the tangent plane). Scraping costs shield first; a head-on impact costs more and
 *  bounces. Never an instakill, never a clip. */
export const CONTACT = {
  /** hurtbox vs terrain (u) and the wing-tip spheres */
  hullR: 1.8,
  wingR: 1.2,
  /** ring samples around the hull sphere (>= 8) */
  ring: 8,
  /** sub-steps: motion per sub-step at most this x hullR (no tunnelling at boost) */
  sweep: 0.8,
  /** closing speed along the normal (u/s) above which a contact is an impact, and its damage range */
  impactAt: 12,
  impactMin: 6,
  impactMax: 25,
  /** closing speed that maps to impactMax */
  impactFull: 70,
  /** restitution along the normal (30 % bounce), hull immunity after an impact (s) */
  bounce: 0.3,
  impactImmunity: 0.6,
  /** scraping (sliding contact faster than scrapeSpeed u/s): damage per second, applied every scrapeTick s */
  scrapeSpeed: 8,
  scrapeDps: 3,
  scrapeTick: 0.25,
  /** an impact never drops forward speed below this share of cruise */
  minSpeedShare: 0.35,
  /** water: splash + drag (per second) + damage (once per waterCd s) + upward bounce (u/s) */
  waterDrag: 1.6,
  waterDamage: 8,
  waterCd: 1,
  waterBounce: 18,
  /** camera never closer than this to a surface (u) */
  cameraClearance: 2,
  /** QA: lateral free-space scan step and cap (u) */
  scanStep: 3,
  scanMax: 240,
} as const;

/** Diegetic ceilings (addendum §3): ridge turbulence below a canyon rim, a cloud deck over open sky. No
 *  wall: climb authority fades to zero over `zone` u, air shear shakes the ship, above the deck a
 *  downdraft forces it back down (whiteout + lightning on screen). */
export const CEILING = {
  /** turbulence zone below the ceiling (u) */
  zone: 30,
  /** lateral shear (u/s^2 at full turbulence) */
  shear: 55,
  /** above the cloud deck: downdraft (u/s^2) + per u of penetration */
  downdraft: 30,
  downdraftPerU: 3,
  /** default cloud deck above the path line: max(k x design envelope half-height, min) (u) */
  deckK: 2.4,
  deckMin: 90,
  /** the cloud base: whiteout from this many u below the deck (full at the deck) */
  deckFog: 12,
  /** a rim is measured from the walls' tops within this many u beyond the wall face */
  rimProbe: [6, 24, 48] as const,
} as const;

/** Feel of terrain contact + ceilings (addendum §3): camera trauma per event, sustained rumble levels
 *  (added to the world's gust rumble), the HUD's close-call callout life (s). */
export const FLIGHT_FX = {
  /** impact trauma = impactTrauma x damage / CONTACT.impactMax; a scrape tick / splash */
  impactTrauma: 0.7,
  scrapeTrauma: 0.1,
  splashTrauma: 0.3,
  /** sustained rumble while in contact / at full turbulence */
  contactRumble: 0.5,
  turbRumble: 0.75,
  /** impact louder than this share of impactMax = the heavy voice */
  heavyAt: 0.5,
  calloutLife: 0.9,
} as const;

/** The HUD's flight layer (scenes/mission/hudFlight.ts): TURBULENCE fades in from `alertFrom` over
 *  `alertRamp` and pulses above `pulseAt`; the cloud-deck whiteout reaches `whiteout` opacity; lightning
 *  inside the deck (above `lightningFrom` of it) at `lightningRate` / s, `lightningLife` s; the close-call
 *  callout rises `calloutRise` px; the skim / wall-run streak shows after `streakFrom` s. */
export const HUD_FLIGHT = {
  alertFrom: 0.2,
  alertRamp: 0.3,
  pulseAt: 0.7,
  whiteout: 0.92,
  lightningFrom: 0.35,
  lightningRate: 0.9,
  lightningLife: 0.14,
  calloutRise: 70,
  streakFrom: 0.6,
} as const;

/** Terrain helpers kept from Phase 2R §5 for the camera + scoring. */
export const GROUND = {
  /** camera never closer to the ground than this (u) */
  cameraClearance: 2,
} as const;

/** Envelope half-width a / half-height b (u) per landscape archetype — DESIGN TARGETS and validator inputs
 *  only (addendum §3: no invisible limit; the terrain is the boundary). The lateral speed is tuned from
 *  a (wide chapters fly faster sideways); C1 builds real walls at these distances. */
export const ENVELOPES = {
  plains: { a: 70, b: 38 },
  river: { a: 56, b: 32 },
  foothills: { a: 48, b: 30 },
  forest: { a: 34, b: 22 },
  gorge: { a: 26, b: 18 },
  slot: { a: 12, b: 18 },
  pass: { a: 60, b: 45 },
  reveal: { a: 60, b: 45 },
  arena: { a: 60, b: 34 },
} as const;
export type EnvelopeArchetype = keyof typeof ENVELOPES;

/** Freedom of flight (Creative Bible §2). */
export const FREEDOM = {
  /** lateral speed = clamp(k a, min, max) x AGI factor (u/s) */
  lateral: { k: 1.1, min: 30, max: 80 },
  /** AGI factor = ship lateral stat / agiRef (the starter ship, AGI 6, flies at 1.1) */
  agiRef: 25.1,
  /** time to reach full lateral speed / to stop from it (s) */
  accelTime: 0.16,
  stopTime: 0.12,
  /** KEYBOARD + MOUSE steering: critically damped pull toward the cursor target (rad/s); the target stays
   *  this far inside the measured free space (u) so it never scrapes by accident */
  omega: 16,
  targetInset: 4,
  /** close calls (AC9.6): rock within this clearance (u, from the hull underside / the outermost point)
   *  without scraping; bolt within this miss distance */
  closeRock: 3,
  closeBolt: 3,
  closeCooldown: 1.2,
  closeScore: 50,
  closeShield: 3,
  /** skim (below this clearance over the ground) and wall-run (a wall within `wallProbe` u of the outermost
   *  point at ship altitude): score per second */
  skimAt: 9,
  wallProbe: 4.5,
  skimScore: 40,
} as const;

/** Rail frame (brief §5; Phase 2R: the rail follows the world's flight path). */
export const RAIL = {
  /** design envelope without a world path (unit tests, SimLab): tunes the lateral speed only */
  envelope: { a: 18, b: 10.5 },
  arenaEnvelope: ENVELOPES.arena,
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
    /** the reticle spans the whole screen (AC2.2): the cone only bounds bots / tests */
    coneX: 72 * DEG,
    coneY: 58 * DEG,
    convergence: 120,
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

/** Input feel (brief §7; Control / Camera / Boundary addendum: the mouse moves only the reticle). */
export const INPUT = {
  /** screen px the reticle moves per mouse count at sensitivity 1 */
  cursorPxPerCount: 1.25,
  /** a single pointer-locked motion event larger than this (counts, either axis) is a browser glitch
   *  (Chrome's known movementX spikes; headless screenshots), never a hand: dropped */
  spikeCounts: 500,
  /** the reticle spans the whole screen with a 2 % margin (NDC bound) */
  reticleEdge: 0.96,
  /** KEYBOARD + MOUSE steering: keys nudge the reticle (NDC per second) */
  keyCursorRate: 1.5,
  /** optional reticle auto-centre: idle delay (s) and rate (1/s) */
  cursorIdle: 1.2,
  cursorRecenter: 1.6,
} as const;

/** Camera rigs (brief §8). Offsets in ship space (x right, y up, z = behind). How a rig follows the ship
 *  is the settings ATTACHMENT (CAMERA_ATTACH below): rigid mount, or a steady horizon that follows a
 *  computed share of the ship's offset so it visibly sweeps the screen. */
export const RIGS = {
  third: { offset: [0, 3.2, 12] as const, fov: 70, posLag: 0.08, lookAhead: 0.25, lookDist: 60 },
  chase: { offset: [0, 1.6, 6.5] as const, fov: 78, posLag: 0.04, lookAhead: 0.3, lookDist: 50 },
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
  /** reduce-motion: camera roll strength at most this fraction (brief §18, addendum) */
  reduceRoll: 0.3,
  /** cosmetic tunnel curvature: look-point sway toward the bend ahead + bank into it */
  sway: { look: 0.6, bankPerCurv: 80, maxBank: 4 * DEG },
} as const;

/** Camera attachment (Control / Camera / Boundary addendum), every rig, blended over `blend` s.
 *  FULLY ATTACHED (default): a rigid mount — follow 1.0, the ship holds its spot on screen; the camera
 *  takes the ship's pitch + nose yaw and rolls with its bank x roll strength (the lateral bank is capped
 *  at `bankMax` in this mode), `rollShare` of a barrel roll; the cockpit view rolls whole.
 *  STEADY HORIZON: the camera translates with the ship and never rolls / pitches / yaws (<= `swayMax` of
 *  cosmetic sway); the ship banks alone up to FEEL.bankMax; follow = clamp(1 - edge W / min(free, cap),
 *  min, max) laterally (H vertically), W / H the frustum half-extents at the ship's depth, `free` the
 *  measured free space on the ship's side; the ship never leaves `keep` of the half-screen; cockpit: the
 *  eye stays level, the shell / hands / dash roll around the view up to `interiorRoll`.
 *  Camera COLLISION changes distance / height only, never lateral: within `clearance` (+ margin) of
 *  terrain the follow rigs pull in to the reduced rig (`reduced`, x ship scale). */
export const CAMERA_ATTACH = {
  blend: 0.5,
  bankMax: 40 * DEG,
  rollShare: 0.4,
  steady: { edge: 0.85, cap: 60, min: 0.35, max: 0.9, keep: 0.9, tau: 0.35, swayMax: 2 * DEG, interiorRoll: 25 * DEG },
  reduced: { up: 1.6, back: 8 },
  clearance: 2,
  /** pull in below clearance + in, let go above clearance + out (hysteresis), eased over tau s */
  collide: { in: 1.5, out: 5, tau: 0.15 },
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

/** Mission DOM HUD (brief §9): danger threshold for the shield / hull pulse, hit / kill marker life (s),
 *  threat chevron ring radius (u = 1/1080 of the design height), reticle / pipper projection distance
 *  (the guns' convergence, PLAYER.aim.convergence). */
export const HUD = {
  danger: 0.25,
  hitLife: 0.12,
  killLife: 0.4,
  threatRing: 150,
  /** speed readout: u/s x this = the displayed number */
  speedScale: 10,
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

/** Cockpit dash light in the mission (placed on the eye each frame while the interior shows; the
 *  world sun lights the rest): position in cockpit-root space, intensities as in Phase 1. */
export const COCKPIT_LIGHTS = {
  dash: [0, -0.12, -0.7] as const,
  dashBase: 0.15,
  dashPower: 0.3,
} as const;

/** Ship attitude feel (brief §7 VISUALS: bank -k vx, pitch k vy; addendum: the reticle never turns the ship).
 *  A critically-damped-ish spring (zeta < 1: a hint of overshoot = mass) toward targets built
 *  from the interpolated lateral velocity plus a lead from lateral acceleration, so a key tap
 *  banks before the velocity has built up. */
export const FEEL = {
  /** Creative Bible AC2.7: +-70 deg, reached in ~0.18 s, nose into the motion */
  bankMax: 70 * DEG,
  pitchMax: 15 * DEG,
  /** extra bank / pitch per (u/s^2) of lateral acceleration, capped by the max */
  bankLead: 0.0032,
  pitchLead: 0.0015,
  /** the nose also yaws a little into lateral motion */
  yawFromVx: 12 * DEG,
  spring: { omega: 19, zeta: 0.74 },
  /** acceleration estimate smoothing (s) */
  accelTau: 0.05,
  /** barrel roll visual: eased (front-loaded like the impulse), full turn */
  rollEase: 1.6,
  /** idle life: tiny bob + roll noise in the corridor's turbulence (reduce-motion: 25 %) */
  wobble: { amp: 0.06, rollDeg: 0.8, pitchDeg: 0.35, hz: [0.37, 0.61, 0.83] as const },
  /** shudder while the hull is in terrain contact (s of decay) */
  graze: { kick: 2.2 * DEG, decay: 0.12 },
} as const;

/** Mission view (Phase 2R): camera range for the world pass + the interim haze (W2's aerial
 *  perspective + sky dome replace the linear fog colour). */
export const MISSION_VIEW = { near: 0.25, far: 6500, fogNear: 600, fogFar: 5600 } as const;

/** Launch sequence (brief §14 LAUNCH SEQUENCE), seconds / u / deg. */
export const LAUNCH = {
  countdown: 1.0, // per digit (3, 2, 1)
  catapult: 3.3, // clamps release -> gate
  /** launch-tunnel travel at the flash (cockpit-local u): the bay mouth is at 84 */
  travel: 350,
  fovPunch: 16,
  flash: 7,
  flashIn: 0.22,
  flashOut: 0.7,
  /** retries: the fast relaunch inside the corridor */
  fast: 1.6,
  /** standby -> automatic LAUNCH after this beat (s); Esc / RETURN TO HANGAR cancels it */
  standbyBeat: 2.4,
  stripStretch: 0.09,
  /** sky sphere radius (inside the 1000 u far plane) and the bay mouth (travel at which the window plane hides) */
  skyRadius: 860,
  mouthTravel: 80,
} as const;
