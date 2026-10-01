// Launch overlay (brief §14): the 3-2-1 countdown (third / chase views — the
// cockpit view shows it on the combiner) and Sato's line, subtitled.
import s from './mission.module.css';
import { useLaunchUi } from '../../../state/launch.store';
import { useSettings } from '../../../state/settings.store';
import { useFlow } from '../../../app/flow';

export function LaunchOverlay() {
  const count = useLaunchUi(u => u.count);
  const line = useLaunchUi(u => u.line);
  const mode = useSettings(st => st.camera.mode);
  const subs = useSettings(st => st.accessibility.subtitles);
  const size = useSettings(st => st.accessibility.subtitleSize);
  const launching = useFlow(f => f.state === 'mission.preparing' || f.state === 'mission.launching');
  if (!launching) return null;
  return (
    <div className={s.launch} aria-live="polite">
      {count !== null && mode !== 'cockpit' && (
        <div className={s.count} data-go={count === 0}>
          {count > 0 ? count : 'LAUNCH'}
        </div>
      )}
      {line && subs && (
        <div className={s.line} data-size={size}>
          <span className={s.speaker}>CMDR SATO</span>
          <span>{line}</span>
        </div>
      )}
    </div>
  );
}
