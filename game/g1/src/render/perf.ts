// Runtime performance state: degrade level driven by drei's PerformanceMonitor
// (applied in DEGRADE_ORDER), plus resolved effective quality flags.
import { create } from 'zustand';
import { QUALITY, DEGRADE_ORDER, type Preset } from './quality';
import type { SettingsData } from '../state/schema';

type PerfState = {
  degrade: number; // 0 = none; n = first n steps of DEGRADE_ORDER applied
  setDegrade(n: number): void;
};

export const usePerf = create<PerfState>()(set => ({
  degrade: 0,
  setDegrade: n => set({ degrade: Math.max(0, Math.min(DEGRADE_ORDER.length, n)) }),
}));

export type EffectiveQuality = {
  preset: Preset;
  dpr: number;
  ao: boolean;
  dof: boolean;
  reflections: 'off' | 'half' | 'full';
  particles: number;
  shadowMap: number;
  multisampling: number;
  mirror: { w: number; h: number; fps: number };
};

export function resolveQuality(g: SettingsData['graphics'], degrade: number): EffectiveQuality {
  const q = QUALITY[g.preset];
  const applied = new Set(DEGRADE_ORDER.slice(0, degrade));
  const deviceDpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  let dpr = Math.min(q.dpr, Math.max(1, deviceDpr)) * g.resScale;
  if (applied.has('dpr')) dpr = Math.max(0.75, dpr * 0.75);
  return {
    preset: g.preset,
    dpr,
    ao: q.ao && g.ao && !applied.has('ao'),
    dof: q.dof && g.dof && !applied.has('dof'),
    reflections: !g.reflections || applied.has('reflections') ? 'off' : q.reflections,
    particles: q.particles * (applied.has('particles') ? 0.5 : 1),
    shadowMap: q.shadowMap,
    multisampling: q.multisampling,
    mirror: q.mirror,
  };
}
