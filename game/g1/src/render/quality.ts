// Quality tiers (brief §6) + runtime degrade order. Pure data + helpers; the
// PostFX / CanvasRoot components read the resolved profile.

export const PRESETS = ['low', 'medium', 'high', 'ultra'] as const;
export type Preset = (typeof PRESETS)[number];

export type QualityProfile = {
  dpr: number;
  ao: boolean;
  dof: boolean;
  reflections: 'off' | 'half' | 'full';
  shadowMap: 1024 | 2048 | 4096;
  particles: number; // multiplier
  mirror: { w: number; h: number; fps: number };
  multisampling: number;
};

export const QUALITY: Record<Preset, QualityProfile> = {
  low: { dpr: 1.0, ao: false, dof: false, reflections: 'off', shadowMap: 1024, particles: 0.4, mirror: { w: 256, h: 128, fps: 20 }, multisampling: 0 },
  medium: { dpr: 1.25, ao: false, dof: false, reflections: 'half', shadowMap: 2048, particles: 0.7, mirror: { w: 384, h: 192, fps: 30 }, multisampling: 2 },
  high: { dpr: 1.5, ao: true, dof: true, reflections: 'half', shadowMap: 2048, particles: 1, mirror: { w: 512, h: 256, fps: 30 }, multisampling: 4 },
  ultra: { dpr: 2.0, ao: true, dof: true, reflections: 'full', shadowMap: 4096, particles: 1.5, mirror: { w: 512, h: 256, fps: 30 }, multisampling: 4 },
};

/** Runtime degrade steps, applied in this order by the PerformanceMonitor. */
export const DEGRADE_ORDER = ['dpr', 'ao', 'dof', 'reflections', 'particles'] as const;
export type DegradeStep = (typeof DEGRADE_ORDER)[number];

export function isPreset(v: unknown): v is Preset {
  return typeof v === 'string' && (PRESETS as readonly string[]).includes(v);
}

/** First-run pick from detect-gpu tier (0..3) and a measured frame time. */
export function presetFromTier(tier: number, isMobile: boolean, frameMs?: number): Preset {
  let p: Preset = tier >= 3 ? 'high' : tier === 2 ? 'medium' : 'low';
  if (isMobile) p = 'low';
  if (frameMs !== undefined && frameMs > 22 && p !== 'low') p = PRESETS[PRESETS.indexOf(p) - 1];
  return p;
}
