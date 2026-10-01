// Render tunables (post stack, tone mapping choice). No magic numbers in
// components — tweak here.

export const POST = {
  /** A/B result logged in DEV_NOTES: 'agx' | 'neutral' */
  toneMapping: 'agx' as 'agx' | 'neutral',
  bloom: { luminanceThreshold: 1.0, luminanceSmoothing: 0.18, intensity: 1.15, radius: 0.72, levels: 8 },
  caBase: 0.0006,
  vignette: { offset: 0.26, darkness: 0.66 },
  grain: 0.085,
  ao: { aoRadius: 2.4, distanceFalloff: 0.9, intensity: 2.4, halfRes: true, gammaCorrection: false, depthAwareUpsampling: true },
  aoQuality: 'Medium' as 'Performance' | 'Low' | 'Medium' | 'High' | 'Ultra',
  dof: { range: 14, bokeh: 2.0 },
} as const;

export const CLEAR_COLOR = '#04050A';

/**
 * Dynamic-resolution governor (brief §4 rule 9; render/drs.ts). One algorithm,
 * per-scene thresholds: missions hold 60 fps (19 / 12.5 ms p95); the hangar
 * and cockpit menus hold >= 30 fps (carry-over (c)) at the highest resolution
 * that allows it — every step reallocates the render targets (measured 60-110
 * ms on the integrated GPU), so the menu governor moves rarely.
 */
export const DRS = {
  scales: [1, 0.85, 0.72, 0.6, 0.5],
  window: 90,
  mission: { downMs: 19, upMs: 12.5, downHold: 2, upHold: 6, minInterval: 3 },
  // menu thresholds straddle the vsync quanta (16.7 / 33.3 / 50 / 66.7 ms):
  // step down when > 5 % of frames take >= 66.7 ms, up when nearly all take
  // 16.7 ms. Measured integrated-GPU hangar at LOW (prod, 1080p): scale 1.0
  // 25 fps / 0.85 28 / 0.72 38 (p95 50) / 0.6 47 / 0.5 55 -> it settles at
  // 0.72, the sharpest scale that holds >= 30 fps (0.5 was visibly jaggy)
  menu: { downMs: 55, upMs: 26, downHold: 3, upHold: 8, minInterval: 5 },
} as const;
