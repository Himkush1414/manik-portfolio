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
  /** where the core haze starts / saturates (d, u) */
  coreStart: 260,
  coreEnd: 860,
  /** limb darkening near the camera (d) */
  limb: 34,
  /** travelling rings: spacing (u) and how far they stay visible */
  ringSpacing: 70,
  ringFade: 520,
  /** core disc at the far end: HDR glow + streak rays */
  coreHdr: 5.0,
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
