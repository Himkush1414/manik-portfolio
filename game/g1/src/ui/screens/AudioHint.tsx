// Tiny unobtrusive "CLICK FOR SOUND" corner hint while the AudioContext is
// still locked by the browser's autoplay policy (brief §16).
import { useUi } from '../../state/ui.store';
import styles from './AudioHint.module.css';

export function AudioHint() {
  const locked = useUi(s => s.audioLocked);
  return (
    <div className={`${styles.hint} ${locked ? styles.on : ''}`} role="status" aria-live="polite">
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <path d="M2 6 H5 L9 2.5 V13.5 L5 10 H2 Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="miter" />
        <path d="M11.5 5.5 L14.5 10.5 M14.5 5.5 L11.5 10.5" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <span>{locked ? 'CLICK FOR SOUND' : ''}</span>
    </div>
  );
}
