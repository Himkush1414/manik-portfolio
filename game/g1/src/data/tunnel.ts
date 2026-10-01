// Wormhole tunables (brief §6). Geometry, per-preset layer counts and the
// three corridor moods (L1 clean, L22 infested, L10 chamber). Colours are
// sRGB hex (palette.ts keys spelled out); intensities are HDR multipliers.

export const TUNNEL = {
  radius: 46,
  radial: 128,
  lengthSegs: 96,
  /** shell extent in mission-local z: from behind the camera to the far core */
  zNear: 40,
  zFar: -900,
  /** veil shell (HIGH+): inner translucent layer */
  veilRadius: 34,
  /** noise texture (baked at load, seamless) */
  noiseSize: 256,
  /** around-the-tube repeats of the swirl texture (integer = seamless) */
  repeatsU: 8,
  /** texture metres per repeat along the rail (stretched: reads as flow) */
  metresPerV: 220,
  /** core haze ramp (d, u): a LONG ramp — a short one tone-mapped into a flat
   *  white disc with a hard edge (L22's pink core) */
  coreStart: 180,
  coreEnd: 900,
  /** limb darkening near the camera (d) */
  limb: 34,
  /** travelling rings: spacing (u) and how far they stay visible */
  ringSpacing: 70,
  ringFade: 520,
  /** core disc at the far end: HDR glow + streak rays */
  coreHdr: 3.6,
  rays: 14,
  /** player speed (u/s) that maps to 1.0 in the speed-coupled effects */
  speedRef: 100,
} as const;

/** swirl layers per quality preset (brief §4.10) + extras */
export const TUNNEL_TIERS = {
  low: { layers: 1, arcs: false, veil: false },
  medium: { layers: 2, arcs: true, veil: false },
  high: { layers: 3, arcs: true, veil: true },
  ultra: { layers: 4, arcs: true, veil: true },
} as const;

export type TunnelMoodId = 'l1' | 'l22' | 'l10';

export type TunnelMoodDef = {
  near: string;
  mid: string;
  far: string;
  /** core light (HDR at the vanishing point) */
  core: string;
  /** filaments / energy threads */
  filament: string;
  /** organic veins (infestation) */
  vein: string;
  /** danger pulses (fraction of time / intensity) */
  pulse: number;
  twist: number;
  flow: number;
  ringDensity: number;
  infestation: number;
  turbulence: number;
  /** HDR multiplier of the filaments */
  glow: number;
};

export const MOODS: Record<TunnelMoodId, TunnelMoodDef> = {
  // L1 clean corridor: Navy -> Indigo -> Violet, Ice filaments, warm Core exit light (awe, calm)
  l1: { near: '#0D1330', mid: '#1A1F5C', far: '#4B2A9E', core: '#FFE1C2', filament: '#7FD1FF', vein: '#7B5BFF', pulse: 0, twist: 1, flow: 0.35, ringDensity: 1, infestation: 0, turbulence: 0.1, glow: 1.6 },
  // L22 infested: Indigo-black, Nebula -> magenta veins, 10 % Danger pulses, Ice lightning storms
  l22: { near: '#06081A', mid: '#120F33', far: '#3A1660', core: '#FF8AD8', filament: '#7FD1FF', vein: '#C23BFF', pulse: 0.1, twist: 1.6, flow: 0.6, ringDensity: 0.7, infestation: 1, turbulence: 0.5, glow: 1.4 },
  // L10 chamber: black void, dark red-violet energy, Ignition-amber ring structures, the Warden's red eye
  l10: { near: '#04050A', mid: '#1A0718', far: '#4A0F2C', core: '#FF2D55', filament: '#FF5A1F', vein: '#7B1240', pulse: 0.05, twist: 0.6, flow: 0.25, ringDensity: 1.4, infestation: 0.35, turbulence: 0.25, glow: 1.2 },
};

/** Speed sensation (brief §6 SPEED SENSATION). */
export const SPEED_FX = {
  /** GPU streak lines near the camera, per preset */
  streaks: { low: 140, medium: 260, high: 420, ultra: 600 },
  /** streak field: radius band (u) around the axis and depth span (u) */
  streakRMin: 7,
  streakRMax: 40,
  streakSpan: 260,
  /** streak length (u) at speed 1.0, and its brightness */
  streakLen: 16,
  /** quad width (u): at 0.07 they fell under a pixel at distance */
  streakWidth: 0.16,
  streakGlow: 2.4,
  /** FOV: +12 % per +100 % speed over cruise; boost adds 9 deg (critically damped) */
  fovPerSpeed: 0.12,
  fovBoostDeg: 9,
  fovOmega: 9,
  /** radial speed blur (HIGH/ULTRA): strength at speed 1.0, taps */
  blur: 0.022,
  blurTaps: 8,
  /** extra edge chromatic aberration at speed 1.0 */
  caPerSpeed: 0.0016,
  /** turbulence micro-shake: rumble level per (turbulence x speed) */
  rumble: 0.22,
  rumbleHz: 11,
} as const;

/** Storm lightning flashes (brief §6 storms; §9 flash budget <= 3/s). */
export const STORM_FX = {
  /** expected flashes per second at storm 1.0 */
  rate: 0.7,
  /** flash envelope decay (1/s) and peak */
  decay: 7,
  peak: 1,
  /** never closer together than this (flash budget) */
  minGap: 0.34,
} as const;
