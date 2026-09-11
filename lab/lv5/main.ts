// /lab/lv5 — the About section, DESKTOP layout only.
//
// Ordinary scroll input (wheel / trackpad / touch drag) never scrolls the
// page vertically — it accumulates 1:1 into a single virtual position that
// is only eased for fluidity (a per-frame lerp toward that position, no
// snapping to panel boundaries), then mapped to horizontal panel motion.
// One panel reserves a slice of that virtual range where the mapping pins
// the track and drives a local sub-animation instead of advancing to the
// next panel: "THE WORK" (split/grow). "CHAPTER III"'s column reveal is
// cursor-driven, not scroll-driven — see the curtain-reveal section below.
//
// Below the lv5.css breakpoint, none of this mechanic applies at all — the
// mobile layout is a fully separate, normal-vertical-scroll experience
// (mobile.ts, the #mobile-about markup), and .about/.about__track are
// display:none there. IS_MOBILE_LAYOUT below gates every piece of this
// file that would otherwise fight that (the scroll-jacking listeners, the
// rAF loop) so it stays completely inert rather than just invisible.
const IS_MOBILE_LAYOUT = window.matchMedia('(max-width: 720px)').matches;

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
// Track order: intro(0), about/"CHAPTER I"(1), "THE WORK"(2, pinned),
// "CHAPTER II"(3), "CHAPTER III"(4), "CHAPTER IV"(5), "NEXT CHAPTER"(6) —
// 7 panels, one of which ("THE WORK") reserves a slice of the virtual
// scroll range where the track pins in place and a local progress value
// drives its split/grow sub-animation instead of advancing.
const WORK_RANGE = 2600;
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

// Cumulative virtual-scroll thresholds. B2 is where "THE WORK" reaches rest
// (and its pin begins); B3 is where that pin ends. Beyond B3, the remaining
// four panels ("CHAPTER II/III/IV", "NEXT CHAPTER") slide by normally, one
// panel-width of scroll each, ending at maxScroll.
function thresholds() {
  const vw = viewportWidth();
  const B2 = vw * 2;
  const B3 = B2 + WORK_RANGE;
  const max = B3 + vw * 4;
  return { vw, B2, B3, max };
}

function maxScroll() {
  return thresholds().max;
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
// Panel backgrounds in track order: intro dark, about/work/ch2 light,
// ch3 dark, ch4 light, next dark. 0 = dark, 1 = light per panel index.
const PANEL_MIX = [0, 1, 1, 1, 0, 1, 0];
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
  // sliding into view under the sidebar as the scroll approaches that
  // point. Generalised over however many panels PANEL_MIX lists (adjacent
  // same-colour boundaries just produce a zero-length blend, same as
  // before) rather than hardcoding two specific boundaries.
  const lastIndex = PANEL_MIX.length - 1;
  const width = vw * 0.22;
  const xc = Math.max(0, Math.min(x, lastIndex * vw));
  const k = Math.min(lastIndex, Math.max(1, Math.ceil(xc / vw)));
  const from = PANEL_MIX[k - 1];
  const to = PANEL_MIX[k];
  const t = clamp01((xc - (k * vw - width)) / width);
  const mix = from + (to - from) * t; // 0 = dark panel behind sidebar, 1 = light panel behind sidebar
  sidebar.style.setProperty('--sidebar-bg', mixRgb(SIDEBAR_DARK_BG, SIDEBAR_LIGHT_BG, mix));
  sidebar.style.setProperty('--sidebar-fg', mixRgb(SIDEBAR_DARK_FG, SIDEBAR_LIGHT_FG, mix));
}

function applyState(p: number) {
  const { vw, B2, B3 } = thresholds();
  const vh = viewportHeight();

  let trackX: number;
  let workT: number;

  if (p <= B2) {
    // intro -> about -> work, sliding normally up to work's rest position
    trackX = -p;
    workT = 0;
  } else if (p <= B3) {
    // pinned on "THE WORK": track holds at work's rest position (x=2vw)
    trackX = -B2;
    workT = (p - B2) / WORK_RANGE;
  } else {
    // work -> ch2 -> ch3 -> ch4 -> next, sliding normally to the end
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

// Everything below drives the horizontal scroll-jack itself — none of it
// should run on the mobile layout, which uses the browser's own normal
// vertical scroll instead (mobile.ts). Starting the rAF loop is the main
// thing worth gating (a background per-frame loop with nothing to show
// for it); the listeners would also be harmless on their own since
// .about is display:none there and un-rendered elements never receive
// wheel/touch events, but gating them too keeps this file's behaviour
// honest about which layout it belongs to.
if (!IS_MOBILE_LAYOUT) {
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
}

// ---------------------------------------------------------------
// "Rising curtain" reveal — shared by "CHAPTER II"/"CHAPTER IV"'s hover
// preview and "CHAPTER III"'s per-column background. Triggering it (element
// starts hidden below, off) restarts the .is-rising CSS animation (see
// lv5.css: rises into view, holds, then continues rising off the TOP —
// it never reverses back down, even if the cursor leaves mid-animation,
// since nothing here ever removes the class on its own; only a fresh
// trigger restarts it, forcing the animation from its beginning again).
// ---------------------------------------------------------------
function triggerRise(el: HTMLElement) {
  el.classList.remove('is-rising');
  void el.offsetWidth; // force reflow so re-adding the class restarts the animation
  el.classList.add('is-rising');
}

// "CHAPTER II" / "CHAPTER IV": a list of items paired with a single preview
// box that shows whichever item's image the cursor is currently over,
// defaulting to the first item (already sitting at rest, unanimated) so the
// box is never empty. Switching hover targets rises the new image in while
// the old one keeps rising and exits — both play independently.
function wireHoverPreview(listSelector: string, stackSelector: string) {
  const list = document.querySelector(listSelector);
  const stack = document.querySelector(stackSelector);
  if (!list || !stack) return;
  let activeKey = stack.querySelector<HTMLElement>('[data-key].is-active')?.dataset.key ?? null;
  list.querySelectorAll<HTMLElement>('[data-key]').forEach(item => {
    item.addEventListener('mouseenter', () => {
      const key = item.dataset.key;
      if (!key || key === activeKey) return;
      const prev = activeKey ? stack.querySelector<HTMLElement>(`[data-key="${activeKey}"]`) : null;
      const next = stack.querySelector<HTMLElement>(`[data-key="${key}"]`);
      if (prev) {
        prev.classList.remove('is-active');
        triggerRise(prev);
      }
      if (next) {
        next.classList.add('is-active');
        triggerRise(next);
      }
      activeKey = key;
    });
  });
}
wireHoverPreview('.ch2__list', '.ch2__preview-stack');
wireHoverPreview('.ch4__list', '.ch4__preview-stack');

// "CHAPTER III": each column reveals its own background independently on
// hover — cursor-driven, not tied to scroll position at all. Leaving
// doesn't just let the reveal vanish/snap back down: it triggers a SECOND
// rise (.ch3__col-cover, a solid sheet matching the panel's own
// background) that climbs up from the bottom the same way the reveal
// did, covering/hiding it — so both the show and the hide read as the
// same bottom-to-top motion, never a reverse.
document.querySelectorAll<HTMLElement>('.ch3__col').forEach(col => {
  const bg = col.querySelector<HTMLElement>('.ch3__col-bg');
  const cover = col.querySelector<HTMLElement>('.ch3__col-cover');
  if (!bg) return;
  col.addEventListener('mouseenter', () => triggerRise(bg));
  if (cover) {
    col.addEventListener('mouseleave', () => triggerRise(cover));
  }
});

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
