import { useCallback, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { viewStore } from './lib/view';
import { FlickerIntro } from './intro/FlickerIntro';
import { Hero } from './hero/Hero';
import { BookCard } from './hero/BookCard';
import { LegacySlot } from './LegacySlot';

// Root of the Contact view. The page is only mounted while the view is on
// screen, and remounted (key = visit) on every entry, so the intro replays on
// each navigation to Contact, never on scroll, and no listener runs while
// another view is showing.
export function ContactV2() {
  const { active, visit } = useSyncExternalStore(viewStore.subscribe, viewStore.get);
  return active ? <ContactPage key={visit} /> : null;
}

function ContactPage() {
  const cardRef = useRef<HTMLAnchorElement>(null);
  const [introDone, setIntroDone] = useState(false);
  const onIntroDone = useCallback(() => setIntroDone(true), []);

  // The static black placeholder in index.html (.ctv2-boot) covers the view
  // until this page and its intro overlay are in the DOM.
  useLayoutEffect(() => {
    const html = document.documentElement;
    html.classList.add('ctv2-ready');
    return () => html.classList.remove('ctv2-ready', 'ctv2-intro-done');
  }, []);
  useLayoutEffect(() => {
    document.documentElement.classList.toggle('ctv2-intro-done', introDone);
  }, [introDone]);

  return (
    <div id="ctv2" className="ctv2">
      {!introDone && <FlickerIntro onDone={onIntroDone} />}
      <div className="ctv2-curtain">
        <Hero cardRef={cardRef} />
        <LegacySlot />
      </div>
      <BookCard ref={cardRef} />
    </div>
  );
}
