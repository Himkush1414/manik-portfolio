// /lab/lv8 — "page 2", revealed by the hero's strip-flip (see main.ts's
// Move Next handler + lv8-strip-field.ts's triggerFlipReveal). Three
// independent pieces live here, all driven off the same six portrait
// images:
//
//  1. a continuously-drifting ambient gradient behind everything, whose
//     colour scheme is tied to whichever portrait is currently showing —
//     never cursor-reactive, always live (see startAmbient/setAmbient).
//  2. the portraits themselves, rotating every ~7-10s via a pixelated
//     right-to-left wipe rendered on a <canvas> (see startPortraitCycle).
//  3. the inert menu dropdown + Contact button (no navigation — lv8 is a
//     standalone route, see the chat reply and index.html's comment).
//
// Only imported (dynamically, from main.ts) once the flip-reveal starts,
// same spirit as game.ts's own dynamic import — no reason to pay for six
// portrait PNGs (~5MB) on a visit that never reaches "Move Next".

const PORTRAIT_COUNT = 6;
const PORTRAIT_URLS = Array.from(
  { length: PORTRAIT_COUNT },
  (_, i) => new URL(`./portraits/portrait-${i + 1}.png`, import.meta.url).href
);

// Colours below were read directly from each PNG's own pixels (not
// guessed): a small Node script decoded every file, ignored the mostly-
// transparent/near-black fill and the near-white highlight core (both
// low-saturation, so they'd otherwise wash any average toward grey), and
// took a saturation-weighted average of the remaining "coloured glow"
// pixels — that's c1. c2/c3 are darker tones at the same hue, generated
// for the ambient background so it stays dark-dominant rather than
// pastel. Order matches portrait-1..6.png (the filename numbering).
const PORTRAIT_PALETTE: { c1: string; c2: string; c3: string }[] = [
  { c1: '#27478c', c2: '#101c38', c3: '#091020' }, // 1 — blue
  { c1: '#b12a3c', c2: '#3a0e13', c3: '#21080b' }, // 2 — red
  { c1: '#7538b1', c2: '#241136', c3: '#150a1f' }, // 3 — violet
  { c1: '#98400c', c2: '#3d1d0b', c3: '#211108' }, // 4 — orange
  { c1: '#0e5f4e', c2: '#0b3d32', c3: '#08211c' }, // 5 — green
  { c1: '#3c549a', c2: '#141c33', c3: '#0b101d' }, // 6 — blue/violet
];

const ROTATE_MIN_MS = 7000;
const ROTATE_MAX_MS = 10000;
const WIPE_DURATION_MS = 850;
const WIPE_BAND_PX = 46; // width of the pixelated leading edge, in canvas px
const WIPE_BLOCK = 10; // pixelation block size within that band

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
// (page 2 has no way back yet, see chat reply's flagged item), but kept
// so wiring a reverse transition later doesn't also have to solve "how
// do I stop this."
export function stopPage2() {
  started = false;
  if (rafId !== null) cancelAnimationFrame(rafId);
  window.clearTimeout(rotateTimer);
}

// ---------------------------------------------------------------
// Ambient gradient — two stacked layers (see lv8.css's
// .lv8-page2__ambient-layer), each running its own continuous drift
// animation forever; only their CSS colour custom-properties and
// which one is .is-active ever change, so the drift motion itself never
// restarts or jumps when the palette swaps.
// ---------------------------------------------------------------
const ambientA = document.getElementById('lv8-ambient-a');
const ambientB = document.getElementById('lv8-ambient-b');
let ambientShowingA = true;

function applyPalette(el: HTMLElement, p: { c1: string; c2: string; c3: string }) {
  el.style.setProperty('--amb-c1', p.c1);
  el.style.setProperty('--amb-c2', p.c2);
  el.style.setProperty('--amb-c3', p.c3);
}

function startAmbient() {
  if (!ambientA || !ambientB) return;
  applyPalette(ambientA, PORTRAIT_PALETTE[0]);
  applyPalette(ambientB, PORTRAIT_PALETTE[0]);
}

function setAmbientForIndex(index: number) {
  if (!ambientA || !ambientB) return;
  const palette = PORTRAIT_PALETTE[index] ?? PORTRAIT_PALETTE[0];
  const incoming = ambientShowingA ? ambientB : ambientA;
  const outgoing = ambientShowingA ? ambientA : ambientB;
  applyPalette(incoming, palette);
  incoming.classList.add('is-active');
  outgoing.classList.remove('is-active');
  ambientShowingA = !ambientShowingA;
}

// ---------------------------------------------------------------
// Portrait cycle — pixelated right-to-left wipe between images, looping
// 1 -> 2 -> ... -> 6 -> 1, roughly every 7-10s while idle.
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
  const canvas = document.getElementById('lv8-portrait-canvas') as HTMLCanvasElement | null;
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

  function drawImageCover(image: HTMLImageElement, clipX?: number, clipWidth?: number) {
    const { width: w, height: h } = canvas!;
    const rect = fitCover(image.naturalWidth, image.naturalHeight, w, h);
    if (clipX === undefined) {
      ctx!.drawImage(image, rect.x, rect.y, rect.w, rect.h);
      return;
    }
    ctx!.save();
    ctx!.beginPath();
    ctx!.rect(clipX, 0, clipWidth ?? w - clipX, h);
    ctx!.clip();
    ctx!.drawImage(image, rect.x, rect.y, rect.w, rect.h);
    ctx!.restore();
  }

  // the blocky leading edge: downsample a narrow vertical band of the
  // incoming image to big chunky pixels, then draw it back up scaled
  // with smoothing off — genuinely pixelated, not a blur standing in.
  function drawPixelatedBand(image: HTMLImageElement, bandX: number, bandW: number) {
    const { width: w, height: h } = canvas!;
    if (bandW <= 0 || bandX + bandW < 0 || bandX > w) return;
    const x0 = Math.max(0, bandX);
    const x1 = Math.min(w, bandX + bandW);
    const clippedW = x1 - x0;
    if (clippedW <= 0) return;

    const blockCols = Math.max(1, Math.round(clippedW / WIPE_BLOCK));
    const blockRows = Math.max(1, Math.round(h / WIPE_BLOCK));

    const off = document.createElement('canvas');
    off.width = blockCols;
    off.height = blockRows;
    const offCtx = off.getContext('2d');
    if (!offCtx) return;
    const rect = fitCover(image.naturalWidth, image.naturalHeight, w, h);
    // shift the source draw so the offscreen canvas (which only covers
    // [x0, x1)) still samples the correct slice of the full-cover image
    offCtx.drawImage(image, rect.x - x0, rect.y, rect.w, rect.h);

    ctx!.save();
    ctx!.imageSmoothingEnabled = false;
    ctx!.beginPath();
    ctx!.rect(x0, 0, clippedW, h);
    ctx!.clip();
    ctx!.drawImage(off, x0, 0, clippedW, h);
    ctx!.restore();
  }

  function renderStatic() {
    const { width: w, height: h } = canvas!;
    ctx!.clearRect(0, 0, w, h);
    drawImageCover(images[activeIndex]);
  }
  renderStatic();

  function runWipe(fromIndex: number, toIndex: number): Promise<void> {
    return new Promise(resolve => {
      const start = performance.now();
      function step(time: number) {
        const t = Math.min((time - start) / WIPE_DURATION_MS, 1);
        const eased = t * t * (3 - 2 * t); // smoothstep
        const { width: w, height: h } = canvas!;
        const revealX = w * (1 - eased); // grows the revealed region from the right edge leftward

        ctx!.clearRect(0, 0, w, h);
        drawImageCover(images[fromIndex]); // untouched (not-yet-reached) portion stays crisp underneath
        drawImageCover(images[toIndex], revealX, w - revealX); // crisp, already-revealed portion
        drawPixelatedBand(images[toIndex], revealX - WIPE_BAND_PX / 2, WIPE_BAND_PX); // the sweeping blocky seam

        if (t < 1) {
          rafId = requestAnimationFrame(step);
        } else {
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
      await runWipe(activeIndex, nextIndex);
      activeIndex = nextIndex;
      setAmbientForIndex(activeIndex);
      if (started) scheduleNext();
    }, delay);
  }
  scheduleNext();
}

// ---------------------------------------------------------------
// Inert top-bar menu — purely visual toggle, no navigation (see the
// chat reply: lv8 is a standalone route, Home/About/Projects/Contact
// don't go anywhere from here).
// ---------------------------------------------------------------
function wireMenu() {
  const btn = document.getElementById('lv8-page2-menu-btn');
  const panel = document.getElementById('lv8-page2-menu-panel');
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
