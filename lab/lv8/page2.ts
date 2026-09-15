// /lab/lv8 — "page 2", revealed by the hero's strip-flip (see main.ts's
// Move Next handler + lv8-strip-field.ts's triggerFlipReveal). Three
// independent pieces live here, all driven off the same six portrait
// images:
//
//  1. a continuously-drifting ambient gradient behind everything — a
//     strict 6-band vertical light-to-dark structure (see
//     PORTRAIT_GRADIENTS below), never cursor-reactive, always live.
//  2. the portraits themselves, rotating every ~7-10s via a blur-then-
//     pixelated-wipe right-to-left, rendered on a <canvas> (see
//     startPortraitCycle).
//  3. the inert menu dropdown + Contact button (no navigation — lv8 is a
//     standalone route, see the chat reply and index.html's comment).
//
// Only imported (dynamically, from main.ts) once the flip-reveal starts,
// same spirit as game.ts's own dynamic import — no reason to pay for six
// portrait PNGs (~5MB) on a visit that never reaches "Move Next".
//
// portrait-5.png's SOURCE was swapped ("man image 5.png" -> "man image
// 7.png", per the chat reply) but it keeps the same project filename —
// simplest fix, no rename/re-plumbing needed elsewhere.

const PORTRAIT_COUNT = 6;
const PORTRAIT_URLS = Array.from(
  { length: PORTRAIT_COUNT },
  (_, i) => new URL(`./portraits/portrait-${i + 1}.png`, import.meta.url).href
);

// 7-stop vertical gradient per portrait (0/15/30/50/70/90/100%), each
// stop's colour read directly from that PNG's own pixels — not a fixed
// palette. Method: a small Node script decoded every file, took a
// saturation-weighted average of the "coloured glow" pixels (skipping
// the mostly-transparent fill and the near-white highlight core, both
// low-saturation and otherwise washing any average toward grey) to get
// that image's hue, then generated 7 HSL shades of that one hue at the
// lightness the brief's band table calls for (e.g. 0% stop ~92% light
// "extremely light", 100% stop ~3% light "near-black"), with saturation
// peaking at the 50% stop per "strongest colour in the middle band, not
// a flat fade". Order matches portrait-1..6.png.
const GRADIENT_STOP_KEYS = ['g0', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6'] as const;
const PORTRAIT_GRADIENTS: string[][] = [
  ['#e8eaed', '#bcc6dc', '#7495dc', '#1552d5', '#1b3774', '#111622', '#060709'], // 1 — blue
  ['#ede8e8', '#dcbcc0', '#dc7482', '#d5152e', '#741b27', '#221113', '#090607'], // 2 — red
  ['#ebe8ed', '#ccbcdc', '#a974dc', '#7615d5', '#481b74', '#1a1122', '#080609'], // 3 — violet
  ['#edeae8', '#dcc8bc', '#dc9b74', '#d55c15', '#743c1b', '#221711', '#090706'], // 4 — orange
  ['#e8edec', '#bcdcd2', '#74dcbc', '#15d599', '#1b7458', '#11221d', '#060908'], // 5 — green (man image 7.png)
  ['#e8e9ed', '#bcc4dc', '#748fdc', '#1546d5', '#1b3274', '#111522', '#060709'], // 6 — blue/violet
];

const ROTATE_MIN_MS = 7000;
const ROTATE_MAX_MS = 10000;
// Corrected transition (see chat reply): slower overall, and the reveal
// now happens WHILE the canvas is blurred rather than snapping instantly
// — three phases inside this one duration: blur in, wipe (under blur),
// blur out. See runWipe.
const WIPE_TOTAL_MS = 2600;
const WIPE_PHASE1_FRAC = 0.28; // blur in — outgoing image only, no content change yet
const WIPE_PHASE2_FRAC = 0.42; // the right-to-left reveal itself, still blurred
// phase 3 (blur out) is whatever's left: 1 - PHASE1 - PHASE2
const WIPE_BLUR_MAX_PX = 18;
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
// .lv8-page2__ambient-layer), each running its own continuous "breathe"
// animation forever; only their CSS gradient-stop custom-properties and
// which one is .is-active ever change, so the motion itself never
// restarts or jumps when the palette swaps. setAmbientForIndex is called
// the INSTANT a portrait transition starts (see scheduleNext below), not
// after it finishes, so this 2.2s crossfade runs concurrently with the
// portrait's own (slower, 2.6s) blur/wipe — reading as one continuous
// shift instead of the image changing and then the colour catching up.
// ---------------------------------------------------------------
const ambientA = document.getElementById('lv8-ambient-a');
const ambientB = document.getElementById('lv8-ambient-b');
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

  function smoothstep(t: number) {
    const c = Math.min(Math.max(t, 0), 1);
    return c * c * (3 - 2 * c);
  }

  // Three phases inside one duration (see chat reply — corrects the old
  // instant snap): the outgoing image blurs up first (no content change
  // yet), THEN the right-to-left reveal happens while still blurred (so
  // the swap itself reads as "the colours are changing" rather than "a
  // new picture snapped in"), then the now-fully-incoming image blurs
  // back down to crisp. The blur is a plain CSS filter on the canvas
  // element — cheap, and it naturally also softens the pixelated band's
  // hard block edges during phase 2 instead of fighting them.
  function runWipe(fromIndex: number, toIndex: number): Promise<void> {
    return new Promise(resolve => {
      const start = performance.now();
      const phase3Frac = 1 - WIPE_PHASE1_FRAC - WIPE_PHASE2_FRAC;

      function step(time: number) {
        const t = Math.min((time - start) / WIPE_TOTAL_MS, 1);
        const { width: w, height: h } = canvas!;

        let blurPx: number;
        let revealFrac: number;
        if (t < WIPE_PHASE1_FRAC) {
          blurPx = WIPE_BLUR_MAX_PX * smoothstep(t / WIPE_PHASE1_FRAC);
          revealFrac = 0;
        } else if (t < WIPE_PHASE1_FRAC + WIPE_PHASE2_FRAC) {
          blurPx = WIPE_BLUR_MAX_PX;
          revealFrac = smoothstep((t - WIPE_PHASE1_FRAC) / WIPE_PHASE2_FRAC);
        } else {
          const t3 = (t - WIPE_PHASE1_FRAC - WIPE_PHASE2_FRAC) / phase3Frac;
          blurPx = WIPE_BLUR_MAX_PX * (1 - smoothstep(t3));
          revealFrac = 1;
        }

        canvas!.style.filter = blurPx > 0.4 ? `blur(${blurPx.toFixed(1)}px)` : 'none';

        const revealX = w * (1 - revealFrac); // grows the revealed region from the right edge leftward
        ctx!.clearRect(0, 0, w, h);
        drawImageCover(images[fromIndex]); // untouched (not-yet-reached) portion underneath
        drawImageCover(images[toIndex], revealX, w - revealX); // already-revealed portion
        if (revealFrac > 0 && revealFrac < 1) {
          drawPixelatedBand(images[toIndex], revealX - WIPE_BAND_PX / 2, WIPE_BAND_PX); // the sweeping blocky seam
        }

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
      // fired now, concurrently with the blur/wipe below, not after it
      // resolves — see the ambient section's comment for why
      setAmbientForIndex(nextIndex);
      await runWipe(activeIndex, nextIndex);
      activeIndex = nextIndex;
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
