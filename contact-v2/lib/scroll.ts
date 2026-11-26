// One passive scroll/resize listener for the whole view, throttled to one
// callback pass per animation frame. Subscribers write styles directly
// (transform/opacity only); nothing here triggers a React render.
type ScrollCb = (scrollY: number) => void;

const subs = new Set<ScrollCb>();
let ticking = false;

function run() {
  ticking = false;
  const y = window.scrollY || document.documentElement.scrollTop;
  subs.forEach(cb => cb(y));
}

function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(run);
}

export function subscribeScroll(cb: ScrollCb) {
  if (subs.size === 0) {
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
  }
  subs.add(cb);
  cb(window.scrollY || document.documentElement.scrollTop);
  return () => {
    subs.delete(cb);
    if (subs.size === 0) {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    }
  };
}

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
