// Hangar UI (brief §12): HTML overlay above the canvas. Enters with a stagger
// as the boot letterbox retracts (panels slide in from their edges with a
// blur-in, START MISSION last); panels drift +-6 px opposite the mouse; Enter
// launches when nothing else has focus. Below 900 px a styled notice shows.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import s from './hangar.module.css';
import { TopBar } from './TopBar';
import { Inventory } from './Inventory';
import { ShipInfo } from './ShipInfo';
import { RightPanel } from './RightPanel';
import { StartMission } from './StartMission';
import { Toasts } from '../../primitives';
import { useFlow } from '../../../app/flow';
import { useSettings } from '../../../state/settings.store';
import { useUi } from '../../../state/ui.store';
import { bus } from '../../../core/bus';
import { startMission } from './hangarActions';
import { UpgradesModal } from '../upgrades/UpgradesModal';
import { SettingsModal } from '../settings/SettingsModal';

const FROM: Record<string, { x?: number; y?: number }> = {
  top: { y: -36 },
  left: { x: -70 },
  right: { x: 70 },
  under: { y: 34 },
  cta: { y: 44 },
};
const ORDER = ['top', 'left', 'right', 'under', 'cta'] as const;
type PanelKey = (typeof ORDER)[number];
/** entrance stagger (s) and durations — the Phase 1 values */
const STAGGER = 0.07, CTA_EXTRA = 0.12, DUR = 0.6, DUR_CTA = 0.7;

export function HangarUI() {
  const flowState = useFlow(f => f.state);
  const inHangar = flowState.startsWith('hangar.');
  const reduce = useSettings(st => st.accessibility.reduceMotion);
  // shows on the boot's hand-over beat (letterbox retract) or on any hangar entry
  const [shown, setShown] = useState(inHangar);
  useEffect(() => bus.on('hangarUi:enter', () => setShown(true)), []);
  useEffect(() => {
    if (inHangar) setShown(true);
  }, [inHangar]);

  // Staged mount + entrance (brief §4 carry-over (a)): the five panels mount
  // ONE PER TASK and each enters with a Web Animations keyframe. Phase 1 mounted
  // all of them in one commit and let GSAP read every panel's computed style —
  // a ~66 ms task (30 ms of forced style + layout) as the boot handed over.
  const root = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(0);
  const t0 = useRef(0);
  useEffect(() => {
    if (!shown) {
      setMounted(0);
      return;
    }
    t0.current = performance.now();
    let n = 0, raf = 0;
    const next = () => {
      n++;
      setMounted(n);
      if (n < ORDER.length) raf = requestAnimationFrame(next);
    };
    raf = requestAnimationFrame(next);
    return () => cancelAnimationFrame(raf);
  }, [shown]);
  const anims = useRef<Animation[]>([]);
  const animated = useRef(0);
  useEffect(
    () => () => {
      anims.current.forEach(a => a.cancel());
      anims.current = [];
      animated.current = 0;
    },
    [shown],
  );
  useLayoutEffect(() => {
    if (!root.current) return;
    for (; animated.current < mounted; animated.current++) {
      const i = animated.current;
      const key: PanelKey = ORDER[i];
      const el = root.current.querySelector<HTMLElement>(`[data-enter="${key}"]`);
      if (!el || typeof el.animate !== 'function') continue;
      const elapsed = (performance.now() - t0.current) / 1000;
      const delay = Math.max(0, i * STAGGER + (key === 'cta' ? CTA_EXTRA : 0) - elapsed) * 1000;
      if (reduce) {
        anims.current.push(el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250, delay, fill: 'backwards' }));
        continue;
      }
      const u = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
      const f = FROM[key];
      const from = `translate(${(f.x ?? 0) * u}px, ${(f.y ?? 0) * u}px)`;
      anims.current.push(
        el.animate(
          [
            { transform: from, opacity: 0, filter: 'blur(12px)', visibility: 'hidden', offset: 0 },
            { visibility: 'visible', offset: 0.001 },
            { transform: 'translate(0px, 0px)', opacity: 1, filter: 'blur(0px)', visibility: 'visible', offset: 1 },
          ],
          { duration: (key === 'cta' ? DUR_CTA : DUR) * 1000, delay, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'backwards' },
        ),
      );
    }
  }, [mounted, reduce]);
  const has = (k: PanelKey) => mounted > ORDER.indexOf(k);

  // parallax: the panel layer drifts opposite the mouse (critically damped)
  const layer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!shown) return;
    const target = { x: 0, y: 0 }, cur = { x: 0, y: 0, vx: 0, vy: 0 };
    const move = (e: PointerEvent) => {
      target.x = (e.clientX / window.innerWidth) * 2 - 1;
      target.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const tick = (_t: number, dtMs: number) => {
      const dt = Math.min(dtMs / 1000, 0.05), k = 30, c = 2 * Math.sqrt(k);
      const still = useSettings.getState().accessibility.reduceMotion;
      const tx = still ? 0 : target.x, ty = still ? 0 : target.y;
      cur.vx += (k * (tx - cur.x) - c * cur.vx) * dt;
      cur.vy += (k * (ty - cur.y) - c * cur.vy) * dt;
      cur.x += cur.vx * dt;
      cur.y += cur.vy * dt;
      layer.current?.style.setProperty('--px', (-cur.x * 6).toFixed(2) + 'px');
      layer.current?.style.setProperty('--py', (-cur.y * 6).toFixed(2) + 'px');
    };
    window.addEventListener('pointermove', move);
    gsap.ticker.add(tick);
    return () => {
      window.removeEventListener('pointermove', move);
      gsap.ticker.remove(tick);
    };
  }, [shown]);

  // Enter = START MISSION when focus is not on another control
  useEffect(() => {
    if (!shown) return;
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.repeat) return;
      const a = document.activeElement;
      if (a && a !== document.body && a.tagName !== 'CANVAS') return;
      if (useFlow.getState().state !== 'hangar.idle' || useUi.getState().modal) return;
      startMission();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [shown]);

  if (!shown) return null;
  // DOM order = Tab order: top bar -> inventory -> ship block -> START
  // MISSION -> pilot / briefing. Both panel layers share the parallax vars.
  const drift = { position: 'absolute', inset: 0, pointerEvents: 'none', transform: 'translate3d(var(--px, 0px), var(--py, 0px), 0)' } as const;
  return (
    <div ref={root} className={s.root} data-modal={flowState === 'hangar.upgrades' || flowState === 'hangar.settings'} data-launch={flowState.startsWith('launch.') || flowState.startsWith('mission.')}>
      <div className={s.grain} aria-hidden />
      {has('top') && <TopBar />}
      <div ref={layer} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={drift}>
          {has('left') && <Inventory />}
          {has('under') && <ShipInfo />}
        </div>
        {has('cta') && <StartMission />}
        <div style={drift}>{has('right') && <RightPanel />}</div>
      </div>
      {flowState === 'hangar.upgrades' && <UpgradesModal />}
      {flowState === 'hangar.settings' && <SettingsModal />}
      <Toasts />
      <div className={s.small} role="alert">
        <div>
          <b>BEST ON DESKTOP</b>
          MOUSE + KEYBOARD
          <br />
          Widen the window to at least 900 px to fly.
        </div>
      </div>
    </div>
  );
}
