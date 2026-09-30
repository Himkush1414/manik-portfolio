// UPGRADES / LOADOUT (brief §14): left = the real ship on the pad (hangar
// camera shifted) with a hologram callout to the hovered track's hardpoint;
// centre = 5 tracks x 5 tiers (hold 0.5 s to install: credits roll, pip
// ignites, INSTALLED flash, chime); right = stat comparison + COMBAT RATING
// vs the next boss's recommended rating with a plain verdict.
import { useEffect, useRef, useState } from 'react';
import { Vector3 } from 'three';
import s from './upgrades.module.css';
import { CurrencyChip, HoldButton, HudPanel, Modal, SegBar } from '../../primitives';
import { TRACK_IDS, TRACKS, MAX_TIER, nextTierCost, effectiveStats, computeCombatRating, recommendedRating, verdict, BOSS_LEVELS, type TrackId } from '../../../data/upgrades';
import { SHIPS, STAT_KEYS, STAT_LABEL, STAT_NAME } from '../../../data/ships';
import { useProfile } from '../../../state/profile.store';
import { useUi } from '../../../state/ui.store';
import { sfx } from '../../../audio/sfx';
import { hardpointWorld } from '../../../scenes/hangar/shipBridge';
import { whenWorldMounted } from '../../../scenes/sceneBridge';
import { closeModal } from '../hangar/hangarActions';
import type { Camera } from 'three';

function Callout({ track, anchor }: { track: TrackId | null; anchor: HTMLElement | null }) {
  const svg = useRef<SVGSVGElement>(null);
  useEffect(() => {
    let cam: Camera | null = null;
    void whenWorldMounted().then(w => (cam = w.camera));
    const pts: Vector3[] = [];
    const v = new Vector3();
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const el = svg.current;
      if (!el) return;
      if (!track || !anchor || !cam) {
        el.innerHTML = '';
        return;
      }
      hardpointWorld(TRACKS[track].hardpoint, pts);
      const a = anchor.getBoundingClientRect();
      const ax = a.left, ay = a.top + a.height / 2;
      const W = window.innerWidth, H = window.innerHeight;
      let html = '';
      let labelled = false;
      pts.forEach(p => {
        v.copy(p).project(cam!);
        if (v.z > 1) return;
        const x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H;
        if (x > ax - 24) return; // under the track panel: a line across the rows reads as noise
        const elbow = Math.min(ax - 40, x + 120);
        html += `<line x1="${ax}" y1="${ay}" x2="${elbow}" y2="${ay}"/><line x1="${elbow}" y1="${ay}" x2="${x}" y2="${y}"/>`;
        html += `<circle cx="${x}" cy="${y}" r="10"/><circle class="dot" cx="${x}" cy="${y}" r="2.5"/>`;
        if (!labelled) html += `<text x="${x + 16}" y="${y - 12}">${TRACKS[track].hardpoint.toUpperCase()}</text>`;
        labelled = true;
      });
      el.innerHTML = html;
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [track, anchor]);
  return <svg ref={svg} className={s.callout} aria-hidden />;
}

export function UpgradesModal() {
  const profile = useProfile();
  const ship = profile.selectedShip;
  const [hot, setHot] = useState<TrackId | null>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [lit, setLit] = useState<{ track: TrackId; tier: number; k: number } | null>(null);
  const base = SHIPS[ship].stats;
  const eff = effectiveStats(ship, profile.upgrades);
  const rating = computeCombatRating(profile, ship);
  const nextBoss = BOSS_LEVELS.find(b => b > profile.highestLevelCleared) ?? 50;
  const rec = recommendedRating(nextBoss);
  const v = verdict(rating, rec);

  const install = (id: TrackId) => {
    const res = profile.purchaseUpgrade(id);
    if (!res.ok) {
      sfx.play('deny');
      useUi.getState().toast(res.reason === 'insufficient-credits' ? 'Insufficient credits' : res.reason === 'maxed' ? 'Track maxed' : 'Unavailable', 'danger');
      return;
    }
    sfx.play('purchase');
    setLit({ track: id, tier: useProfile.getState().upgrades[id], k: Date.now() });
  };

  // gauge arc: 0..200 rating over 240 degrees
  const G = 190, R = 76, C = G / 2, start = 150, sweep = 240, max = 220;
  const arc = (val: number) => {
    const a = ((start + (Math.min(max, val) / max) * sweep) * Math.PI) / 180;
    return [C + Math.cos(a) * R, C + Math.sin(a) * R];
  };
  const [sx, sy] = arc(0), [ex, ey] = arc(rating), [rx, ry] = arc(rec);
  const large = (Math.min(max, rating) / max) * sweep > 180 ? 1 : 0;

  return (
    <Modal title="UPGRADES" kicker="HANGAR // LOADOUT" onClose={closeModal} seeThrough headExtra={<CurrencyChip value={profile.credits} />}>
      <div className={s.shipTag}>
        <span>{SHIPS[ship].cls} · upgrades are profile-wide</span>
        <b>{SHIPS[ship].name}</b>
      </div>
      <div className={s.body}>
        <div className={s.tracks} role="list" aria-label="Upgrade tracks">
          {TRACK_IDS.map(id => {
            const t = TRACKS[id];
            const tier = profile.upgrades[id];
            const cost = nextTierCost(tier);
            const cur = eff[t.stat];
            const next = cost === null ? cur : effectiveStats(ship, { ...profile.upgrades, [id]: tier + 1 })[t.stat];
            const canAfford = cost !== null && profile.credits >= cost;
            return (
              <div
                key={id}
                role="listitem"
                className={s.track}
                data-hot={hot === id}
                onPointerEnter={e => {
                  setHot(id);
                  setAnchor(e.currentTarget);
                  sfx.play('hover');
                }}
                onPointerLeave={() => setHot(h => (h === id ? null : h))}
                onFocus={e => {
                  setHot(id);
                  setAnchor(e.currentTarget);
                }}
              >
                <div>
                  <div className={s.trackName}>{t.name}</div>
                  <div className={s.trackEffect}>{t.effect}</div>
                </div>
                <div className={s.tiers} aria-label={`Tier ${tier} of ${MAX_TIER}`}>
                  {Array.from({ length: MAX_TIER }, (_, i) => (
                    <i key={lit && lit.track === id && lit.tier === i + 1 ? `lit${lit.k}` : i} className={`${s.tier} ${i < tier ? s.on : ''} ${i === tier ? s.next : ''} ${lit && lit.track === id && lit.tier === i + 1 ? s.lit : ''}`} />
                  ))}
                  <span className={s.preview}>
                    {STAT_LABEL[t.stat]} <b>{cur.toFixed(1)}</b>
                    {cost !== null && (
                      <>
                        {' '}→ <i>{next.toFixed(1)}</i>
                      </>
                    )}
                  </span>
                </div>
                <div className={s.buy}>
                  {cost === null ? (
                    <span className={s.maxed}>MAXED</span>
                  ) : (
                    <>
                      <span className={s.cost}>
                        TIER {tier + 1} · {cost.toLocaleString('en-US')} CR
                      </span>
                      <HoldButton holdMs={500} disabled={!canAfford} tooltip={canAfford ? 'Hold to install' : 'Insufficient credits'} onConfirm={() => install(id)}>
                        INSTALL
                      </HoldButton>
                    </>
                  )}
                </div>
                {lit && lit.track === id && (
                  <span key={lit.k} className={s.installed} aria-live="polite">
                    INSTALLED
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <div className={s.side}>
          <HudPanel title="Stat comparison" meta="stock → current">
            <div className={s.statGrid}>
              {STAT_KEYS.map(k => (
                <div key={k} style={{ display: 'contents' }}>
                  <span title={STAT_NAME[k]}>{STAT_LABEL[k]}</span>
                  <SegBar value={base[k]} bonus={Math.min(10, eff[k]) - base[k]} label={STAT_NAME[k]} />
                  <b>
                    {base[k]}
                    {eff[k] > base[k] && <i> +{(eff[k] - base[k]).toFixed(1)}</i>}
                  </b>
                </div>
              ))}
            </div>
          </HudPanel>
          <HudPanel title="Combat rating" meta={`boss · level ${nextBoss}`}>
            <div className={s.gaugeWrap}>
              <svg viewBox={`0 0 ${G} ${G}`} width="100%" role="img" aria-label={`Combat rating ${rating}, recommended ${rec}`}>
                <path d={`M ${sx} ${sy} A ${R} ${R} 0 1 1 ${arc(max)[0]} ${arc(max)[1]}`} fill="none" stroke="rgba(140,154,192,0.18)" strokeWidth={10} />
                <path d={`M ${sx} ${sy} A ${R} ${R} 0 ${large} 1 ${ex} ${ey}`} fill="none" stroke="var(--ignition)" strokeWidth={10} />
                <line x1={C + (rx - C) * 0.78} y1={C + (ry - C) * 0.78} x2={C + (rx - C) * 1.16} y2={C + (ry - C) * 1.16} stroke="var(--ice)" strokeWidth={3} />
                <text x={C} y={C + 6} textAnchor="middle" fill="var(--frost)" fontFamily="var(--font-title)" fontWeight={900} fontSize={46}>
                  {rating}
                </text>
                <text x={C} y={C + 30} textAnchor="middle" fill="var(--steel)" fontFamily="var(--font-mono)" fontSize={10} letterSpacing="0.2em">
                  RATING
                </text>
              </svg>
              <div className={s.gaugeText}>
                <span>
                  Recommended
                  <br />
                  <b>{rec}</b>
                </span>
                <span className={s.verdict} data-v={v}>
                  {v}
                </span>
              </div>
            </div>
            <p className={s.note}>Numbers are provisional — the Phase 2 bosses set the final scale.</p>
          </HudPanel>
        </div>
      </div>
      <Callout track={hot} anchor={anchor} />
    </Modal>
  );
}
