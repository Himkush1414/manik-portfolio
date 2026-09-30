// First-run quality pick (brief §6): detect-gpu tier + a measured frame time.
// Benchmarks are bundled (lazy glob) instead of fetched from a CDN at runtime.
import { getGPUTier } from 'detect-gpu';
import { presetFromTier, type Preset } from './quality';

const benchmarks = import.meta.glob('../../node_modules/detect-gpu/dist/benchmarks/*.json', { import: 'default' });

export async function detectPreset(frameMs?: number): Promise<{ preset: Preset; tier: number; gpu?: string }> {
  try {
    const r = await getGPUTier({
      override: {
        loadBenchmarks: async (file: string) => {
          const key = Object.keys(benchmarks).find(k => k.endsWith('/' + file));
          if (!key) throw new Error('benchmark ' + file + ' not bundled');
          return (await benchmarks[key]()) as never;
        },
      },
    });
    return { preset: presetFromTier(r.tier, !!r.isMobile, frameMs), tier: r.tier, gpu: r.gpu };
  } catch {
    return { preset: presetFromTier(2, false, frameMs), tier: 2 };
  }
}
