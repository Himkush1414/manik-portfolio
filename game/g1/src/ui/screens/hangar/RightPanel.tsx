// Right panel (brief §12-13): PILOT card on top, MISSION BRIEFING below with
// BRIEFING | CODEX tabs. The briefing types itself out on first view only
// (skippable); the pilot busts render into the .bust slots (PilotViewport).
import { useEffect, useRef, useState } from 'react';
import s from './hangar.module.css';
import { HudPanel, Tabs, radioKeys } from '../../primitives';
import { MISSION_01, CODEX, PILOTS } from '../../../data/lore';
import { useProfile } from '../../../state/profile.store';
import { useSettings } from '../../../state/settings.store';
import { sfx } from '../../../audio/sfx';
import { PilotBusts } from '../../../pilots/PilotBusts';

function PilotCard() {
  const pilot = useProfile(p => p.pilot);
  const setPilot = useProfile(p => p.setPilot);
  return (
    <HudPanel title="Pilot" meta={`${PILOTS[pilot].rank} ${PILOTS[pilot].name}`} className={s.pilotPanel}>
      <div className={s.pilots} role="radiogroup" aria-label="Pilot">
        <PilotBusts />
        {(['onyx', 'ember'] as const).map(id => {
          const p = PILOTS[id];
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={pilot === id}
              tabIndex={pilot === id ? 0 : -1}
              onKeyDown={radioKeys}
              className={s.pilot}
              onPointerEnter={() => sfx.play('hover')}
              onClick={() => {
                if (pilot === id) return;
                sfx.play('confirm');
                setPilot(id);
              }}
            >
              {/* the live bust renders into this slot (pilots/PilotBusts.tsx) */}
              <span className={s.bust} data-pilot-slot={id} />
              <span className={s.pilotName}>{p.callsign}</span>
              <span className={s.pilotReal}>
                {p.rank} {p.name}
              </span>
              <span className={s.quote}>“{p.quote}”</span>
            </button>
          );
        })}
      </div>
    </HudPanel>
  );
}

/** Typewriter over the briefing paragraphs; instant when already seen. */
function useTypewriter(paragraphs: string[], active: boolean, cps = 90) {
  const total = paragraphs.reduce((a, p) => a + p.length, 0);
  const [n, setN] = useState(active ? 0 : total);
  const raf = useRef(0);
  useEffect(() => {
    if (!active) return;
    const t0 = performance.now();
    const tick = () => {
      const k = Math.min(total, Math.floor(((performance.now() - t0) / 1000) * cps));
      setN(k);
      if (k < total) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [active, total, cps]);
  const skip = () => {
    cancelAnimationFrame(raf.current);
    setN(total);
  };
  let left = n;
  const shown = paragraphs.map(p => {
    const take = Math.max(0, Math.min(p.length, left));
    left -= take;
    return p.slice(0, take);
  });
  return { shown, done: n >= total, skip };
}

function Briefing() {
  const seen = useSettings(st => st.briefingSeen);
  const markSeen = useSettings(st => st.setBriefingSeen);
  const reduce = useSettings(st => st.accessibility.reduceMotion);
  const [animate] = useState(() => !seen && !reduce);
  const { shown, done, skip } = useTypewriter(MISSION_01.body, animate);
  useEffect(() => {
    if (done && !seen) markSeen();
  }, [done, seen, markSeen]);
  const m = MISSION_01;
  const gauge = Math.max(1, Math.round(m.threatLevel * 5));
  return (
    <div className={s.scroll} id="tabpanel-briefing" role="tabpanel" aria-labelledby="tab-briefing" tabIndex={0}>
      <p className={s.classified}>{m.header}</p>
      <h3 className={s.mTitle}>
        <small>Mission {m.number}</small>
        {m.title}
      </h3>
      <div className={s.body} aria-label={[m.salutation, ...m.body].join(' ')}>
        <p aria-hidden>{m.salutation}</p>
        {shown.map((p, i) =>
          p.length ? (
            <p key={i} aria-hidden>
              {p}
              {!done && p.length < m.body[i].length && <span className={s.caret} />}
            </p>
          ) : null,
        )}
        {done && (
          <p className={s.sign} aria-hidden>
            {m.signoff[0]}
            <br />
            {m.signoff[1]}
          </p>
        )}
      </div>
      {!done && (
        <button type="button" className={s.skipType} onClick={skip}>
          SKIP ▸
        </button>
      )}
      <h4 className={s.subhead}>OBJECTIVES</h4>
      <ul className={s.objectives}>
        {m.objectives.map(o => (
          <li key={o}>
            <span className={s.check} aria-hidden />
            {o}
          </li>
        ))}
      </ul>
      <div className={s.meta}>
        <div className={s.threat}>
          <span>
            THREAT <b>{m.threat}</b>
          </span>
          <span className={s.gauge} aria-label={`Threat ${m.threat}`}>
            {Array.from({ length: 5 }, (_, i) => (
              <i key={i} className={i < gauge ? s.on : ''} />
            ))}
          </span>
        </div>
        <span className={s.reward}>+{m.reward} CR</span>
        <span className={s.corr}>
          CORRIDOR
          <br />
          {m.corridor}
        </span>
      </div>
    </div>
  );
}

function Codex() {
  return (
    <div className={s.scroll} id="tabpanel-codex" role="tabpanel" aria-labelledby="tab-codex" tabIndex={0}>
      <div className={s.codex}>
        {CODEX.map(c => (
          <article key={c.id}>
            <h3>{c.title}</h3>
            <small>{c.tag}</small>
            <p>{c.body}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

export function RightPanel() {
  const [tab, setTab] = useState<'briefing' | 'codex'>('briefing');
  return (
    <div className={s.right} data-enter="right">
      <PilotCard />
      <HudPanel title={`Mission ${MISSION_01.number}`} meta={MISSION_01.title} className={s.missionPanel}>
        <Tabs<'briefing' | 'codex'>
          label="Mission"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'briefing', label: 'BRIEFING' },
            { id: 'codex', label: 'CODEX' },
          ]}
        />
        {tab === 'briefing' ? <Briefing /> : <Codex />}
      </HudPanel>
    </div>
  );
}
