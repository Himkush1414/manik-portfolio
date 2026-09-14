// /lab/lv8 — the hero's ambient bar field: a full-viewport row of vertical
// bars of varying width, each its own dark-void-to-lit-accent gradient,
// breathing in brightness on a slow, independently-phased cycle — reads as
// folded fabric or light refracting through material, not a mechanical
// scanline sweep.
//
// Deliberately NOT a canvas/shader: every bar is a plain <div>, its width
// a CSS flex-grow ratio and its breathing motion a CSS @keyframes
// animation — both handled by the browser's own layout/compositor, not by
// this file re-rendering anything per frame. This file's only job is to
// build the bar elements once (and again on a major resize) and hand each
// one a handful of randomized CSS custom properties; after that there is
// no per-frame JS cost at all, which is what keeps this smooth on a
// mid-range mobile GPU without a heavier canvas/WebGL approach.
const container = document.getElementById('lv8-hero-bars');

if (container) {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // average bar width in px — bar COUNT is derived from viewport width
  // divided by this, so density stays constant (never thins out) on an
  // ultra-wide screen instead of stretching a fixed bar count.
  const TARGET_BAR_WIDTH = 20;
  const MIN_BARS = 24;
  const VIOLET_CHANCE = 0.07; // secondary accent, used sparingly — see palette

  let lastCount = 0;

  function buildBars() {
    const width = container!.clientWidth || window.innerWidth;
    const count = Math.max(MIN_BARS, Math.round(width / TARGET_BAR_WIDTH));
    // skip rebuilding for trivial width changes (e.g. mobile browser
    // chrome showing/hiding) — only when the ideal count actually shifts
    if (Math.abs(count - lastCount) < 2 && lastCount !== 0) return;
    lastCount = count;

    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const bar = document.createElement('div');
      bar.className = 'lv8-hero__bar';

      const grow = 0.55 + Math.random() * 1.75;
      const violet = Math.random() < VIOLET_CHANCE;
      const bandPos = 22 + Math.random() * 50;
      const minOp = 0.32 + Math.random() * 0.16;
      const maxOp = 0.78 + Math.random() * 0.22;
      const dur = 4.5 + Math.random() * 6.5;
      const delay = -Math.random() * dur; // negative delay -> random start phase, not synchronized

      bar.style.setProperty('--bar-grow', grow.toFixed(2));
      bar.style.setProperty('--bar-accent', violet ? '#A85CF0' : '#4CE0E8');
      bar.style.setProperty('--bar-band', `${bandPos.toFixed(0)}%`);
      bar.style.setProperty('--bar-min', minOp.toFixed(2));
      bar.style.setProperty('--bar-max', maxOp.toFixed(2));
      if (!prefersReduced) {
        bar.style.setProperty('--bar-dur', `${dur.toFixed(2)}s`);
        bar.style.setProperty('--bar-delay', `${delay.toFixed(2)}s`);
      } else {
        // static, mid-brightness — no animation at all for reduced motion
        bar.style.opacity = ((minOp + maxOp) / 2).toFixed(2);
      }
      frag.appendChild(bar);
    }
    container!.replaceChildren(frag);
  }

  buildBars();

  let resizeTimer: number | undefined;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(buildBars, 200);
  });
}
