import { useEffect, useRef, type RefObject } from 'react';
import { CONTACT_CONFIG as C } from '../config';
import { FitText } from '../components/FitText';
import { LiveClock } from '../components/LiveClock';
import { clamp01, prefersReducedMotion, subscribeScroll } from '../lib/scroll';
import { yearNow } from '../lib/time';

// Hero: full-bleed image, giant edge-to-edge wordmark at the bottom, two small
// text blocks above it, and Row 1 of the top-right cluster (links / name /
// live time). It's sticky; the next section slides over it like a curtain.
//
// Scroll progress p (0 → 1 over the hero's own height) drives, with transform
// and opacity only: image darkens (0 → .8) and scales (1 → 1.05); wordmark
// rises 12vh and fades to 50%; the small blocks fade out; Row 1 fades out in
// the first 30% and the fixed Book-a-call card (cardRef) lifts into its space.
export function Hero({ cardRef }: { cardRef: RefObject<HTMLElement | null> }) {
  const heroRef = useRef<HTMLElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const shadeRef = useRef<HTMLDivElement>(null);
  const wordRef = useRef<HTMLDivElement>(null);
  const metaRef = useRef<HTMLDivElement>(null);
  const row1Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return undefined;
    let height = hero.offsetHeight || window.innerHeight;
    let row1Lift = 0;
    const measure = () => {
      height = hero.offsetHeight || window.innerHeight;
      const row1 = row1Ref.current;
      // the card moves up by Row 1's height plus the gap between them
      row1Lift = row1 ? row1.offsetHeight + 8 : 0;
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(hero);

    // reduced motion: keep the fades and the darkening, drop scale/parallax
    const still = prefersReducedMotion();
    let last = -1;
    const unsubscribe = subscribeScroll(y => {
      const p = clamp01(y / height);
      if (p === last) return;
      last = p;
      const k = clamp01(p / 0.3);
      if (mediaRef.current && !still) mediaRef.current.style.transform = `scale(${(1 + 0.05 * p).toFixed(4)})`;
      if (shadeRef.current) shadeRef.current.style.opacity = (0.8 * p).toFixed(3);
      if (wordRef.current) {
        if (!still) wordRef.current.style.transform = `translate3d(0, ${(-12 * p).toFixed(3)}vh, 0)`;
        wordRef.current.style.opacity = (1 - 0.5 * p).toFixed(3);
      }
      if (metaRef.current) metaRef.current.style.opacity = (1 - clamp01(p / 0.45)).toFixed(3);
      if (row1Ref.current) {
        row1Ref.current.style.opacity = (1 - k).toFixed(3);
        row1Ref.current.style.transform = `translate3d(0, ${(-10 * k).toFixed(2)}px, 0)`;
        row1Ref.current.style.visibility = k >= 1 ? 'hidden' : '';
      }
      if (cardRef.current) cardRef.current.style.transform = `translate3d(0, ${(-row1Lift * k).toFixed(2)}px, 0)`;
    });
    return () => {
      ro.disconnect();
      unsubscribe();
    };
  }, [cardRef]);

  return (
    <header ref={heroRef} className="ctv2-hero">
      <div ref={mediaRef} className="ctv2-hero__media">
        <img
          src={C.heroImage}
          alt={C.heroImageAlt}
          width={1920}
          height={1080}
          decoding="async"
          {...{ fetchpriority: 'high' }}
          sizes="100vw"
          draggable={false}
        />
      </div>
      <div className="ctv2-hero__vignette" aria-hidden="true" />
      <div ref={shadeRef} className="ctv2-hero__shade" aria-hidden="true" />

      <div ref={row1Ref} className="ctv2-row1">
        <nav className="ctv2-row1__links" aria-label="Social">
          <a href={C.linkedin} target="_blank" rel="noopener noreferrer">
            LinkedIn
          </a>
          <span aria-hidden="true">,&nbsp;</span>
          <a href={C.github} target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
        </nav>
        <p className="ctv2-row1__who">
          <span>{C.name}</span>
          <LiveClock className="ctv2-clock" />
        </p>
      </div>

      <div className="ctv2-hero__bottom">
        <div ref={metaRef} className="ctv2-hero__meta">
          <p className="ctv2-hero__tagline">
            {C.tagline.map(line => (
              <span key={line}>{line}</span>
            ))}
          </p>
          <p className="ctv2-hero__mark">
            <span>/Contact</span>
            <span>&copy;{yearNow()}</span>
          </p>
        </div>
        <div ref={wordRef} className="ctv2-hero__word">
          <h1 className="ctv2-word">
            <span className="ctv2-sr">Contact, </span>
            <FitText text={C.heroWord} className="ctv2-word__fit" />
          </h1>
        </div>
      </div>
    </header>
  );
}
