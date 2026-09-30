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
