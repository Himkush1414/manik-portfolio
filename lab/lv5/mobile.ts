// /lab/lv5 — the About section, MOBILE layout only (#mobile-about).
//
// A fully separate experience from the desktop horizontal scroll-jack
// (main.ts): this is normal, native vertical scrolling — nothing here ever
// calls preventDefault on a scroll/touch event. Content reveals as it
// scrolls into view (IntersectionObserver, below), and "THE WORK" reuses a
// standard sticky-pin technique (a tall wrapper + a `position: sticky`
// inner panel) to get a pinned-while-scrolling feel without jacking scroll
// at all — the pin comes from CSS position:sticky, not JS.
//
// Everything in this file is gated behind IS_MOBILE so it's a genuine
// no-op on desktop rather than just invisible/unused.
//
// `export {}` makes this an ES module instead of a global script —
// otherwise its top-level `const`/`function` names collide (at the
// type-checker level only) with main.ts, the other vanilla-script
// (no-import) file in this route.
export {};

const IS_MOBILE = window.matchMedia('(max-width: 720px)').matches;

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}
function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ---------------------------------------------------------------
// Scroll-triggered reveals — every .m-reveal element starts hidden (see
// lv5.css) and fades/slides into place once it's scrolled into view.
// .m-reveal--wipe elements (the portrait, preview cards) use a clip-path
// wipe instead of the plain fade, driven by the same .is-visible class.
// One-shot: once revealed, an element stays revealed on scroll back up.
// ---------------------------------------------------------------
function initReveals() {
  const els = document.querySelectorAll<HTMLElement>('.mobile-about .m-reveal');
  if (!els.length) return;
  if (!('IntersectionObserver' in window)) {
    els.forEach(el => el.classList.add('is-visible'));
    return;
  }
  const io = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      });
    },
    { threshold: 0.18, rootMargin: '0px 0px -10% 0px' }
  );
  els.forEach(el => io.observe(el));
}

// ---------------------------------------------------------------
// "THE WORK" — vertical split/grow, pinned via CSS position:sticky (see
// .m-pin-wrap / .m-panel--work in lv5.css) rather than scroll-jacking.
// progress 0..1 is derived directly from how far the page has scrolled
// through the tall wrapper while the inner panel is stuck in place —
// mirrors the desktop version's workT/box-growth/word-separation math,
// just with the words separating vertically (translateY) instead of
// horizontally, since "THE"/"WORK" stack instead of sitting side by side.
// ---------------------------------------------------------------
function initMobileWork() {
  const wrap = document.getElementById('m-work-wrap');
  const wordThe = document.getElementById('m-word-the');
  const wordWork = document.getElementById('m-word-work');
  const box = document.getElementById('m-work-box');
  if (!wrap || !wordThe || !wordWork || !box) return;

  function update() {
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const rect = wrap!.getBoundingClientRect();
    const scrollable = wrap!.offsetHeight - vh;
    const progress = scrollable > 0 ? clamp01(-rect.top / scrollable) : 0;
    const e = easeInOutCubic(progress);

    const boxOpacity = Math.min(progress / 0.1, 1);
    const minBox = 16;
    const boxW = minBox + (vw - minBox) * e;
    const boxH = minBox + (vh - minBox) * e;
    const radius = 14 * (1 - e);

    // same "stay mathematically clear of the box's own edge" approach as
    // desktop, just along the vertical axis the box is growing into here
    const WORD_CLEARANCE = 22;
    const staticGapPx = Math.min(Math.max(20, vh * 0.03), 48);
    const sep = Math.max(0, boxH / 2 + WORD_CLEARANCE - staticGapPx / 2);
    wordThe!.style.transform = `translate3d(0,${-sep}px,0)`;
    wordWork!.style.transform = `translate3d(0,${sep}px,0)`;
    box!.style.opacity = String(boxOpacity);
    box!.style.width = `${boxW}px`;
    box!.style.height = `${boxH}px`;
    box!.style.borderRadius = `${radius}px`;
  }

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
}

// ---------------------------------------------------------------
// Live local-time readout, mobile hero — a separate element/id from the
// desktop version (main.ts owns that one) so the two layouts stay fully
// independent, per their own small live clock each.
// ---------------------------------------------------------------
function initMobileClock() {
  const el = document.getElementById('mobile-clock-time');
  if (!el) return;
  function update() {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
    });
    el!.textContent = `${fmt.format(new Date())} IST`;
  }
  update();
  window.setInterval(update, 30_000);
}

if (IS_MOBILE) {
  initReveals();
  initMobileWork();
  initMobileClock();
}
