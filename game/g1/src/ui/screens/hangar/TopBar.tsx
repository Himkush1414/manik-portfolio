// Top bar (brief §12): wordmark, mission code, credits chip (digit roll),
// Upgrades / Settings / Audio mute / Fullscreen icon buttons with tooltips.
import { useEffect, useState } from 'react';
import s from './hangar.module.css';
import { CurrencyChip, HudButton } from '../../primitives';
import { IconAudio, IconFullscreen, IconSettings, IconUpgrade } from '../../icons';
import { useProfile } from '../../../state/profile.store';
import { useSettings } from '../../../state/settings.store';
import { MISSION_01 } from '../../../data/lore';
import { openModal } from './hangarActions';

export function TopBar() {
  const credits = useProfile(p => p.credits);
  const muted = useSettings(st => st.audio.mute);
  const patch = useSettings(st => st.patch);
  const [fs, setFs] = useState(() => !!document.fullscreenElement);
  useEffect(() => {
    const on = () => setFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  return (
    <header className={s.top} data-enter="top">
      <div className={s.wordmark}>
        <b>SPACE WAR</b>
        <span>/ DARK EDITION</span>
      </div>
      <div className={s.mission}>
        SORTIE <b>{MISSION_01.sortie}</b> — BAY <b>07</b> — WORLD <b>{MISSION_01.world}</b>
      </div>
      <div className={s.topRight}>
        <CurrencyChip value={credits} />
        <HudButton variant="icon" tooltip="Upgrades" onClick={() => openModal('upgrades')}>
          <IconUpgrade />
        </HudButton>
        <HudButton variant="icon" tooltip="Settings" onClick={() => openModal('settings')}>
          <IconSettings />
        </HudButton>
        <HudButton variant="icon" tooltip={muted ? 'Unmute audio' : 'Mute audio'} aria-pressed={muted} onClick={() => patch('audio', { mute: !muted })}>
          <IconAudio muted={muted} />
        </HudButton>
        <HudButton
          variant="icon"
          tooltip={fs ? 'Exit fullscreen' : 'Fullscreen'}
          aria-pressed={fs}
          onClick={() => {
            if (document.fullscreenElement) void document.exitFullscreen();
            else void document.documentElement.requestFullscreen?.().catch(() => undefined);
          }}
        >
          <IconFullscreen on={fs} />
        </HudButton>
      </div>
      <span className={s.topRule} aria-hidden />
    </header>
  );
}
