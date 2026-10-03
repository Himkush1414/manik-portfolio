// Mission VFX tunables (brief §7 FIRE, §10 JUICE TABLE, §13). The renderers
// in render/mission/vfx read every number from here. Units: u (= m), s.
// HDR values > 1 are what bloom picks up (one tone-map stage: AgX).
import type { Preset } from '../render/quality';

/** Player pulse tracers: elongated, white-hot core, Ignition body (never round: orbs are hostile). */
export const TRACER = {
  length: 15,
  width: 0.56,
  /** HDR multipliers: core (white-hot) / body (Ignition). AgX desaturates bright HDR toward white:
   *  above ~2.5 the body read as white and the bolts looked like speed streaks — keep it orange */
  coreHdr: 4.2,
  bodyHdr: 2.4,
  /** gaussian falloffs across the width: body (wide, coloured) / core (thin, white) */
  bodyFalloff: 2.4,
  coreFalloff: 34,
  /** fade into the haze from here to the bolt range */
  fadeFrom: 200,
  fadeTo: 320,
} as const;

/** Enemy orbs: round Danger-violet with a white core (colour-independent cue: round vs elongated). */
export const ORB = {
  size: 1.5,
  coreHdr: 2.6,
  rimHdr: 1.15,
  pulseHz: 7,
} as const;

/** Muzzle flash (per cannon, on PlayerFire): a star quad + a short glow. */
export const MUZZLE = {
  size: 1.9,
  hdr: 6,
  /** seconds to fade */
  decay: 0.06,
  /** the cockpit view sees the flashes from close: smaller */
  cockpitScale: 0.7,
} as const;

/** GPU particle ring per preset (brief §4 rule 10). */
export const PARTICLE_CAP: Record<Preset, number> = { low: 1500, medium: 3000, high: 6000, ultra: 9000 };

/** Colour ramps (start -> end over life), HDR. Index = ramp id used by emitters. */
export const RAMPS = {
  /** player impact: white-hot -> Ignition */
  spark: 0,
  /** shield / graze: white -> Ice */
  ice: 1,
  /** weak-point hit: Core white -> Hot (bigger, brighter) */
  weak: 2,
  /** hostile: Nebula -> Danger */
  hostile: 3,
  /** engine / boost: Core -> Ignition -> dark */
  engine: 4,
  /** soft flash puff: Core -> Ignition (round, not stretched) */
  flash: 5,
  /** terrain contact by surface (addendum §3): soil / grass dust, rock chips, water spray. Dim: the
   *  particles are additive, so earth reads as a kicked-up haze (alpha dust with ground effect: W3) */
  dust: 6,
  chips: 7,
  water: 8,
} as const;
export const RAMP_COLORS: readonly (readonly [string, number, string, number])[] = [
  ['#FFE1C2', 9, '#FF5A1F', 1.6],
  ['#E8ECFF', 6, '#7FD1FF', 1.2],
  ['#FFFFFF', 12, '#FF8A3D', 2.4],
  ['#7B5BFF', 4, '#FF2D55', 1.2],
  ['#FFE1C2', 5, '#FF5A1F', 0.6],
  ['#FFE1C2', 5, '#FF5A1F', 0.0],
  ['#D9B98A', 1.5, '#6B5638', 0.0],
  ['#E2DCD2', 1.9, '#6C6862', 0.0],
  ['#F2FAFF', 2.2, '#7FB8D8', 0.0],
];

/** Burst recipes (counts are scaled by the preset's particle multiplier, min 1). */
export const BURSTS = {
  hit: { count: 8, speed: [18, 46], life: [0.16, 0.34], size: [0.12, 0.2], drag: 5, spread: 0.9 },
  weak: { count: 14, speed: [24, 60], life: [0.2, 0.42], size: [0.16, 0.26], drag: 4.5, spread: 1.1 },
  /** bolt into the ground: sprays up and back */
  wall: { count: 7, speed: [14, 36], life: [0.2, 0.45], size: [0.14, 0.24], drag: 3.5, spread: 0.8 },
  /** a roll's i-frames ate a projectile */
  graze: { count: 6, speed: [10, 26], life: [0.14, 0.3], size: [0.1, 0.16], drag: 6, spread: 0.7 },
  /** terrain contact (addendum §3): sparks off the hull + a surface puff per scrape tick, more on impact */
  scrape: { count: 14, speed: [16, 42], life: [0.18, 0.4], size: [0.2, 0.34], drag: 4, spread: 0.7 },
  impact: { count: 30, speed: [20, 60], life: [0.2, 0.5], size: [0.14, 0.26], drag: 3.5, spread: 1.1 },
  dust: { count: 10, speed: [3, 12], life: [0.45, 1.0], size: [1.0, 2.2], drag: 2.5, spread: 1 },
  splash: { count: 34, speed: [8, 28], life: [0.4, 0.95], size: [0.3, 0.75], drag: 2, spread: 0.6 },
  /** kill pop until the 2E explosions land */
  kill: { count: 26, speed: [20, 70], life: [0.25, 0.6], size: [0.16, 0.3], drag: 3, spread: 1.6 },
  /** boost ignition: a puff out of the engines */
  boost: { count: 18, speed: [8, 22], life: [0.18, 0.38], size: [0.2, 0.36], drag: 5, spread: 0.6 },
  /** flash puff size (u) + life (s) for hit / kill */
  puff: { hit: [1.3, 0.09], weak: [2.2, 0.12], kill: [5.5, 0.16] },
} as const;

/** Continuous scrape: sparks per second while the hull is in contact (x the preset's particle multiplier). */
export const SCRAPE_STREAM = { sparksPerSec: 140, dustPerSec: 22 } as const;

/** Spark stretch along velocity (u per u/s) and the minimum length factor. */
export const SPARK_STRETCH = { k: 0.02, min: 1 } as const;

/** Engine ribbon trails from the wing tips (brief §7 VISUALS). */
export const RIBBON = {
  /** samples per trail; spacing in seconds (frame-rate independent): ~0.22 s = ~13 u at cruise,
   *  short contrails that stay between the ship and the third-person camera */
  samples: 20,
  every: 1 / 90,
  /** fade out within this distance of the camera (u): no band across the lens */
  camFade: [2.5, 8] as const,
  width: 0.12,
  /** HDR at the head; fades to 0 at the tail (a vapour line, never a beam) */
  hdr: 1.3,
  boostHdr: 2.6,
  color: '#7FD1FF',
  /** boost: brighter Ice, never orange (orange streaks = player tracers) */
  boostColor: '#CDEEFF',
} as const;
