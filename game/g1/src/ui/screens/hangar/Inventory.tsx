// HANGAR INVENTORY (brief §12 left panel): six cards with pre-rendered 3D
// thumbnails (render/thumbnails.ts), name, class, 5 stat pips; locked cards
// show the hologram thumbnail, a lock and live requirement progress. Arrow
// keys move through the list (roving tabindex); Enter/Space selects.
import { useEffect, useRef, useState } from 'react';
import s from './hangar.module.css';
import { HudPanel } from '../../primitives';
import { IconLock } from '../../icons';
import { SHIP_LIST, STAT_KEYS, STAT_LABEL, type ShipId } from '../../../data/ships';
import { unlockState } from '../../../data/unlocks';
import { useProfile } from '../../../state/profile.store';
import { shipThumbnail } from '../../../render/thumbnails';
import { sfx } from '../../../audio/sfx';
import { useViewedShip, viewShip } from './hangarActions';

function useThumb(id: ShipId, livery: number, locked: boolean): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    let retry = 0;
    // thumbnails render one per idle slot, never on a click (DEV_NOTES)
    const idle = (window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 120))) as (cb: () => void, o?: { timeout: number }) => number;
    const request = () =>
      idle(
        () =>
          void shipThumbnail(id, { livery, locked }).then(
            u => live && setUrl(u),
            // e.g. the context was lost mid-readback: try again shortly (it restores in place)
            () => live && retry++ < 4 && window.setTimeout(request, 1500),
          ),
        { timeout: 2000 },
      );
    request();
    return () => {
      live = false;
    };
  }, [id, livery, locked]);
  return url;
}

function ShipCard({ id, index, focusIndex, setFocus }: { id: ShipId; index: number; focusIndex: number; setFocus(i: number): void }) {
  const info = SHIP_LIST[index];
  const profile = useProfile();
  const st = unlockState(id, profile);
  const livery = profile.liveryByShip[id] ?? 0;
  const viewed = useViewedShip();
  const thumb = useThumb(id, livery, !st.unlocked);
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (focusIndex === index && document.activeElement?.closest('[data-inventory]')) ref.current?.focus();
  }, [focusIndex, index]);
  return (
    <li>
      <button
        ref={ref}
        type="button"
        className={`${s.card} ${st.unlocked ? '' : s.cardLocked}`}
        aria-current={viewed === id}
        aria-label={`${info.name}, ${info.cls}${st.unlocked ? '' : ', locked'}`}
        tabIndex={focusIndex === index ? 0 : -1}
        onPointerEnter={() => sfx.play('hover')}
        onFocus={() => setFocus(index)}
        onClick={() => viewShip(id)}
      >
        <span className={s.thumb}>
          {thumb && <img src={thumb} alt="" draggable={false} />}
          <span className={s.thumbIdx}>{String(info.index).padStart(2, '0')}</span>
          {!st.unlocked && (
            <span className={s.lock}>
              <IconLock />
            </span>
          )}
        </span>
        <span className={s.cardBody}>
          <span className={s.cardName}>{info.name}</span>
          <span className={s.cardClass}>{info.cls}</span>
          {st.unlocked ? (
            <span className={s.pips} aria-hidden>
              {STAT_KEYS.map(k => (
                <span key={k} className={s.pip}>
                  {STAT_LABEL[k]}
                  <i>
                    <b style={{ width: `${info.stats[k] * 10}%` }} />
                  </i>
                </span>
              ))}
            </span>
          ) : (
            <span className={s.req}>
              {st.level && (
                <span className={`${s.reqRow} ${st.levelMet ? s.reqMet : ''}`}>
                  <span>
                    Clear L{st.level.need} · {st.level.have}/{st.level.need}
                  </span>
                  <span className={s.reqBar}>
                    <b style={{ width: `${(st.level.have / st.level.need) * 100}%` }} />
                  </span>
                </span>
              )}
              {st.credits && (
                <span className={`${s.reqRow} ${st.creditsMet ? s.reqMet : ''}`}>
                  <span>
                    {st.credits.have.toLocaleString('en-US')}/{st.credits.need.toLocaleString('en-US')} CR
                  </span>
                  <span className={s.reqBar}>
                    <b style={{ width: `${(st.credits.have / st.credits.need) * 100}%` }} />
                  </span>
                </span>
              )}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

export function Inventory() {
  const unlocked = useProfile(p => p.unlockedShips.length);
  const viewed = useViewedShip();
  const [focus, setFocus] = useState(() => Math.max(0, SHIP_LIST.findIndex(x => x.id === viewed)));
  return (
    <div className={s.left} data-enter="left">
      <HudPanel title="Hangar inventory" meta={`06 craft / ${String(unlocked).padStart(2, '0')} available`} style={{ height: '100%' }}>
        <ul
          className={s.cards}
          data-inventory
          aria-label="Ships"
          onKeyDown={e => {
            if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
            e.preventDefault();
            const n = SHIP_LIST.length;
            const next = (focus + (e.key === 'ArrowDown' ? 1 : -1) + n) % n;
            setFocus(next);
            viewShip(SHIP_LIST[next].id);
          }}
        >
          {SHIP_LIST.map((info, i) => (
            <ShipCard key={info.id} id={info.id} index={i} focusIndex={focus} setFocus={setFocus} />
          ))}
        </ul>
      </HudPanel>
    </div>
  );
}
