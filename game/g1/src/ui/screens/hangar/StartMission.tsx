// START MISSION (brief §12 primary CTA): chamfered shape, rotating conic
// sweep border (@property), hex micro-pattern, title face. Idle: breathing
// glow. Hover: faster sweep + engine flare on the 3D ship (ui.ctaHover).
// Active: scale + white flash + ping ring from the pointer. Disabled (locked
// ship): hatched, reason line, and the hold-to-confirm PURCHASE button.
import { useState, type CSSProperties } from 'react';
import s from './hangar.module.css';
import { HoldButton } from '../../primitives';
import { useUi } from '../../../state/ui.store';
import { useProfile } from '../../../state/profile.store';
import { unlockState } from '../../../data/unlocks';
import { SHIPS } from '../../../data/ships';
import { MISSION_01 } from '../../../data/lore';
import { sfx } from '../../../audio/sfx';
import { purchaseViewed, startMission, useViewedShip } from './hangarActions';

export function StartMission() {
  const id = useViewedShip();
  const profile = useProfile();
  const st = unlockState(id, profile);
  const setHover = useUi(u => u.setCtaHover);
  const [fx, setFx] = useState<{ k: number; x: number; y: number } | null>(null);
  const locked = !st.unlocked;
  const reason = locked
    ? [st.level && !st.levelMet ? `Clear level ${st.level.need}` : null, st.credits && !st.creditsMet ? `${st.credits.need.toLocaleString('en-US')} CR` : null].filter(Boolean).join(' · ') || 'Purchase to fly'
    : '';
  return (
    <div className={s.ctaWrap} data-enter="cta">
      {locked && (
        <div className={s.buyRow}>
          <span className={s.reason}>
            {SHIPS[id].name} locked — {reason}
          </span>
          <HoldButton
            disabled={!st.canPurchase}
            tooltip={st.canPurchase ? `Hold to buy for ${st.credits?.need.toLocaleString('en-US')} CR` : 'Requirements not met'}
            onConfirm={() => purchaseViewed(id)}
          >
            PURCHASE {st.credits ? `· ${st.credits.need.toLocaleString('en-US')} CR` : ''}
          </HoldButton>
        </div>
      )}
      <button
        type="button"
        className={s.cta}
        aria-disabled={locked}
        aria-label={locked ? `Start mission unavailable: ${reason}` : `Start mission, sortie ${MISSION_01.sortie}`}
        onPointerEnter={() => {
          if (locked) return;
          sfx.play('hover');
          setHover(true);
        }}
        onPointerLeave={() => setHover(false)}
        onFocus={() => !locked && setHover(true)}
        onBlur={() => setHover(false)}
        onClick={e => {
          if (!startMission()) return;
          const r = e.currentTarget.getBoundingClientRect();
          const x = e.clientX ? e.clientX - r.left : r.width / 2;
          const y = e.clientY ? e.clientY - r.top : r.height / 2;
          setFx({ k: Date.now(), x, y });
        }}
      >
        {fx && (
          <span key={fx.k}>
            <span className={s.flashFx} />
            <span className={s.ping} style={{ left: fx.x, top: fx.y } as CSSProperties} />
          </span>
        )}
        <span className={s.ctaLabel}>
          <b>START MISSION</b>
          <small>{locked ? 'LOCKED' : `SORTIE ${MISSION_01.sortie} · ${MISSION_01.title}`}</small>
        </span>
      </button>
    </div>
  );
}
