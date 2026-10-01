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
  /** bloom resolution scale + mip levels (brief §4.10: LOW 1/4-res, MED 1/2, HIGH mip-blur 1/2, ULTRA full) */
  bloom: { scale: number; levels: number };
};

export const QUALITY: Record<Preset, QualityProfile> = {
  low: { dpr: 1.0, ao: false, dof: false, reflections: 'off', shadowMap: 1024, particles: 0.4, mirror: { w: 256, h: 128, fps: 20 }, multisampling: 0, bloom: { scale: 0.25, levels: 5 } },
  medium: { dpr: 1.25, ao: false, dof: false, reflections: 'half', shadowMap: 2048, particles: 0.7, mirror: { w: 384, h: 192, fps: 30 }, multisampling: 2, bloom: { scale: 0.5, levels: 6 } },
  high: { dpr: 1.5, ao: true, dof: true, reflections: 'half', shadowMap: 2048, particles: 1, mirror: { w: 512, h: 256, fps: 30 }, multisampling: 4, bloom: { scale: 0.5, levels: 8 } },
  ultra: { dpr: 2.0, ao: true, dof: true, reflections: 'full', shadowMap: 4096, particles: 1.5, mirror: { w: 512, h: 256, fps: 30 }, multisampling: 4, bloom: { scale: 1, levels: 8 } },
};

/** Runtime degrade steps. 'dpr' = the DRS governor's quantised resolution
 *  scales (render/drs.ts); the rest are walked only after its floor. */
export const DEGRADE_ORDER = ['dpr', 'ao', 'dof', 'reflections', 'particles'] as const;
export type DegradeStep = (typeof DEGRADE_ORDER)[number];
/** steps after the resolution floor (hangar / cockpit scenes) */
export const EXTRA_DEGRADE = DEGRADE_ORDER.slice(1) as readonly Exclude<DegradeStep, 'dpr'>[];
/** never render below this device-pixel ratio, whatever the scale + resScale */
export const MIN_DPR = 0.4;

export function isPreset(v: unknown): v is Preset {
  return typeof v === 'string' && (PRESETS as readonly string[]).includes(v);
}

/** measured frame time (ms, at the default HIGH preset) -> preset steps down */
export const PICK_FRAME_MS = { oneStep: 22, twoSteps: 40 } as const;

/** First-run pick from detect-gpu tier (0..3) and a frame time measured at the
 *  default preset: > 22 ms steps down once, > 40 ms twice (integrated UHD 770:
 *  ~55 ms at HIGH; MEDIUM ran 34 fps / p95 66 ms there, LOW 56 fps). */
export function presetFromTier(tier: number, isMobile: boolean, frameMs?: number): Preset {
  let p: Preset = tier >= 3 ? 'high' : tier === 2 ? 'medium' : 'low';
  if (isMobile) p = 'low';
  if (frameMs !== undefined) {
    const steps = frameMs > PICK_FRAME_MS.twoSteps ? 2 : frameMs > PICK_FRAME_MS.oneStep ? 1 : 0;
    p = PRESETS[Math.max(0, PRESETS.indexOf(p) - steps)];
  }
  return p;
}
