// Under-ship block (brief §12): name (title face), class + tagline, five
// segmented stat bars (upgrade bonus as Ice ghost segments) with a radar
// toggle, and the livery swatch row (disabled while locked).
import { useState } from 'react';
import s from './hangar.module.css';
import { HudButton, RadarChart, ScrambleText, SegBar, Swatch } from '../../primitives';
import { IconBars, IconRadar } from '../../icons';
import { SHIPS, STAT_KEYS, STAT_LABEL, STAT_NAME } from '../../../data/ships';
import { effectiveStats } from '../../../data/upgrades';
import { liveriesFor, clampLivery } from '../../../data/liveries';
import { unlockState } from '../../../data/unlocks';
import { useProfile } from '../../../state/profile.store';
import { bus } from '../../../core/bus';
import { useViewedShip } from './hangarActions';

export function ShipInfo() {
  const id = useViewedShip();
  const info = SHIPS[id];
  const profile = useProfile();
  const locked = !unlockState(id, profile).unlocked;
  const eff = effectiveStats(id, profile.upgrades);
  const liveries = liveriesFor(id);
  const livery = clampLivery(id, profile.liveryByShip[id] ?? 0);
  const [radar, setRadar] = useState(false);
  return (
    <div className={s.under} data-enter="under">
      <div className={s.shipName}>
        <h1>
          <ScrambleText text={info.name} trigger={id} />
        </h1>
        <span className={s.shipCls}>{info.cls}</span>
        {locked && <span className={s.lockedTag}>LOCKED</span>}
      </div>
      <p className={s.tagline}>{info.tagline}</p>
      <div className={s.stats}>
        {radar ? (
          <div className={s.radar}>
            <RadarChart values={STAT_KEYS.map(k => info.stats[k])} bonus={STAT_KEYS.map(k => eff[k] - info.stats[k])} labels={STAT_KEYS.map(k => STAT_LABEL[k])} />
          </div>
        ) : (
          <div className={s.statList}>
            {STAT_KEYS.map(k => (
              <div key={k} className={s.stat}>
                <span>
                  {STAT_LABEL[k]}
                  <b>{info.stats[k]}</b>
                </span>
                <SegBar value={info.stats[k]} bonus={Math.min(10, eff[k]) - info.stats[k]} label={STAT_NAME[k]} />
              </div>
            ))}
          </div>
        )}
        <HudButton variant="icon" tooltip={radar ? 'Show stat bars' : 'Show radar'} aria-pressed={radar} onClick={() => setRadar(r => !r)}>
          {radar ? <IconBars /> : <IconRadar />}
        </HudButton>
      </div>
      <div className={s.liveries}>
        <span className={s.liveryLabel}>
          Livery <b>{liveries[livery].name}</b>
        </span>
        <div className={s.swatches} role="radiogroup" aria-label="Livery">
          {liveries.map((l, i) => (
            <Swatch
              key={l.id}
              a={l.primary}
              b={l.secondary}
              k={l.accent}
              label={locked ? `${l.name} — locked` : l.name}
              checked={i === livery}
              disabled={locked}
              onSelect={() => {
                profile.setLivery(id, i);
                bus.emit('livery:changed', { shipId: id, livery: i });
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
