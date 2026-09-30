// Semantic sound names -> synth voices. UI and scenes only ever call
// sfx.play('name'); the synthesis lives in synth/*.
import { AudioBus } from './AudioBus';
import { uiTick, uiConfirm, uiDeny } from './synth/ui';

export type SfxName = 'hover' | 'confirm' | 'deny';

const VOICES: Record<SfxName, () => void> = {
  hover: uiTick,
  confirm: uiConfirm,
  deny: uiDeny,
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
