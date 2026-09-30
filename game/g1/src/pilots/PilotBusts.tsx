// Host for the live pilot busts (brief §13): a canvas over the pilot card
// grid. Preferred path: transferControlToOffscreen -> bust.worker.ts renders
// both busts off the main thread (a second WebGL context + shader compile on
// the main thread cost 165 + ~700 ms of long tasks at the UI's entrance).
// Fallback (no OffscreenCanvas WebGL): the same renderer on the main thread,
// started from idle time. The host only forwards layout, pointer and state.
import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { createBustRenderer, type BustRenderer, type BustState, type PilotId, type Rect } from './bustRenderer';
import { useProfile } from '../state/profile.store';
import { useSettings } from '../state/settings.store';
import { registerDebug } from '../debug/debugApi';

export function PilotBusts() {
  const anchor = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    // a FRESH canvas per mount (StrictMode replays effects; a transferred or
    // force-lost canvas can never give a context again)
    const host = anchor.current!.parentElement!;
    const el = document.createElement('canvas');
    el.setAttribute('aria-hidden', 'true');
    Object.assign(el.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '1', opacity: '0', transition: 'opacity 600ms ease' });
    host.appendChild(el);

    const measure = (): Pick<BustState, 'width' | 'height' | 'dpr' | 'rects'> => {
      const hr = host.getBoundingClientRect();
      const rects: Partial<Record<PilotId, Rect>> = {};
      for (const id of ['onyx', 'ember'] as const) {
        const slot = host.querySelector<HTMLElement>(`[data-pilot-slot="${id}"]`);
        if (!slot) continue;
        const r = slot.getBoundingClientRect();
        rects[id] = { x: r.left - hr.left, y: r.top - hr.top, w: r.width, h: r.height };
      }
      return { width: Math.max(1, Math.round(hr.width)), height: Math.max(1, Math.round(hr.height)), dpr: Math.min(2, window.devicePixelRatio || 1), rects };
    };
    const snapshot = (): BustState => ({
      ...measure(),
      selected: useProfile.getState().pilot,
      reduceMotion: useSettings.getState().accessibility.reduceMotion,
      pointer: null,
      visible: !document.hidden,
    });

    let worker: Worker | null = null;
    let local: BustRenderer | null = null;
    let tris: Record<PilotId, number> | null = null;
    const send = (s: Partial<BustState>) => {
      if (worker) worker.postMessage({ type: 'update', state: s });
      else local?.update(s);
    };

    let cancelled = false;
    let tickFn: ((t: number, dt: number) => void) | null = null;
    // start from idle time, after the UI's entrance stagger has settled
    const idle = (window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 400))) as (cb: () => void, o?: { timeout: number }) => number;
    const start = () => {
      if (cancelled) return;
      const canOffscreen = 'transferControlToOffscreen' in el && typeof OffscreenCanvas !== 'undefined';
      if (canOffscreen) {
        try {
          const off = el.transferControlToOffscreen();
          worker = new Worker(new URL('./bust.worker.ts', import.meta.url), { type: 'module', name: 'g1-busts' });
          worker.onmessage = (e: MessageEvent<{ type: string; tris?: Record<PilotId, number> }>) => {
            if (e.data.tris) tris = e.data.tris;
            if (e.data.type === 'ready') el.style.opacity = '1';
          };
          worker.postMessage({ type: 'init', canvas: off, state: snapshot() }, [off]);
          return;
        } catch {
          worker = null; // fall through to the main-thread renderer
        }
      }
      try {
        local = createBustRenderer(el, snapshot());
        void local.ready.then(() => {
          el.style.opacity = '1';
          tris = local?.tris() ?? null;
        });
        tickFn = (_t, dt) => local?.frame(dt);
        gsap.ticker.add(tickFn);
      } catch {
        el.remove(); // no context available: the cards still work without busts
      }
    };
    const startTimer = window.setTimeout(() => idle(start, { timeout: 2500 }), 1200);

    const ro = new ResizeObserver(() => send(measure()));
    ro.observe(host);
    let pending = false;
    const move = (e: PointerEvent) => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        const hr = host.getBoundingClientRect();
        send({ pointer: { x: e.clientX - hr.left, y: e.clientY - hr.top } });
      });
    };
    window.addEventListener('pointermove', move);
    const vis = () => send({ visible: !document.hidden });
    document.addEventListener('visibilitychange', vis);
    const unsubP = useProfile.subscribe((s, prev) => void (s.pilot !== prev.pilot && send({ selected: s.pilot })));
    const unsubS = useSettings.subscribe((s, prev) => void (s.accessibility !== prev.accessibility && send({ reduceMotion: s.accessibility.reduceMotion })));
    registerDebug('pilots', { tris: () => tris, mode: () => (worker ? 'worker' : local ? 'main' : 'pending') });

    return () => {
      cancelled = true;
      window.clearTimeout(startTimer);
      ro.disconnect();
      window.removeEventListener('pointermove', move);
      document.removeEventListener('visibilitychange', vis);
      unsubP();
      unsubS();
      if (tickFn) gsap.ticker.remove(tickFn);
      if (worker) {
        worker.postMessage({ type: 'dispose' });
        worker.terminate();
      }
      local?.dispose();
      el.remove();
    };
  }, []);
  return <span ref={anchor} hidden />;
}
