// Launch / cockpit overlay (brief §15): seal lines over the sealed bulkhead,
// the helmet frame, briefing controls ([LET'S GO], a screen-reader copy of
// the combiner text), the camera-mode selector (three angular cards with SVG
// schematics, keys 1/2/3, saved default pre-highlighted) and STANDBY with
// ESC back to the hangar.
import { useEffect, useRef } from 'react';
import s from './launch.module.css';
import { HudButton, Keycap } from '../../primitives';
import { useFlow } from '../../../app/flow';
import { useUi } from '../../../state/ui.store';
import { useSettings } from '../../../state/settings.store';
import { briefingAck, chooseCamera, returnToHangar } from '../../../app/choreo/launchTimeline';
import { MISSION_01 } from '../../../data/lore';
import { sfx } from '../../../audio/sfx';
import type { CameraMode } from '../../../render/cameraRig';

const MODES: { id: CameraMode; key: string; name: string; desc: string; best: string }[] = [
  { id: 'third', key: '1', name: 'THIRD PERSON', desc: 'Moderate chase — the whole ship always in view.', best: 'BEST FOR: READING THE FIGHT' },
  { id: 'chase', key: '2', name: 'CHASE', desc: 'Tight follow, low and close. More speed, less margin.', best: 'BEST FOR: SPEED' },
  { id: 'cockpit', key: '3', name: 'COCKPIT', desc: 'First person from the seat, with live mirrors.', best: 'BEST FOR: IMMERSION' },
];

/** Side-view schematic: ship silhouette + camera position + distance line. */
function Schematic({ mode }: { mode: CameraMode }) {
  const cam = mode === 'third' ? { x: 34, y: 22 } : mode === 'chase' ? { x: 70, y: 38 } : { x: 132, y: 46 };
  const dist = mode === 'third' ? '12 m' : mode === 'chase' ? '6 m' : 'SEAT';
  return (
    <svg viewBox="0 0 240 110" className={s.schem} aria-hidden>
      <line x1="10" y1="92" x2="230" y2="92" stroke="rgba(140,154,192,0.25)" strokeDasharray="3 4" />
      {/* ship, nose right */}
      <path d="M96 64 L150 58 L196 62 L150 68 L112 70 Z" fill="rgba(232,236,255,0.12)" stroke="#e8ecff" strokeWidth="1.3" />
      <path d="M104 64 L96 48 L110 50 L120 62" fill="none" stroke="#e8ecff" strokeWidth="1.3" />
      <path d="M128 58 Q138 50 150 57" fill="none" stroke="#7fd1ff" strokeWidth="1.3" />
      <circle cx="94" cy="65" r="3" fill="#ff5a1f" />
      {/* camera */}
      <g transform={`translate(${cam.x} ${cam.y})`}>
        <rect x="-9" y="-6" width="14" height="12" fill="none" stroke="#ff8a3d" strokeWidth="1.5" />
        <path d="M5 -3 L12 -7 L12 7 L5 3" fill="none" stroke="#ff8a3d" strokeWidth="1.5" />
      </g>
      {mode !== 'cockpit' && <line x1={cam.x + 12} y1={cam.y} x2="150" y2="60" stroke="#ff8a3d" strokeDasharray="2 3" />}
      <text x="12" y="16" fill="#8c9ac0" fontSize="10" fontFamily="var(--font-mono)" letterSpacing="0.16em">
        {dist}
      </text>
    </svg>
  );
}

export function LaunchHUD() {
  const state = useFlow(f => f.state);
  const lines = useUi(u => u.launchLines);
  const helmet = useSettings(st => st.camera.helmetFrame);
  const saved = useSettings(st => st.camera.mode);
  const inCockpit = state === 'launch.briefing' || state === 'launch.cameraSelect' || state === 'launch.standby' || state === 'launch.reveal';
  const goRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const st = useFlow.getState().state;
      if (e.key === 'Escape' && (st === 'launch.briefing' || st === 'launch.cameraSelect' || st === 'launch.standby')) {
        e.preventDefault();
        returnToHangar();
      } else if (st === 'launch.cameraSelect' && ['1', '2', '3'].includes(e.key)) {
        chooseCamera(MODES[Number(e.key) - 1].id);
      } else if (st === 'launch.briefing' && (e.key === 'Enter' || e.key === ' ') && document.activeElement === document.body) {
        e.preventDefault();
        briefingAck();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  useEffect(() => {
    if (state === 'launch.briefing') window.setTimeout(() => goRef.current?.focus(), 60);
  }, [state]);

  if (!state.startsWith('launch.')) return null;
  return (
    <div className={s.root}>
      {inCockpit && <div className={s.helmet} data-mode={helmet} aria-hidden />}
      {lines.length > 0 && (
        <div className={s.seal} role="status" aria-live="polite">
          {lines.map(l => (
            <span key={l}>{l}</span>
          ))}
        </div>
      )}

      {state === 'launch.briefing' && (
        <>
          <div className={s.sr} aria-live="polite">
            {[MISSION_01.header, MISSION_01.salutation, ...MISSION_01.body, ...MISSION_01.signoff].join(' ')}
          </div>
          <div className={s.bar}>
            <span className={s.hint}>
              Mission {MISSION_01.number} · {MISSION_01.title}
            </span>
            <HudButton ref={goRef} variant="primary" className={s.go} onClick={briefingAck} clickSound={null}>
              LET&apos;S GO
            </HudButton>
            <span className={s.hint}>
              <Keycap>ENTER</Keycap>
            </span>
          </div>
        </>
      )}

      {state === 'launch.cameraSelect' && (
        <div className={s.select} role="dialog" aria-label="Select flight camera">
          <div className={s.selTitle}>FLIGHT CAMERA</div>
          <div className={s.cards} role="radiogroup" aria-label="Camera mode">
            {MODES.map(m => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={saved === m.id}
                data-default={saved === m.id}
                className={s.card}
                autoFocus={saved === m.id}
                onPointerEnter={() => sfx.play('hover')}
                onClick={() => chooseCamera(m.id)}
              >
                <span className={s.cardKey}>
                  <Keycap>{m.key}</Keycap>
                </span>
                <span className={s.cardName}>{m.name}</span>
                <Schematic mode={m.id} />
                <span className={s.cardDesc}>{m.desc}</span>
                <span className={s.best}>{m.best}</span>
                {saved === m.id && <span className={s.saved}>SAVED DEFAULT</span>}
              </button>
            ))}
          </div>
          <div className={s.foot}>Switchable any time in mission: Settings › Camera</div>
        </div>
      )}

      {(state === 'launch.briefing' || state === 'launch.cameraSelect' || state === 'launch.standby') && (
        <div className={s.esc}>
          <HudButton variant="ghost" onClick={() => returnToHangar()} clickSound={null}>
            <Keycap>ESC</Keycap> RETURN TO HANGAR
          </HudButton>
        </div>
      )}
      {state === 'launch.standby' && (
        <div className={s.sr} role="status" aria-live="polite">
          Launch window: standby. Press Escape to return to the hangar.
        </div>
      )}
    </div>
  );
}
