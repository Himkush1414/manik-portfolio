import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { CONTACT_CONFIG } from '../config';
import { prefersReducedMotion } from '../lib/scroll';
import { ACCENT, LIT, buildSchedule, type CellState } from './schedule';

// Fluorescent-tube intro. The real page is already rendered underneath; this
// is a fixed grid of black covers on top of it. Each cover switches with hard
// cuts (no transitions) following schedule.ts, so the hero image, wordmark and
// top-right cluster appear piece by piece. Unmounted when the run ends, so it
// costs nothing afterwards. Reduced motion: one plain 300 ms fade instead.

type Layout = { cols: number; rows: number; rowSizes: string };

function pickLayout(): Layout {
  const portrait = window.matchMedia('(max-width: 639px), (max-aspect-ratio: 4/5)').matches;
  return portrait
    ? { cols: 2, rows: 4, rowSizes: 'repeat(4, 1fr)' }
    : { cols: 4, rows: 3, rowSizes: '43fr 43fr 14fr' };
}

// The strip transition (lv6-transition.ts) and the first-visit loader both sit
// above this view while they run; the intro waits until both are gone so the
// whole flicker is actually seen.
function screenIsClear() {
  if (document.querySelector('#lv6-transition.is-active, #lv6-transition-mobile.is-active')) return false;
  const loader = document.getElementById('home-loader');
  return !loader || getComputedStyle(loader).display === 'none';
}

export function FlickerIntro({ onDone }: { onDone: () => void }) {
  const [layout] = useState(pickLayout);
  const [finished, setFinished] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const schedule = useMemo(() => buildSchedule(layout.cols, layout.rows), [layout]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const cells = Array.from(root.children) as HTMLElement[];
    let raf = 0;
    let fadeTimer = 0;
    let startedAt = 0;
    const shown: (CellState | -1)[] = cells.map(() => -1);
    const cursor = cells.map(() => -1);

    const finish = () => {
      setFinished(true);
      doneRef.current();
    };

    const paint = (now: number) => {
      const t = now - startedAt;
      for (let i = 0; i < cells.length; i++) {
        const track = schedule.tracks[i];
        let c = cursor[i];
        while (c + 1 < track.length && track[c + 1].t <= t) c++;
        cursor[i] = c;
        const s: CellState = c < 0 ? 0 : track[c].s;
        if (s !== shown[i]) {
          shown[i] = s;
          cells[i].dataset.s = s === LIT ? 'lit' : s === ACCENT ? 'accent' : 'cover';
        }
      }
      if (t >= schedule.end) finish();
      else raf = requestAnimationFrame(paint);
    };

    const begin = () => {
      if (prefersReducedMotion()) {
        root.classList.add('is-fading');
        fadeTimer = window.setTimeout(finish, 320);
        return;
      }
      startedAt = performance.now();
      raf = requestAnimationFrame(paint);
    };

    const wait = () => {
      if (screenIsClear()) begin();
      else raf = requestAnimationFrame(wait);
    };
    wait();

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(fadeTimer);
    };
  }, [schedule]);

  if (finished) return null;
  return (
    <div
      ref={rootRef}
      className="ctv2-intro"
      aria-hidden="true"
      style={
        {
          gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
          gridTemplateRows: layout.rowSizes,
          '--ctv2-accent': CONTACT_CONFIG.accent,
        } as CSSProperties
      }
    >
      {Array.from({ length: layout.cols * layout.rows }, (_, i) => (
        <span key={i} className="ctv2-intro__cell" data-s="cover" />
      ))}
    </div>
  );
}
