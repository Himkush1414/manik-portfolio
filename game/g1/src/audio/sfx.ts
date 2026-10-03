// Semantic sound names -> synth voices. UI and scenes only ever call
// sfx.play('name'); the synthesis lives in synth/*.
import { AudioBus } from './AudioBus';
import { uiTick, uiConfirm, uiDeny, uiLocked, uiPurchase, uiLivery, sfxMaterialise } from './synth/ui';
import { sting, zing, whoosh, loaderTick, clunk, hiss } from './synth/boot';
import { powerUp, mfdBlip, hudOn } from './synth/cockpit';
import { grind, impact, splash, closeCall, turbulence } from './synth/flight';
import { DEBUG } from '../core/constants';
import { registerDebug } from '../debug/debugApi';

export type SfxName = 'hover' | 'confirm' | 'deny' | 'locked' | 'purchase' | 'livery' | 'materialise' | 'sting' | 'zing' | 'whoosh' | 'loaderTick' | 'clunk' | 'clunkHeavy' | 'hiss' | 'powerUp' | 'mfdBlip0' | 'mfdBlip1' | 'mfdBlip2' | 'hudOn' | 'grind' | 'impact' | 'impactHeavy' | 'splash' | 'closeCall';

const VOICES: Record<SfxName, () => void> = {
  hover: uiTick,
  confirm: uiConfirm,
  deny: uiDeny,
  locked: uiLocked,
  purchase: uiPurchase,
  livery: uiLivery,
  materialise: sfxMaterialise,
  sting,
  zing,
  whoosh,
  loaderTick,
  clunk: () => clunk(0.8),
  clunkHeavy: () => clunk(1.2),
  hiss: () => hiss(1.2),
  powerUp,
  mfdBlip0: () => mfdBlip(0),
  mfdBlip1: () => mfdBlip(1),
  mfdBlip2: () => mfdBlip(2),
  hudOn,
  grind: () => grind(0.7),
  impact: () => impact(0.5),
  impactHeavy: () => impact(1),
  splash,
  closeCall,
};

// QA (?debug=1): every requested sound, even before audio unlocks — the
// audit checks each interactive element maps to a voice (brief §16)
const playLog: SfxName[] = [];
const meters = new Map<string, AnalyserNode>();
registerDebug('audio', {
  log: () => playLog.slice(),
  clear: () => void (playLog.length = 0),
  state: () => AudioBus.ctx?.state ?? 'none',
  /** RMS of a bus right now (QA: proves a bed is actually sounding) */
  level: (name: 'music' | 'sfx' | 'ui' = 'music') => {
    const ctx = AudioBus.ctx;
    if (!ctx) return 0;
    let a = meters.get(name);
    if (!a) {
      a = ctx.createAnalyser();
      a.fftSize = 2048;
      AudioBus.buses[name].connect(a);
      meters.set(name, a);
    }
    const d = new Float32Array(a.fftSize);
    a.getFloatTimeDomainData(d);
    let sum = 0;
    for (const v of d) sum += v * v;
    return Math.sqrt(sum / d.length);
  },
});

let lastHover = 0;

export const sfx = {
  play(name: SfxName): void {
    if (DEBUG) playLog.push(name);
    if (!AudioBus.running) return;
    if (name === 'hover') {
      // hover ticks are rate-limited so sweeping across a list never buzzes
      const now = performance.now();
      if (now - lastHover < 45) return;
      lastHover = now;
    }
    try {
      VOICES[name]();
    } catch (err) {
      console.error('[sfx]', name, err);
    }
  },
};

/** the sustained turbulence howl (0 = silent); a continuous voice, not a one-shot */
export function setTurbulenceSound(level: number): void {
  if (!AudioBus.running) return;
  try {
    turbulence(level);
  } catch (err) {
    console.error('[sfx] turbulence', err);
  }
}
