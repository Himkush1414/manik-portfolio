// Mission HUD (brief §9): the tactical reticle canvas (Planet 1 §1.3), ship pipper, hit / kill
// markers, 8 pooled threat chevrons, SHIELD / HULL bars (danger pulse under
// 25 %), boost energy + speed + roll-cooldown ring, score + combo ring,
// progress, credits, target panel. Static DOM rendered once (~60 nodes,
// budget 120); everything that moves is written by the scene-side
// MissionHudDriver through `hudDom` refs — transforms per frame, text / bars
// at the sim's 20 Hz HUD refresh. No React state per frame, no
// backdrop-filter. In the cockpit view the overlay goes light (reticle,
// markers, threats): the MFDs carry the rest. Flight layer: altitude + ground
// clearance (Planet 1 §1.1: free climbing, no warnings), close-call / skim /
// wall-run callouts, and the tutorial prompt built from the player's real
// bindings.
import { useFlow } from '../../../app/flow';
import { useSettings } from '../../../state/settings.store';
import { CAPS } from '../../../data/mission';
import { hudDom, RING_C } from './hudDom';
import { reticleCanvas } from './reticleCanvas';
import s from './hud.module.css';

type Key = Exclude<keyof typeof hudDom, 'threats'>;
const set = (k: Key) => (el: Element | null) => void ((hudDom as Record<Key, Element | null>)[k] = el);
const attachReticle = (el: HTMLCanvasElement | null) => reticleCanvas.attach(el);
const THREATS = Array.from({ length: CAPS.threats }, (_, i) => i);

export function MissionHUD() {
  const on = useFlow(f => f.state === 'mission.playing' || f.state === 'mission.paused' || f.state === 'mission.bossIntro' || f.state === 'mission.dying' || f.state === 'mission.completing');
  const reduceFlash = useSettings(st => st.accessibility.reduceFlashing);
  if (!on) return null;
  return (
    <div className={s.hud} ref={set('root')} data-view="overlay" data-reduce-flash={reduceFlash} aria-hidden="true">
      <div className={s.altBox}>
        <span className={s.label}>ALT</span>
        <span className={s.altVal} ref={set('alt')}>0</span>
        <span className={s.label}>CLR</span>
        <span className={s.altVal} ref={set('clr')}>0</span>
      </div>
      <div className={s.callout} ref={set('callout')}>CLOSE CALL</div>
      <div className={s.streak} ref={set('streak')}>SKIM</div>
      <div className={s.prompt} ref={set('prompt')} data-on="false">
        <span className={s.promptVerb} ref={set('promptVerb')} />
        <span className={s.promptKeys} ref={set('promptKeys')} />
      </div>
      <canvas className={s.reticleCanvas} ref={attachReticle} />
      <div className={s.reticle} ref={set('reticle')}>
        <div className={s.hit} ref={set('hit')} />
        <div className={s.kill} ref={set('kill')} />
      </div>
      <div className={s.pipper} ref={set('pipper')} />
      <div className={s.threats}>
        {THREATS.map(i => (
          <div key={i} className={s.chev} ref={el => void (el && (hudDom.threats[i] = el))} />
        ))}
      </div>

      <div className={`${s.panel} ${s.tl}`}>
        <span className={s.label}>SCORE</span>
        <span className={s.score} ref={set('score')}>0</span>
        <div className={s.combo}>
          <svg viewBox="0 0 36 36" className={s.ring}>
            <circle cx="18" cy="18" r="15" className={s.ringTrack} />
            <circle cx="18" cy="18" r="15" className={s.ringFill} ref={set('comboRing')} strokeDasharray={RING_C} strokeDashoffset={RING_C} />
          </svg>
          <span ref={set('combo')}>x1</span>
        </div>
      </div>

      <div className={`${s.panel} ${s.tc}`}>
        <span className={s.label}>ROUTE</span>
        <div className={s.track}>
          <div className={`${s.fill} ${s.fillIce}`} ref={set('progress')} />
        </div>
        <span className={s.small} ref={set('progressPct')}>0%</span>
      </div>

      <div className={`${s.panel} ${s.tr}`}>
        <span className={s.label}>CREDITS</span>
        <span className={s.value} ref={set('credits')}>0</span>
      </div>

      <div className={`${s.panel} ${s.bl}`}>
        <div className={s.bar} ref={set('shieldBlock')}>
          <span className={s.label}>SHIELD</span>
          <span className={s.small} ref={set('shieldVal')}>100</span>
          <div className={`${s.track} ${s.seg}`}>
            <div className={`${s.fill} ${s.fillIce}`} ref={set('shield')} />
          </div>
        </div>
        <div className={s.bar} ref={set('hullBlock')}>
          <span className={s.label}>HULL</span>
          <span className={s.small} ref={set('hullVal')}>100</span>
          <div className={`${s.track} ${s.seg}`}>
            <div className={`${s.fill} ${s.fillHot}`} ref={set('hull')} />
          </div>
        </div>
      </div>

      <div className={`${s.panel} ${s.br}`}>
        <div className={s.bar} ref={set('boostBlock')}>
          <span className={s.label}>BOOST</span>
          <div className={s.track}>
            <div className={`${s.fill} ${s.fillHot}`} ref={set('boost')} />
          </div>
        </div>
        <div className={s.speedRow}>
          <span className={s.speed} ref={set('speed')}>0</span>
          <span className={s.label}>M/S</span>
          <svg viewBox="0 0 36 36" className={s.ring} aria-label="roll">
            <circle cx="18" cy="18" r="15" className={s.ringTrack} />
            <circle cx="18" cy="18" r="15" className={s.ringFill} ref={set('rollRing')} strokeDasharray={RING_C} strokeDashoffset={0} />
          </svg>
        </div>
      </div>

      <div className={`${s.panel} ${s.target}`} ref={set('target')} data-on="false">
        <span className={s.label}>TARGET</span>
        <span className={s.value} ref={set('targetName')}>CONTACT</span>
        <div className={s.track}>
          <div className={`${s.fill} ${s.fillDanger}`} ref={set('targetHp')} />
        </div>
      </div>
    </div>
  );
}
