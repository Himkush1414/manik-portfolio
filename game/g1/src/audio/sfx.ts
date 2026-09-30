// Semantic sound names -> synth voices. UI and scenes only ever call
// sfx.play('name'); the synthesis lives in synth/*.
import { AudioBus } from './AudioBus';
import { uiTick, uiConfirm, uiDeny, uiLocked, uiPurchase, uiLivery, sfxMaterialise } from './synth/ui';
import { sting, zing, whoosh, loaderTick, clunk, hiss } from './synth/boot';

export type SfxName = 'hover' | 'confirm' | 'deny' | 'locked' | 'purchase' | 'livery' | 'materialise' | 'sting' | 'zing' | 'whoosh' | 'loaderTick' | 'clunk' | 'clunkHeavy' | 'hiss';

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
};

let lastHover = 0;

export const sfx = {
  play(name: SfxName): void {
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
