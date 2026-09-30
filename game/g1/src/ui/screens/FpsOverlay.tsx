// Settings > Graphics > Show FPS: a small corner readout (rAF-measured,
// updated twice a second so it never costs a React render per frame).
import { useEffect, useRef } from 'react';
import { useSettings } from '../../state/settings.store';

export function FpsOverlay() {
  const show = useSettings(s => s.graphics.showFps);
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!show) return;
    let frames = 0, last = performance.now(), raf = 0;
    const tick = (now: number) => {
      frames++;
      if (now - last >= 500) {
        if (el.current) el.current.textContent = `${Math.round((frames * 1000) / (now - last))} FPS`;
        frames = 0;
        last = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [show]);
  if (!show) return null;
  return (
    <div
      ref={el}
      aria-hidden
      style={{ position: 'fixed', left: 'calc(var(--u) * 48)', bottom: 'calc(var(--u) * 44)', zIndex: 80, font: '500 calc(var(--u) * 12)/1 var(--font-mono)', letterSpacing: '0.16em', color: 'var(--ok)', pointerEvents: 'none' }}
    >
      — FPS
    </div>
  );
}
