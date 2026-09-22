// Real, JS-driven smooth scroll — NOT a native-scroll tweak. An earlier
// version of this file intercepted 'wheel' and re-applied a scaled delta
// via a single `window.scrollBy(..., { behavior: 'auto' })` per event.
// That barely reduced *perceived* speed (native wheel/trackpad deltas are
// small and frequent to begin with, so shaving a fraction off each one
// reads as noise) and did nothing for smoothness — each call was still
// an instant, un-eased jump. Verified by reasoning through this
// codebase's own two scroll mechanisms (the homepage's/About's mobile
// layout's plain native `window.scrollY`, vs. About's desktop layout,
// which already hand-rolls a virtual-position + rAF-eased approach in
// about/main.ts — the exact technique this file now uses too, since
// that's the one actually capable of a real, perceptible, smooth result
// on top of native scroll).
//
// Mechanism: wheel input accumulates into a virtual `target` (clamped to
// the real scrollable range) at `speed` of its native size; every frame,
// the real scroll position eases toward that target by `ease` — the same
// `current += (target - current) * ease` lerp About's own track already
// uses. That's what makes it glide instead of jump, with no added lag
// (a single scrollTo per rAF tick, same cost class as native scrolling).
//
// A `scroll` listener resyncs `target`/`current` from the real scrollY
// whenever this engine ISN'T the one driving it (keyboard, scrollbar
// drag, touch drag, or another feature's own `scrollTo`/`scrollIntoView`
// call, e.g. the homepage's "back to top" button or anchor links) — so
// none of those keep working exactly as before.
// Elements with their own genuinely-scrollable overflow (e.g. the mobile
// hamburger menu's item list, StaggeredMenu.tsx's `.staggered-menu-panel`)
// must keep their native wheel-scroll untouched — hijacking every wheel
// event for the page would otherwise also break scrolling *inside* them.
function hasScrollableAncestor(target: EventTarget | null): boolean {
  let node = target instanceof Element ? target : null;
  while (node && node !== document.body && node !== document.documentElement) {
    const style = getComputedStyle(node);
    if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) return true;
    node = node.parentElement;
  }
  return false;
}

export function slowScroll(speed: number, ease: number) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let target = window.scrollY;
  let current = target;
  let rafId: number | null = null;
  let animating = false;

  function maxScroll() {
    return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  }
  function clamp(v: number) {
    return Math.min(Math.max(v, 0), maxScroll());
  }

  function loop() {
    current += (target - current) * ease;
    if (Math.abs(target - current) < 0.5) {
      current = target;
      window.scrollTo(0, current);
      rafId = null;
      animating = false;
      return;
    }
    window.scrollTo(0, current);
    rafId = requestAnimationFrame(loop);
  }

  function ensureLoop() {
    animating = true;
    if (rafId === null) rafId = requestAnimationFrame(loop);
  }

  window.addEventListener(
    'wheel',
    e => {
      if (e.ctrlKey) return; // pinch-zoom — leave it alone
      if (hasScrollableAncestor(e.target)) return; // let e.g. an open menu's own list scroll natively
      e.preventDefault();
      const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
      target = clamp(target + e.deltaY * scale * speed);
      ensureLoop();
    },
    { passive: false },
  );

  window.addEventListener(
    'scroll',
    () => {
      if (animating) return; // our own scrollTo — not an external move
      target = current = window.scrollY;
    },
    { passive: true },
  );

  window.addEventListener('resize', () => {
    target = clamp(target);
    current = clamp(current);
  });
}
