import { useLayoutEffect, useRef } from 'react';

// Sizes one line of text so it spans its parent's width (minus `slack`).
// Font size is linear in text width (tracking is in em), so a single
// measure-and-scale is exact: next = current * target / measured.
// Runs before paint, again once the web font has loaded, and on every
// resize of the parent. CSS gives a vw-based starting size (see contact.css),
// so the line is already close before this runs and nothing shifts layout
// (the wordmark is absolutely positioned).
export function FitText({ text, className, slack = 0.008 }: { text: string; className?: string; slack?: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    const box = el?.parentElement;
    if (!el || !box) return undefined;
    let raf = 0;

    const fit = () => {
      raf = 0;
      const target = box.clientWidth * (1 - slack);
      const measured = el.getBoundingClientRect().width;
      if (!target || !measured) return;
      const current = parseFloat(getComputedStyle(el).fontSize);
      const next = (current * target) / measured;
      if (Math.abs(next - current) > 0.05) el.style.fontSize = `${next.toFixed(2)}px`;
    };
    const queue = () => {
      if (!raf) raf = requestAnimationFrame(fit);
    };

    fit();
    const ro = new ResizeObserver(queue);
    ro.observe(box);
    const fonts = document.fonts;
    fonts?.ready.then(fit).catch(() => undefined);
    fonts?.addEventListener?.('loadingdone', queue);
    return () => {
      ro.disconnect();
      fonts?.removeEventListener?.('loadingdone', queue);
      cancelAnimationFrame(raf);
    };
  }, [text, slack]);

  return (
    <span ref={ref} className={className}>
      {text}
    </span>
  );
}
