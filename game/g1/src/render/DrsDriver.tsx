// Drives the DRS governor (render/drs.ts) from real frame times and runs the
// first-run quality pick (brief §4 rules 9 + 10, carry-over (c)). Replaces
// drei's PerformanceMonitor: quantised resolution steps, rate-limited, then
// AO -> DOF -> reflections -> particles; climbs back when there is headroom.
//   - no sampling during the boot sequence or while the tab is hidden
//   - the sample window resets on every flow change (scene swaps are heavy)
//   - first run: after the hangar settles, 2 s of measured frame time +
//     detect-gpu pick the preset (only if the player never chose one); an
//     integrated GPU gets a one-time toast about the high-performance GPU
import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { DrsGovernor, drsConfigForCap, type DrsProfile } from './drs';
import { EXTRA_DEGRADE } from './quality';
import { usePerf } from './perf';
import { detectPreset } from './gpuTier';
import { useSettings } from '../state/settings.store';
import { useUi } from '../state/ui.store';
import { useFlow, isBoot } from '../app/flow';
import { registerDebug } from '../debug/debugApi';
import { QUERY } from '../core/constants';

/** first-run pick: settle after the hangar is up, then measure */
const AUTO_PICK = { settleMs: 3000, measureMs: 2000 } as const;
const INTEGRATED = /\b(intel|uhd|iris)\b|radeon\(tm\) graphics|radeon graphics|vega \d+ graphics/i;
const GPU_HINT =
  'Integrated graphics detected. For full quality, set your browser to use the high-performance GPU (Windows: Settings › System › Display › Graphics).';

let lastFrame = 0;
// ?drs=0 (QA): the governor never moves (scored captures at a fixed resolution)
let frozen = QUERY.get('drs') === '0';

/** menus (boot / hangar / cockpit launch) hold >= 30 fps; missions hold 60 */
function profileOf(state: string): DrsProfile {
  return state.startsWith('mission.') ? 'mission' : 'menu';
}

export function DrsDriver() {
  const fpsCap = useSettings(s => s.graphics.fpsCap);
  const gov = useMemo(() => {
    const g = new DrsGovernor(drsConfigForCap(fpsCap, EXTRA_DEGRADE.length, profileOf(useFlow.getState().state)));
    g.level = usePerf.getState().degrade;
    return g;
  }, [fpsCap]);

  useEffect(() => {
    const reset = () => gov.reset(performance.now() / 1000);
    // every flow change resets the window; entering / leaving a mission swaps the threshold profile
    const unsub = useFlow.subscribe((s, prev) => {
      if (s.state === prev.state) return;
      const now = performance.now() / 1000;
      if (profileOf(s.state) !== profileOf(prev.state)) gov.configure(drsConfigForCap(useSettings.getState().graphics.fpsCap, EXTRA_DEGRADE.length, profileOf(s.state)), now);
      else gov.reset(now);
    });
    document.addEventListener('visibilitychange', reset);
    registerDebug('perf', {
      state: () => ({ degrade: usePerf.getState().degrade, scale: gov.scale, extra: gov.extra, p95: Math.round(gov.p95() * 10) / 10 }),
      /** QA: force a governor level (0..9); freeze(true) stops it moving */
      setLevel: (n: number) => {
        gov.level = n;
        usePerf.getState().setDegrade(n);
      },
      freeze: (on = true) => void (frozen = on),
    });
    return () => {
      unsub();
      document.removeEventListener('visibilitychange', reset);
    };
  }, [gov]);

  useFrame(() => {
    const now = performance.now();
    const ms = now - lastFrame;
    lastFrame = now;
    if (frozen || document.hidden || isBoot(useFlow.getState().state) || ms > 1000) return;
    if (gov.sample(ms, now / 1000) !== 0) usePerf.getState().setDegrade(gov.level);
  });

  useFirstRunPick();
  return null;
}

let picking = false;

function useFirstRunPick(): void {
  const flowState = useFlow(s => s.state);
  useEffect(() => {
    if (picking || flowState !== 'hangar.idle') return;
    const g = useSettings.getState().graphics;
    const hintDone = useSettings.getState().gpuHintShown;
    // a preset the player chose (or an earlier pick) is never overridden
    if (g.autoPicked && hintDone) return;
    picking = true;
    const timer = window.setTimeout(() => void measureAndPick(), AUTO_PICK.settleMs);
    return () => {
      window.clearTimeout(timer);
      picking = false;
    };
  }, [flowState]);
}

async function measureAndPick(): Promise<void> {
  // MEDIAN frame time: the hangar is still settling (thumbnails, cockpit
  // pre-warm), and a mean let a few slow frames push an RTX 3050 to MEDIUM
  const frameMs = await new Promise<number>(resolve => {
    const d: number[] = [];
    const t0 = performance.now();
    let last = t0;
    const f = (now: number) => {
      d.push(now - last);
      last = now;
      if (now - t0 < AUTO_PICK.measureMs) requestAnimationFrame(f);
      else {
        d.sort((a, b) => a - b);
        resolve(d[Math.floor(d.length / 2)] ?? 16.7);
      }
    };
    requestAnimationFrame(f);
  });
  const { preset, gpu } = await detectPreset(frameMs);
  const st = useSettings.getState();
  // only the untouched default is replaced (a Phase 1 save never recorded who picked it)
  if (!st.graphics.autoPicked && st.graphics.preset === 'high') st.setPreset(preset, true);
  if (!st.gpuHintShown && gpu && INTEGRATED.test(gpu)) {
    useUi.getState().toast(GPU_HINT, 'info', 9000);
    st.setGpuHintShown();
  } else if (!st.gpuHintShown) st.setGpuHintShown();
}
