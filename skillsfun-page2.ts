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
//     strict 6-band vertical light-to-dark structure (see
//     PORTRAIT_GRADIENTS below), never cursor-reactive, always live.
//  2. the portraits themselves, rotating every ~7-10s via a blur-swap (no
//     sliding/wiping motion — see runBlurTransition) rendered on a
//     <canvas> (see startPortraitCycle). Three active (matching lv9):
//     portrait-1, portrait-2, and portrait-4 ("the third figure") — 3
//     and 5 exist on lv8 but were never copied to lv9 or here.
//
// Plus the inert menu dropdown + Contact button (no navigation — same as
// lv9/lv8, and same as every other view on this site's own floating nav
// elements).
//
// Only imported (dynamically, from skillsfun.ts) once the flip-reveal
// starts — no reason to pay for portrait PNGs on a visit that never
// reaches "Move Next".

// File name (not a plain index+1) since the active set skips portrait-3
// (see chat reply — portrait-4 was added as the third figure, portrait-3
// wasn't).
const PORTRAIT_FILES = ['portrait-1.png', 'portrait-2.png', 'portrait-4.png'];
const PORTRAIT_COUNT = PORTRAIT_FILES.length;
const PORTRAIT_URLS = PORTRAIT_FILES.map(
  file => new URL(`./skillsfun-portraits/${file}`, import.meta.url).href
);

// 7-stop vertical gradient per portrait (0/15/30/50/70/90/100%), each
// stop's colour read directly from that PNG's own pixels on lv8 — not a
// fixed palette, and not re-derived here since these are the same image
// files, byte-for-byte (lv8's page2.ts keeps the full 1-5 set, including
// this exact portrait-4 entry, commented out rather than deleted — see
// its own comment). Order matches PORTRAIT_FILES above.
const GRADIENT_STOP_KEYS = ['g0', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6'] as const;
const PORTRAIT_GRADIENTS: string[][] = [
  ['#e8eaed', '#bcc6dc', '#7495dc', '#1552d5', '#1b3774', '#111622', '#060709'], // portrait-1 — blue
  ['#ede8e8', '#dcbcc0', '#dc7482', '#d5152e', '#741b27', '#221113', '#090607'], // portrait-2 — red
  ['#edeae8', '#dcc8bc', '#dc9b74', '#d55c15', '#743c1b', '#221711', '#090706'], // portrait-4 — orange
];

const ROTATE_MIN_MS = 7000;
const ROTATE_MAX_MS = 10000;
// Three phases: blur ramps up (outgoing only), THEN a genuine cross-fade
// window while blur STAYS at peak — outgoing alpha 1->0, incoming alpha
// 0->1, redrawn every frame, so there is no single frame where the
// change happens — then blur ramps back down (incoming only).
// NOTE: .skillsfun-page2__ambient-layer's opacity transition (skillsfun.css) is a
// separate CSS duration tuned to roughly match TRANSITION_TOTAL_MS so
// the background stays in sync with this — if this changes, that should
// move with it (same coupling as on lv8).
const TRANSITION_TOTAL_MS = 3400;
const BLUR_IN_FRAC = 0.3; // 0 -> here: blur ramps up, outgoing image only
const CROSSFADE_FRAC = 0.22; // here -> +this: blur held at peak, images cross-fade
// remaining fraction (1 - BLUR_IN_FRAC - CROSSFADE_FRAC): blur ramps back down, incoming only
const TRANSITION_BLUR_MAX_PX = 30;

let started = false;
let rafId: number | null = null;
let rotateTimer: number | undefined;

export function startPage2() {
  if (started) return;
  started = true;
  startAmbient();
  void startPortraitCycle();
  wireMenu();
}

// stops the portrait rAF loop + rotation timer — not currently called
// (page 2 has no way back yet, same as lv8), but kept so wiring a
// reverse transition later doesn't also have to solve "how do I stop
// this."
export function stopPage2() {
  started = false;
  if (rafId !== null) cancelAnimationFrame(rafId);
  window.clearTimeout(rotateTimer);
}

// ---------------------------------------------------------------
// Ambient gradient — two stacked layers (see skillsfun.css's
// .skillsfun-page2__ambient-layer), each running its own continuous "breathe"
// animation forever; only their CSS gradient-stop custom-properties and
// which one is .is-active ever change, so the motion itself never
// restarts or jumps when the palette swaps. setAmbientForIndex is called
// the INSTANT a portrait transition starts (see scheduleNext below), not
// after it finishes, so this crossfade runs concurrently with the
// portrait's own blur transition — reading as one continuous shift
// instead of the image changing and then the colour catching up.
// ---------------------------------------------------------------
const ambientA = document.getElementById('skillsfun-ambient-a');
const ambientB = document.getElementById('skillsfun-ambient-b');
let ambientShowingA = true;

function applyGradient(el: HTMLElement, stops: string[]) {
  GRADIENT_STOP_KEYS.forEach((key, i) => el.style.setProperty(`--${key}`, stops[i]));
}

function startAmbient() {
  if (!ambientA || !ambientB) return;
  applyGradient(ambientA, PORTRAIT_GRADIENTS[0]);
  applyGradient(ambientB, PORTRAIT_GRADIENTS[0]);
}

function setAmbientForIndex(index: number) {
  if (!ambientA || !ambientB) return;
  const stops = PORTRAIT_GRADIENTS[index] ?? PORTRAIT_GRADIENTS[0];
  const incoming = ambientShowingA ? ambientB : ambientA;
  const outgoing = ambientShowingA ? ambientA : ambientB;
  applyGradient(incoming, stops);
  incoming.classList.add('is-active');
  outgoing.classList.remove('is-active');
  ambientShowingA = !ambientShowingA;
}

// ---------------------------------------------------------------
// Portrait cycle — blur-swap between images (no sliding/wiping — see
// runBlurTransition), looping 1 -> 2 -> 1 -> ..., roughly every 7-10s
// while idle.
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

  const images = await Promise.all(PORTRAIT_URLS.map(loadImage));
  if (!started) return; // page 2 was torn down while images were loading

  let activeIndex = 0;
  setAmbientForIndex(activeIndex);

  function resizeCanvas() {
    const rect = canvas!.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas!.width = Math.max(1, Math.round(rect.width * dpr));
    canvas!.height = Math.max(1, Math.round(rect.height * dpr));
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  function drawImageCover(image: HTMLImageElement) {
    const { width: w, height: h } = canvas!;
    const rect = fitCover(image.naturalWidth, image.naturalHeight, w, h);
    ctx!.drawImage(image, rect.x, rect.y, rect.w, rect.h);
  }

  function renderStatic() {
    const { width: w, height: h } = canvas!;
    ctx!.clearRect(0, 0, w, h);
    drawImageCover(images[activeIndex]);
  }
  renderStatic();

  function smoothstep(t: number) {
    const c = Math.min(Math.max(t, 0), 1);
    return c * c * (3 - 2 * c);
  }

  // No sliding/wiping motion, and no instant swap either. Three phases:
  // the outgoing image blurs up; then, with blur HELD at its peak the
  // whole time, the two images genuinely cross-fade (outgoing alpha
  // 1->0, incoming alpha 0->1, redrawn every frame of this window —
  // never a single frame where the picture just changes); then blur
  // eases back down to crisp on the now-fully-incoming image. The blur
  // is a plain CSS filter on the canvas element; nothing ever moves
  // left or right.
  function runBlurTransition(fromIndex: number, toIndex: number): Promise<void> {
    return new Promise(resolve => {
      const start = performance.now();
      const crossfadeEnd = BLUR_IN_FRAC + CROSSFADE_FRAC;

      function drawCrossfade(mix: number) {
        // mix: 0 = fully outgoing, 1 = fully incoming
        const { width: w, height: h } = canvas!;
        ctx!.clearRect(0, 0, w, h);
        ctx!.globalAlpha = 1;
        drawImageCover(images[fromIndex]);
        ctx!.globalAlpha = mix;
        drawImageCover(images[toIndex]);
        ctx!.globalAlpha = 1;
      }

      function step(time: number) {
        const t = Math.min((time - start) / TRANSITION_TOTAL_MS, 1);

        let blurPx: number;
        if (t < BLUR_IN_FRAC) {
          blurPx = TRANSITION_BLUR_MAX_PX * smoothstep(t / BLUR_IN_FRAC);
          drawCrossfade(0);
        } else if (t < crossfadeEnd) {
          blurPx = TRANSITION_BLUR_MAX_PX; // held at peak for the whole cross-fade
          drawCrossfade(smoothstep((t - BLUR_IN_FRAC) / CROSSFADE_FRAC));
        } else {
          const tOut = (t - crossfadeEnd) / (1 - crossfadeEnd);
          blurPx = TRANSITION_BLUR_MAX_PX * (1 - smoothstep(tOut));
          drawCrossfade(1);
        }
        canvas!.style.filter = blurPx > 0.4 ? `blur(${blurPx.toFixed(1)}px)` : 'none';

        if (t < 1) {
          rafId = requestAnimationFrame(step);
        } else {
          canvas!.style.filter = 'none';
          renderStaticFor(toIndex);
          resolve();
        }
      }

      rafId = requestAnimationFrame(step);
    });
  }

  function renderStaticFor(index: number) {
    const { width: w, height: h } = canvas!;
    ctx!.clearRect(0, 0, w, h);
    drawImageCover(images[index]);
  }

  function scheduleNext() {
    const delay = ROTATE_MIN_MS + Math.random() * (ROTATE_MAX_MS - ROTATE_MIN_MS);
    rotateTimer = window.setTimeout(async () => {
      if (!started) return;
      const nextIndex = (activeIndex + 1) % PORTRAIT_COUNT;
      // fired now, concurrently with the blur transition below, not
      // after it resolves — see the ambient section's comment for why
      setAmbientForIndex(nextIndex);
      await runBlurTransition(activeIndex, nextIndex);
      activeIndex = nextIndex;
      if (started) scheduleNext();
    }, delay);
  }
  scheduleNext();
}

// ---------------------------------------------------------------
// Inert top-bar menu — purely visual toggle, no navigation. Home/About/
// Projects in here are decorative, not real links, same as lv9/lv8 — the
// real ones live in this section's own entry nav (see index.html), which
// lv6-transition.ts already intercepts.
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
  document.addEventListener('click', e => {
    if (!panel!.hidden && !panel!.contains(e.target as Node) && e.target !== btn) close();
  });
}
