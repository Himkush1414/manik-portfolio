import { useLayoutEffect, useRef } from 'react';

// TEMPORARY (stage 1 only): keeps the existing Contact content (intro text,
// Book a Call link and the message form with its handler in main.tsx) working
// while the new sections are built. The original markup stays in index.html;
// this moves that node into the curtain, right after the hero, so it slides
// over the pinned hero, and puts it back when the page unmounts.
// Replaced by the new Manifesto / Services / Footer sections in later stages.
export function LegacySlot() {
  const slotRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const slot = slotRef.current;
    const legacy = document.querySelector<HTMLElement>('#proj-view-contact .lv7-contact');
    if (!slot || !legacy) return undefined;
    const home = legacy.parentElement;
    slot.appendChild(legacy);
    return () => {
      home?.appendChild(legacy);
    };
  }, []);
  return <div ref={slotRef} className="ctv2-legacy" />;
}
