import { useEffect, useRef } from 'react';
import { COPY } from '../config';
import { Chip } from '../components/Chip';
import { clamp01, prefersReducedMotion, subscribeScroll } from '../lib/scroll';

// White section that slides over the pinned hero. The text column starts at
// the 50% line (full width on portrait screens). The headline fades in line
// by line, light grey -> black, linked to scroll: each word is a span; after
// layout the words are grouped into visual lines by their offsetTop, and a
// line goes from 16% to 100% opacity while its top travels from 88% to 52% of
// the viewport height. Positions are cached (re-measured on resize / font
// load), so the scroll pass only writes opacity.
export function Manifesto() {
  const headRef = useRef<HTMLHeadingElement>(null);
  const words = COPY.manifestoHeadline.split(' ');

  useEffect(() => {
    const head = headRef.current;
    if (!head) return undefined;
    if (prefersReducedMotion()) {
      head.classList.add('is-static');
      return undefined;
    }
    const spans = Array.from(head.querySelectorAll<HTMLElement>('.ctv2-w'));
    let lines: { top: number; els: HTMLElement[] }[] = [];
    let lastY = 0;

    const measure = () => {
      const docTop = head.getBoundingClientRect().top + window.scrollY;
      const byTop = new Map<number, HTMLElement[]>();
      for (const el of spans) {
        const key = Math.round(el.offsetTop);
        byTop.set(key, [...(byTop.get(key) ?? []), el]);
      }
      lines = Array.from(byTop.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([top, els]) => ({ top: docTop + top, els }));
      paint(lastY);
    };

    const shown = new Map<HTMLElement[], string>();
    const paint = (y: number) => {
      lastY = y;
      const vh = window.innerHeight;
      for (const line of lines) {
        const onScreen = line.top - y;
        const p = clamp01((vh * 0.88 - onScreen) / (vh * 0.36));
        const o = (0.16 + 0.84 * p).toFixed(3);
        if (shown.get(line.els) === o) continue;
        shown.set(line.els, o);
        for (const el of line.els) el.style.opacity = o;
      }
    };

    const ro = new ResizeObserver(measure);
    ro.observe(head);
    document.fonts?.ready.then(measure).catch(() => undefined);
    const unsubscribe = subscribeScroll(paint);
    measure();
    return () => {
      ro.disconnect();
      unsubscribe();
    };
  }, []);

  return (
    <section className="ctv2-manifesto" data-ctv2-section="manifesto" aria-labelledby="ctv2-manifesto-title">
      <div className="ctv2-manifesto__col">
        <Chip label={COPY.manifestoChip} />
        <h2 ref={headRef} id="ctv2-manifesto-title" className="ctv2-manifesto__head">
          {words.map((w, i) => (
            <span key={i}>
              <span className="ctv2-w">{w}</span>
              {i < words.length - 1 ? ' ' : ''}
            </span>
          ))}
        </h2>
        <div className="ctv2-manifesto__body">
          <p>{COPY.manifestoP1}</p>
          <p>{COPY.manifestoP2}</p>
        </div>
      </div>
    </section>
  );
}
