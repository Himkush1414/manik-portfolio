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

const FROM: Record<string, gsap.TweenVars> = {
  top: { y: -36 },
  left: { x: -70 },
  right: { x: 70 },
  under: { y: 34 },
  cta: { y: 44 },
};
const ORDER = ['top', 'left', 'right', 'under', 'cta'];

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

  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!shown || !root.current) return;
    const ctx = gsap.context(() => {
      const els = ORDER.map(k => root.current!.querySelector<HTMLElement>(`[data-enter="${k}"]`)).filter(Boolean) as HTMLElement[];
      if (reduce) {
        gsap.fromTo(els, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.25 });
        return;
      }
      els.forEach((el, i) => {
        const key = el.dataset.enter!;
        const u = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
        const from = Object.fromEntries(Object.entries(FROM[key]).map(([k, v]) => [k, (v as number) * u]));
        gsap.fromTo(
          el,
          { ...from, autoAlpha: 0, filter: 'blur(12px)' },
          // only the entering axis: never touch the other (layout) offsets
          { ...Object.fromEntries(Object.keys(from).map(k => [k, 0])), autoAlpha: 1, filter: 'blur(0px)', duration: key === 'cta' ? 0.7 : 0.6, ease: 'expo.out', delay: i * 0.07 + (key === 'cta' ? 0.12 : 0), clearProps: 'filter' },
        );
      });
    }, root);
    return () => ctx.revert();
  }, [shown, reduce]);

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
  return (
    <div ref={root} className={s.root}>
      <div className={s.grain} aria-hidden />
      <div ref={layer} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', transform: 'translate3d(var(--px, 0px), var(--py, 0px), 0)' }}>
        <Inventory />
        <RightPanel />
        <ShipInfo />
      </div>
      <TopBar />
      <StartMission />
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
