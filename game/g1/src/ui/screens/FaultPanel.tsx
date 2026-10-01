// Loader fault (brief §17): a task failed (worker unreachable, font or asset
// fetch error...). The sequence holds where it is — dependents wait — and this
// panel offers RETRY (re-runs only the failed tasks) or a full reload. Never a
// white screen, never a silently broken hangar.
import { useEffect, useRef } from 'react';
import { useLoader, retryFailed, type TaskId } from '../../core/loader';
import { HudButton } from '../primitives';
import styles from './FaultPanel.module.css';

const LABEL: Record<TaskId, string> = {
  fonts: 'TYPOGRAPHY',
  geometry: 'FABRICATION / GEOMETRY',
  shaders: 'SHADER LATTICE',
  audio: 'AUDIO BUS',
  save: 'PILOT PROFILE',
  warmup: 'BAY PRESSURISATION',
};

export function FaultPanel() {
  const failed = useLoader(s => s.failed);
  const retry = useRef<HTMLButtonElement>(null);
  const on = failed.length > 0;
  useEffect(() => {
    if (on) retry.current?.focus();
  }, [on]);
  if (!on) return null;
  return (
    <div className={styles.screen} role="alertdialog" aria-modal="true" aria-labelledby="g1-fault-title" aria-describedby="g1-fault-body">
      <p className={styles.code}>SYS.CHECK // FAULT</p>
      <h1 id="g1-fault-title" className={styles.title}>
        Systems fault
      </h1>
      <p id="g1-fault-body" className={styles.body}>
        Part of the hangar failed to come online. Your progress is saved locally and has not been lost.
      </p>
      <ul className={styles.list}>
        {failed.map(f => (
          <li key={f.id}>
            <span className={styles.name}>{LABEL[f.id]}</span>
            <span className={styles.err}>{f.error.slice(0, 120)}</span>
          </li>
        ))}
      </ul>
      <div className={styles.actions}>
        <HudButton ref={retry} variant="primary" onClick={retryFailed}>
          Retry
        </HudButton>
        <HudButton variant="ghost" onClick={() => location.reload()}>
          Reload
        </HudButton>
      </div>
    </div>
  );
}
