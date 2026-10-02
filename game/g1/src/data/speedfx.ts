// Speed sensation tunables (brief §6 speed FX, kept for the Phase 2R worlds):
// streak lines near the camera, FOV kick, radial blur, edge CA, rumble.
// (Moved out of the deleted wormhole data.)

/** player speed (u/s) that maps to 1.0 in the speed-coupled effects */
export const SPEED_REF = 100;

export const SPEED_FX = {
  /** open-air streak amount: base at cruise + extra at full boost (x the settings speed lines) */
  airBase: 0.16,
  airBoost: 0.55,
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
