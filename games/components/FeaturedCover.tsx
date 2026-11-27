import { useEffect, useRef, type PointerEvent } from 'react';
import type { Game } from '../games.config';

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const fineHover = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/** One cover per game, stacked; the selected one is shown and the switch cross-fades (CSS). */
export function FeaturedCover({ games, selected }: { games: Game[]; selected: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const raf = useRef(0);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  // subtle tilt + parallax toward the pointer (desktop pointers only, never with reduced motion)
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || reduced() || !fineHover()) return;
    const box = boxRef.current;
    if (!box) return;
    const r = box.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 2 - 1;
    const y = ((e.clientY - r.top) / r.height) * 2 - 1;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      box.style.setProperty('--tx', x.toFixed(3));
      box.style.setProperty('--ty', y.toFixed(3));
    });
  };
  const onLeave = () => {
    cancelAnimationFrame(raf.current);
    boxRef.current?.style.setProperty('--tx', '0');
    boxRef.current?.style.setProperty('--ty', '0');
  };

  const game = games.find(g => g.slug === selected)!;
  return (
    <div ref={boxRef} className="gm-feature" onPointerMove={onMove} onPointerLeave={onLeave}>
      <div className="gm-feature__tilt">
        {games.map((g, i) => {
          const on = g.slug === selected;
          return (
            <picture key={g.slug} className={`gm-cover${on ? ' is-on' : ''}`}>
              <source media="(max-width: 767px)" type="image/avif" srcSet={g.cover.port.avif} />
              <source media="(max-width: 767px)" type="image/webp" srcSet={g.cover.port.webp} />
              <source type="image/avif" srcSet={g.cover.land.avif} />
              <img
                src={g.cover.land.webp}
                alt={on ? g.cover.alt : ''}
                aria-hidden={on ? undefined : true}
                width={1920}
                height={1200}
                decoding="async"
                loading={i === 0 ? 'eager' : 'lazy'}
                // React 18 only knows the lowercase attribute
                {...{ fetchpriority: i === 0 ? 'high' : 'auto' }}
              />
            </picture>
          );
        })}
        <span className="gm-feature__vignette" aria-hidden="true" />
      </div>
      <span className={`gm-pill gm-pill--${game.status}`}>
        <span className="gm-pill__dot" aria-hidden="true" />
        {game.status === 'live' ? 'Live' : 'Early build'}
      </span>
    </div>
  );
}
