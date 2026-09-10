// /about — the About section (deployed copy of /lab/lv5/'s build, linked
// from the main site's nav and footer).
//
// Ordinary scroll input (wheel / trackpad / touch drag) never scrolls the
// page vertically — it accumulates 1:1 into a single virtual position that
// is only eased for fluidity (a per-frame lerp toward that position, no
// snapping to panel boundaries), then mapped to horizontal panel motion.
// The "THE WORK" panel reserves a slice of that virtual range where the
// mapping pins the track and drives a local split/grow animation instead of
// advancing to the next panel.
//
// `export {}` below makes this file an ES module instead of a global
// script — otherwise its top-level `const`/`function` names collide (at the
// type-checker level only; the actual bundles are already independent) with
// /lab/lv5/main.ts, the only other vanilla-script (no-import) file in the
// project.
export {};

const about = document.getElementById('about') as HTMLElement;
const track = document.getElementById('track') as HTMLElement;
const sidebar = document.querySelector('.about__sidebar') as HTMLElement;
const workBox = document.getElementById('work-box') as HTMLElement;
const wordThe = document.getElementById('word-the') as HTMLElement;
const wordWork = document.getElementById('word-work') as HTMLElement;

// The box must grow from the exact midpoint of the gap BETWEEN "THE" and
// "WORK" — not the midpoint of the whole flex block (those two are only the
// same point if both words render the same width, which they don't: "WORK"
// is wider than "THE", so a block-centred box actually starts off sitting
// under part of "WORK" instead of in the empty gap). offsetLeft/offsetWidth
// are unaffected by the transforms the animation applies, so they can be
// read at any time — no need to measure only at rest.
function updateWorkBoxCenter() {
  const gapCenter = (wordThe.offsetLeft + wordThe.offsetWidth + wordWork.offsetLeft) / 2;
  workBox.style.left = `${gapCenter}px`;
}
updateWorkBoxCenter();
window.addEventListener('resize', updateWorkBoxCenter);

// ---------------------------------------------------------------
// Horizontal scroll-jacking
// ---------------------------------------------------------------
// Virtual scroll units: 2 full-viewport slides (intro->about,
// about->work) + a reserved SPECIAL_RANGE where the track stays put
// while the work panel's own split/grow animation plays + 1 more
// full-viewport slide (work->next).
const SPECIAL_RANGE = 2600;
const EASE = 0.16;
const SETTLE_EPSILON = 0.04;

let target = 0;
let current = 0;
let rafId: number | null = null;
// track's true on-screen x offset as of the last applied frame (-trackX) —
// kept around so the nav overlay can read "which panel is in view" without
// re-deriving it from the live transform string.
let lastX = 0;

// document.documentElement.clientWidth/Height (not window.innerWidth/Height)
// on purpose: they match the width actually used for layout/vw units. Some
// mobile-emulated environments report a window.innerWidth that doesn't
// agree with the real rendered viewport, which would desync the panel-width
// math here from where the panels actually sit on screen.
function viewportWidth() {
  return document.documentElement.clientWidth;
}
function viewportHeight() {
  return document.documentElement.clientHeight;
}

function maxScroll() {
  return viewportWidth() * 3 + SPECIAL_RANGE;
}

function clampTarget() {
  target = Math.min(Math.max(target, 0), maxScroll());
}

// Cubic ease for the local work-panel progress, so the split/grow reads as
// an eased motion rather than linear 1:1 with the wheel.
function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ---------------------------------------------------------------
// Sidebar colour — tracks the background of whichever panel is
// currently scrolled under it, blended smoothly (not switched) as
// each panel boundary passes.
// ---------------------------------------------------------------
// Panel backgrounds in track order: 1 dark, 2 light, 3 light, 4 dark — so
// only two boundaries ever actually change the colour (panel 1->2 and
// panel 3->4); the 2->3 boundary is light->light and produces no visible
// shift, which the a-minus-b blend below falls out of naturally.
const SIDEBAR_DARK_BG = [0x21, 0x1e, 0x1b]; // #211E1B, the strip's existing dark tone, over dark panels
const SIDEBAR_LIGHT_BG = [0xfa, 0xf9, 0xf6]; // --work-bg, over light panels
const SIDEBAR_DARK_FG = [243, 238, 232]; // --text-warm, used over dark panels
const SIDEBAR_LIGHT_FG = [46, 43, 42]; // --work-text, used over light panels

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}

function mixRgb(from: number[], to: number[], mix: number) {
  const rgb = from.map((v, i) => Math.round(v + (to[i] - v) * mix));
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

function updateSidebarColor(x: number, vw: number) {
  // Each panel boundary sits at a multiple of vw, and that's also exactly
  // where the incoming panel finishes settling to fill the whole screen —
  // so the blend ramps UP TO the boundary and is fully switched by the time
  // it's reached (not still blending past it), matching what's actually
  // sliding into view under the sidebar as the scroll approaches that point.
  const width = vw * 0.22;
  const a = clamp01((x - (vw - width)) / width); // ramps 0->1 approaching x=vw (panel1->2)
  const b = clamp01((x - (3 * vw - width)) / width); // ramps 0->1 approaching x=3vw (panel3->4)
  const mix = a - b; // 0 = dark panel behind sidebar, 1 = light panel behind sidebar
  sidebar.style.setProperty('--sidebar-bg', mixRgb(SIDEBAR_DARK_BG, SIDEBAR_LIGHT_BG, mix));
  sidebar.style.setProperty('--sidebar-fg', mixRgb(SIDEBAR_DARK_FG, SIDEBAR_LIGHT_FG, mix));
}

function applyState(p: number) {
  const vw = viewportWidth();
  const vh = viewportHeight();
  const B2 = vw * 2;
  const B3 = B2 + SPECIAL_RANGE;

  let trackX: number;
  let workT: number;

  if (p <= B2) {
    trackX = -p;
    workT = 0;
  } else if (p <= B3) {
    trackX = -B2;
    workT = (p - B2) / SPECIAL_RANGE;
  } else {
    trackX = -(B2 + (p - B3));
    workT = 1;
  }

  track.style.transform = `translate3d(${trackX}px,0,0)`;
  lastX = -trackX;
  updateSidebarColor(lastX, vw);

  const e = easeInOutCubic(workT);

  // box: fades in over the first slice, then grows to fill the screen.
  // Starts small (not the old 120px) so it's still essentially a point at
  // e=0 — that's what lets the words sit at their close, untranslated rest
  // gap with nothing to clear yet.
  const boxOpacity = Math.min(workT / 0.12, 1);
  const minBox = 16;
  const boxW = minBox + (vw - minBox) * e;
  const boxH = minBox + (vh - minBox) * e;
  const radius = 14 * (1 - e);

  // words separate outward, driven directly by the box's own half-width so
  // they are mathematically guaranteed to stay clear of its edges as it
  // grows (not an independent formula that happens to hope it keeps up) —
  // each word's near edge is kept exactly WORD_CLEARANCE past the box's
  // edge at every frame, until the box fills the screen and they're pushed
  // past the viewport edge together with it.
  const WORD_CLEARANCE = 22;
  const staticGapPx = Math.min(Math.max(20, vw * 0.04), 56);
  const sep = Math.max(0, boxW / 2 + WORD_CLEARANCE - staticGapPx / 2);
  wordThe.style.transform = `translate3d(${-sep}px,0,0)`;
  wordWork.style.transform = `translate3d(${sep}px,0,0)`;
  workBox.style.opacity = String(boxOpacity);
  workBox.style.width = `${boxW}px`;
  workBox.style.height = `${boxH}px`;
  workBox.style.borderRadius = `${radius}px`;
}

function loop() {
  current += (target - current) * EASE;
  if (Math.abs(target - current) < SETTLE_EPSILON) current = target;
  applyState(current);
  rafId = requestAnimationFrame(loop);
}
rafId = requestAnimationFrame(loop);

about.addEventListener(
  'wheel',
  e => {
    e.preventDefault();
    const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
    target += dx * scale;
    clampTarget();
  },
  { passive: false }
);

let touchStartX = 0;
let touchStartTarget = 0;
let touching = false;
about.addEventListener(
  'touchstart',
  e => {
    if (e.touches.length !== 1) return;
    touching = true;
    touchStartX = e.touches[0].clientX;
    touchStartTarget = target;
  },
  { passive: true }
);
about.addEventListener(
  'touchmove',
  e => {
    if (!touching || e.touches.length !== 1) return;
    e.preventDefault();
    const dx = touchStartX - e.touches[0].clientX;
    target = touchStartTarget + dx * 1.6;
    clampTarget();
  },
  { passive: false }
);
about.addEventListener('touchend', () => {
  touching = false;
});

window.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight' || e.key === 'PageDown') {
    target += viewportWidth() * 0.6;
    clampTarget();
  } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
    target -= viewportWidth() * 0.6;
    clampTarget();
  }
});

window.addEventListener('resize', clampTarget);

// ---------------------------------------------------------------
// Live local-time readout (bottom-left of panel 1)
// ---------------------------------------------------------------
const clockTime = document.getElementById('clock-time');
function updateClock() {
  if (!clockTime) return;
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
  });
  clockTime.textContent = `${fmt.format(new Date())} IST`;
}
updateClock();
window.setInterval(updateClock, 30_000);
