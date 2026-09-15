// /lab/lv8 — "page 2", revealed by the hero's strip-flip (see main.ts's
// Move Next handler + lv8-strip-field.ts's triggerFlipReveal + its own
// white-blur entrance, wired in index.html/lv8.css). Three independent
// pieces live here:
//
//  1. a continuously-drifting ambient gradient behind everything — a
//     strict 6-band vertical light-to-dark structure (see
//     PORTRAIT_GRADIENTS below), never cursor-reactive, always live.
//  2. the portraits themselves, rotating every ~7-10s via a blur-swap
//     (no sliding/wiping motion — see runBlurTransition) rendered on a
//     <canvas> (see startPortraitCycle).
//  3. the inert menu dropdown + Contact button (no navigation — lv8 is a
//     standalone route, see the chat reply and index.html's comment).
//
// Only imported (dynamically, from main.ts) once the flip-reveal starts,
// same spirit as game.ts's own dynamic import — no reason to pay for
// portrait PNGs on a visit that never reaches "Move Next".
//
// Active rotation is cut down to images 1-2 only for now (see chat
// reply) — 3/4/5 stay on disk and PORTRAIT_GRADIENTS still has their
// data below, just commented out, rather than deleting either: this has
// swung back and forth a few times already (6 images -> swap one ->
// drop it entirely -> now down to 2), so keeping the computed data one
// uncomment away beats re-running the extraction script if it swings
// back again.

const PORTRAIT_COUNT = 2;
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
// a flat fade". Order matches portrait-1..5.png (only 1-2 active — see
// above).
const GRADIENT_STOP_KEYS = ['g0', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6'] as const;
const PORTRAIT_GRADIENTS: string[][] = [
  ['#e8eaed', '#bcc6dc', '#7495dc', '#1552d5', '#1b3774', '#111622', '#060709'], // 1 — blue
  ['#ede8e8', '#dcbcc0', '#dc7482', '#d5152e', '#741b27', '#221113', '#090607'], // 2 — red
  // ['#ebe8ed', '#ccbcdc', '#a974dc', '#7615d5', '#481b74', '#1a1122', '#080609'], // 3 — violet (out of rotation)
  // ['#edeae8', '#dcc8bc', '#dc9b74', '#d55c15', '#743c1b', '#221711', '#090706'], // 4 — orange (out of rotation)
  // ['#e8e9ed', '#bcc4dc', '#748fdc', '#1546d5', '#1b3274', '#111522', '#060709'], // 5 — blue/violet (out of rotation)
];

const ROTATE_MIN_MS = 7000;
const ROTATE_MAX_MS = 10000;
// Corrected transition (see chat reply): no sliding/wiping motion at
// all. Blur-in timing/intensity kept exactly as previously confirmed
// correct; the swap now happens as a single instant cut at peak blur
// (see runBlurTransition), not a reveal spread across a middle phase.
const TRANSITION_TOTAL_MS = 2600;
const BLUR_IN_FRAC = 0.28; // the swap fires the instant this fraction is crossed — peak blur
const TRANSITION_BLUR_MAX_PX = 18;

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
// portrait's own (slower, 2.6s) blur transition — reading as one
// continuous shift instead of the image changing and then the colour
// catching up.
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
// Portrait cycle — blur-swap between images (no sliding/wiping — see
// runBlurTransition), looping 1 -> 2 -> ... -> 5 -> 1, roughly every
// 7-10s while idle.
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

  // No sliding/wiping motion (see chat reply — corrects the previous
  // right-to-left wipe): the outgoing image blurs up, then AT peak blur
  // the canvas content is swapped to the incoming image in one instant
  // cut (not a reveal spread over time), then blur eases back down to
  // crisp. The blur is a plain CSS filter on the canvas element, so the
  // swap itself — hidden inside the blur — is the only content change;
  // nothing ever moves left or right.
  function runBlurTransition(fromIndex: number, toIndex: number): Promise<void> {
    return new Promise(resolve => {
      const start = performance.now();
      let swapped = false;

      function step(time: number) {
        const t = Math.min((time - start) / TRANSITION_TOTAL_MS, 1);

        let blurPx: number;
        if (t < BLUR_IN_FRAC) {
          blurPx = TRANSITION_BLUR_MAX_PX * smoothstep(t / BLUR_IN_FRAC);
        } else {
          const tOut = (t - BLUR_IN_FRAC) / (1 - BLUR_IN_FRAC);
          blurPx = TRANSITION_BLUR_MAX_PX * (1 - smoothstep(tOut));
        }
        canvas!.style.filter = blurPx > 0.4 ? `blur(${blurPx.toFixed(1)}px)` : 'none';

        if (!swapped && t >= BLUR_IN_FRAC) {
          swapped = true;
          renderStaticFor(toIndex); // the cut — happens once, at peak blur
        }

        if (t < 1) {
          rafId = requestAnimationFrame(step);
        } else {
          canvas!.style.filter = 'none';
          resolve();
        }
      }

      renderStaticFor(fromIndex); // drawn once up front — nothing else changes the pixels during blur-in
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
