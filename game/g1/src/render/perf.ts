// Runtime performance state: the DRS governor's level (render/drs.ts; driven
// by <DrsDriver/> in CanvasRoot), plus resolved effective quality flags.
// degrade = governor level: 0..4 = DRS_SCALES (resolution), beyond = the
// EXTRA_DEGRADE steps (AO -> DOF -> reflections -> particles).
import { create } from 'zustand';
import { QUALITY, EXTRA_DEGRADE, MIN_DPR, type Preset } from './quality';
import { DRS_SCALES } from './drs';
import type { SettingsData } from '../state/schema';

type PerfState = {
  degrade: number;
  setDegrade(n: number): void;
};

export const usePerf = create<PerfState>()(set => ({
  degrade: 0,
  setDegrade: n => set({ degrade: Math.max(0, Math.min(DRS_SCALES.length - 1 + EXTRA_DEGRADE.length, n)) }),
}));

export type EffectiveQuality = {
  preset: Preset;
  dpr: number;
  /** DRS resolution multiplier currently applied (QA) */
  drsScale: number;
  ao: boolean;
  dof: boolean;
  reflections: 'off' | 'half' | 'full';
  particles: number;
  shadowMap: number;
  multisampling: number;
  mirror: { w: number; h: number; fps: number };
  bloom: { scale: number; levels: number };
};

export function resolveQuality(g: SettingsData['graphics'], degrade: number): EffectiveQuality {
  const q = QUALITY[g.preset];
  const floor = DRS_SCALES.length - 1;
  const drsScale = DRS_SCALES[Math.min(degrade, floor)];
  const applied = new Set(EXTRA_DEGRADE.slice(0, Math.max(0, degrade - floor)));
  const deviceDpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  // (Phase 1 clamped a degraded DPR UP to 0.75, which overrode a lower resScale)
  const dpr = Math.max(MIN_DPR, Math.min(q.dpr, Math.max(1, deviceDpr)) * g.resScale * drsScale);
  return {
    preset: g.preset,
    dpr,
    drsScale,
    ao: q.ao && g.ao && !applied.has('ao'),
    dof: q.dof && g.dof && !applied.has('dof'),
    reflections: !g.reflections || applied.has('reflections') ? 'off' : q.reflections,
    particles: q.particles * (applied.has('particles') ? 0.5 : 1),
    shadowMap: q.shadowMap,
    multisampling: q.multisampling,
    mirror: q.mirror,
    bloom: q.bloom,
  };
}
