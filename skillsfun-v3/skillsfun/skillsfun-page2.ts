// / (the main site) — the "Skill & Fun" section's figure view, revealed
// by the hero's strip-flip (see skillsfun.ts's Move Next handler +
// skillsfun-strip-field.ts's triggerFlipReveal + its own white-blur
// entrance, wired in index.html/skillsfun.css). Ported from
// /lab/lv9/page2.ts (itself a copy of lv8's), unchanged apart from the
// file renames — the portrait images and their real, pixel-derived
// ambient gradients below are a property of those specific photos, not
// this section's own cool-teal chrome colour, so they're carried over
// as-is rather than recoloured to match. Two pieces live here:
//
//  1. a continuously-drifting ambient gradient behind everything — a
//     strict 6-band vertical light-to-dark structure (see BLUE_GRADIENT
//     below), never cursor-reactive, always live.
//  2. the portrait itself, drawn on a <canvas> (see startPortraitCycle).
//     lab v3: one portrait only (portrait-1, the blue one); the main
//     site's rotation through three portraits is not used here.
//
// Plus the inert menu dropdown + Contact button (no navigation — same as
// lv9/lv8, and same as every other view on this site's own floating nav
// elements).
//
// Only imported (dynamically, from skillsfun.ts) once the flip-reveal
// starts — no reason to pay for portrait PNGs on a visit that never
// reaches "Move Next".

// lab v3: the figure section shows ONE portrait, the blue one, on its blue
// gradient. The main site swaps three portraits (blue/red/orange) every 7-10s
// and the background colour follows; here the other two pictures and the swap
// timer are gone, so nothing swaps and the colour never changes.
const PORTRAIT_URL = new URL('./skillsfun-portraits/portrait-1.png', import.meta.url).href;

// 7-stop vertical gradient (0/15/30/50/70/90/100%) read from portrait-1's own pixels
const GRADIENT_STOP_KEYS = ['g0', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6'] as const;
const BLUE_GRADIENT = ['#e8eaed', '#bcc6dc', '#7495dc', '#1552d5', '#1b3774', '#111622', '#060709'];

let started = false;

export function startPage2() {
  if (started) return;
  started = true;
  startAmbient();
  void startPortraitCycle();
  wireMenu();
  wireBigtextParallax();
}

export function stopPage2() {
  started = false;
}

// ---------------------------------------------------------------
// Ambient gradient — two stacked layers (see skillsfun.css's
// .skillsfun-page2__ambient-layer), each running its own continuous "breathe"
// animation forever. lab v3: both always carry the one blue gradient, so the
// motion continues but the colour never changes.
// ---------------------------------------------------------------
const ambientA = document.getElementById('skillsfun-ambient-a');
const ambientB = document.getElementById('skillsfun-ambient-b');

function applyGradient(el: HTMLElement, stops: string[]) {
  GRADIENT_STOP_KEYS.forEach((key, i) => el.style.setProperty(`--${key}`, stops[i]));
}

// both layers carry the same blue gradient (their breathing animation keeps running)
function startAmbient() {
  if (!ambientA || !ambientB) return;
  applyGradient(ambientA, BLUE_GRADIENT);
  applyGradient(ambientB, BLUE_GRADIENT);
}

// ---------------------------------------------------------------
// Portrait — one static image on the canvas (lab v3: no rotation).
// ---------------------------------------------------------------
async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function fitCover(imgW: number, imgH: number, boxW: number, boxH: number) {
  const scale = Math.max(boxW / imgW, boxH / imgH);
  const w = imgW * scale;
  const h = imgH * scale;
  return { x: (boxW - w) / 2, y: (boxH - h) / 2, w, h };
}

async function startPortraitCycle() {
  const canvas = document.getElementById('skillsfun-portrait-canvas') as HTMLCanvasElement | null;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const image = await loadImage(PORTRAIT_URL);
  if (!started) return; // page 2 was torn down while the image was loading

  // assigning canvas.width/height always clears the bitmap (mobile address-bar
  // resizes included), so every resize repaints the portrait; rAF-batched
  let resizeTicking = false;
  function resizeCanvas() {
    const rect = canvas!.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas!.width = Math.max(1, Math.round(rect.width * dpr));
    canvas!.height = Math.max(1, Math.round(rect.height * dpr));
    render();
  }
  function render() {
    const { width: w, height: h } = canvas!;
    const r = fitCover(image.naturalWidth, image.naturalHeight, w, h);
    ctx!.clearRect(0, 0, w, h);
    ctx!.drawImage(image, r.x, r.y, r.w, r.h);
  }
  resizeCanvas();
  window.addEventListener(
    'resize',
    () => {
      if (resizeTicking) return;
      resizeTicking = true;
      requestAnimationFrame(() => {
        resizeTicking = false;
        resizeCanvas();
      });
    },
    { passive: true }
  );
}

// ---------------------------------------------------------------
// Top-bar menu — open/close toggle only. Home/About/Projects/Skills
// inside the panel are real <a> links now (see chat reply — was inert,
// same as lv9's own copy), intercepted the same way as every other real
// nav link on the site by lv6-transition.ts's document-level click
// delegation, so no navigation wiring belongs here. This function only
// owns opening/closing the panel itself, including closing it the
// instant an item is clicked — otherwise a same-page destination (e.g.
// "Skills", clicked while already on this section) leaves the panel
// sitting open on screen after its own click completes.
// ---------------------------------------------------------------
function wireMenu() {
  const btn = document.getElementById('skillsfun-page2-menu-btn');
  const panel = document.getElementById('skillsfun-page2-menu-panel');
  if (!btn || !panel) return;

  function close() {
    panel!.hidden = true;
    btn!.setAttribute('aria-expanded', 'false');
  }
  function toggle() {
    const willOpen = panel!.hidden;
    panel!.hidden = !willOpen;
    btn!.setAttribute('aria-expanded', String(willOpen));
  }

  btn.addEventListener('click', e => {
    e.stopPropagation();
    toggle();
  });
  panel.addEventListener('click', e => {
    if ((e.target as HTMLElement).closest('.skillsfun-page2__menu-item')) close();
  });
  document.addEventListener('click', e => {
    if (!panel!.hidden && !panel!.contains(e.target as Node) && e.target !== btn) close();
  });
}

// ---------------------------------------------------------------
// "CREATIVE DESIGN" background text — basic scroll-linked parallax (see
// chat reply): translates downward as the page scrolls down, at a
// fraction of the page's own scroll speed, so it reads as sitting
// further back than the figure in front of it rather than moving in
// lockstep with everything else. Same ticking-flag + rAF batching
// pattern main.tsx already uses for its own scroll-driven effects.
//
// Guarded against #skillsfun-page2.is-entering: that class drives this
// same element's one-time CSS entrance transform (.entry-rise, see
// skillsfun.css) via `transform: translateY(9%)`, and an inline style
// set from JS always wins over a stylesheet rule regardless of
// specificity — touching bigtext.style.transform while still entering
// would silently cancel that entrance animation outright.
//
// .entry-rise also carries a 1.6s `transition: transform ...` that isn't
// scoped to .is-entering — it stays on the element permanently, since
// it's what makes transform smoothly settle back to normal the instant
// .is-entering is removed. Left in place, every later scroll-driven
// update below would ALSO ease over 1.6s instead of tracking the scroll
// position live, reading as laggy rather than a real parallax. The first
// 'transitionend' for "transform" is that one-time entrance settling —
// switch the transition off right after it, once, so every update from
// here on applies instantly.
// ---------------------------------------------------------------
// Kept modest on purpose: .skillsfun-page2__bigtext sits at `bottom: 4%`
// inside .skillsfun-page2's own `overflow: hidden` 100vh box (skillsfun.css)
// — only 4% of viewport height of clearance exists below the text before
// a downward translate starts clipping it against that box's own bottom
// edge. A higher rate hits that clip within the first ~100px of scroll,
// which reads as the text vanishing abruptly rather than parallaxing.
const BIGTEXT_PARALLAX_RATE = 0.15;
function wireBigtextParallax() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const section = document.getElementById('skillsfun-page2');
  const bigtext = document.querySelector<HTMLElement>('.skillsfun-page2__bigtext');
  if (!section || !bigtext) return;

  if (section.classList.contains('is-entering')) {
    // NOT { once: true } — .entry-rise's transition covers three
    // properties (transform/filter/opacity) that finish at three
    // different times (1.6s/1.4s/1.2s respectively), each firing its own
    // 'transitionend'; opacity's fires soonest, so `once` would remove
    // this listener on THAT event and miss transform's entirely. Remove
    // it manually, only once the property we actually care about fires.
    const onEntranceTransitionEnd = (e: TransitionEvent) => {
      if (e.propertyName !== 'transform') return;
      bigtext!.style.transitionProperty = 'none';
      bigtext!.removeEventListener('transitionend', onEntranceTransitionEnd);
    };
    bigtext.addEventListener('transitionend', onEntranceTransitionEnd);
  } else {
    // startPage2() runs after an async dynamic import (see skillsfun.ts),
    // so it's possible for this to run AFTER the flip — and therefore
    // the entrance transition — has already finished, in which case its
    // 'transitionend' already fired and this function would never see
    // it. Nothing left to preserve at that point, so disable it now
    // rather than risk every future scroll update staying stuck easing
    // over 1.6s forever.
    bigtext.style.transitionProperty = 'none';
  }

  let ticking = false;
  function update() {
    ticking = false;
    if (section!.classList.contains('is-entering')) return;
    const rect = section!.getBoundingClientRect();
    // skip while off-screen in either direction (including the
    // #skillsfun-root-hidden case, where a display:none ancestor makes
    // every rect value 0) — nothing to keep recomputing
    if (rect.bottom <= 0 || rect.top >= window.innerHeight) return;
    const offset = Math.max(0, -rect.top) * BIGTEXT_PARALLAX_RATE;
    bigtext!.style.transform = `translateX(-50%) translateY(${offset}px)`;
  }
  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();
}
