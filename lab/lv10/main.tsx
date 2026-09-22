// /lab/lv10 — loader + Shuffle phrase sequence, played zoomed all the
// way into the real homepage hero box, then scroll-scrubbed back out:
//   Stage 1 (autoplay, ~5s, kept as previously specified): matte gradient
//            backdrop + a cycling word, each transition a right-to-left
//            per-letter drop-out/drop-in cascade; the final word scales
//            up, blurs and fades out. Fully opaque, covers everything.
//   Stage 2 (autoplay hold): the loader is gone; five Shuffle (react-bits)
//            phrases cycle over a transparent scrim, through which the
//            real hero box — already zoomed to fill the screen — shows.
//   Stage 3 (scroll-scrubbed, one-way): once "scroll down" finishes, the
//            camera's CSS transform eases from "zoomed into the hero box"
//            back to none, i.e. the real page's normal scale/position.
//            It's the same DOM element throughout — never repositioned
//            or resized separately — so it lines up by construction.
//            Once the zoom-out completes, scroll hands off to the normal
//            page and the sequence cannot be re-entered by scrolling up.
// Nothing outside this route is touched: ShapeBlur is imported read-only
// from the project root, exactly like the live homepage does.
import { createRoot } from "react-dom/client";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import ShapeBlur from "../../ShapeBlur";
import Shuffle from "./Shuffle";

gsap.registerPlugin(ScrollTrigger);

console.log(
  "%clab/lv10 build 2026-09-22 (loader -> Shuffle hold, zoomed into the real hero box -> scroll zoom-out)",
  "color:#205FA4;font-weight:600;background:#060F1C;padding:2px 6px",
);

const html = document.documentElement;
const body = document.body;
const loader = document.getElementById("lv10-loader")!;
const wordStage = document.getElementById("lv10-word")!;
const phraseOverlay = document.getElementById("lv10-phrase-overlay") as HTMLDivElement;
const phraseMountEl = document.getElementById("lv10-phrase") as HTMLDivElement;
const cameraContent = document.getElementById("lv10-camera-content") as HTMLDivElement;

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

html.classList.add("lv10-lock");
body.classList.add("lv10-lock");

// ---------------------------------------------------------------
// Zoom math — computed once (and on resize, until committed) from the
// real hero box's own natural, untransformed rect. Cover-fills the
// viewport with the box, centred, then eases scale -> 1 and translate ->
// 0 as the user scrolls, so the box (and everything around it) settles
// into its exact normal position: the same element, never faked.
// ---------------------------------------------------------------
const heroEffect = document.querySelector<HTMLElement>(".lv2-effect")!;
let zoom = { s0: 1, tx0: 0, ty0: 0 };
let currentProgress = 0;
let zoomCommitted = false;

function measureZoom() {
  cameraContent.style.transform = "none";
  const boxRect = heroEffect.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const s0 = Math.max(vw / boxRect.width, vh / boxRect.height);
  const boxCenterX = boxRect.left + boxRect.width / 2;
  const boxCenterY = boxRect.top + boxRect.height / 2;
  zoom = {
    s0,
    tx0: vw / 2 / s0 - boxCenterX,
    ty0: vh / 2 / s0 - boxCenterY,
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function applyZoom(p: number) {
  const s = lerp(zoom.s0, 1, p);
  const tx = lerp(zoom.tx0, 0, p);
  const ty = lerp(zoom.ty0, 0, p);
  cameraContent.style.transform = `scale(${s}) translate(${tx}px, ${ty}px)`;
}

// Zoomed all the way in from the very first paint — before Stage 1 even
// starts playing, so the loader/Shuffle overlay always sits over exactly
// the hero box's own bounds, per spec.
measureZoom();
applyZoom(0);

window.addEventListener("resize", () => {
  if (zoomCommitted) return;
  measureZoom();
  applyZoom(currentProgress);
});

// ---------------------------------------------------------------
// Stage 1 — word cascade. Words pulled from the site's own real copy:
// "Code for Fun" (hero headline), "CREATIVE DESIGN" (Skills hero text),
// "The craft is the point" (hero lead paragraph).
// ---------------------------------------------------------------
const WORDS = ["CODE", "CREATIVE", "DESIGN", "CRAFT"];
const LETTER_STAGGER = 0.045;
const SWAP_DURATION = 0.28;
const HOLD_MS = reduceMotion ? 120 : 700;
const LAST_HOLD_MS = reduceMotion ? 120 : 450;

function buildLetters(word: string, layer: HTMLElement): HTMLElement[] {
  layer.innerHTML = "";
  return word.split("").map(ch => {
    const span = document.createElement("span");
    span.className = "lv10-word__letter";
    span.textContent = ch === " " ? " " : ch;
    layer.appendChild(span);
    return span;
  });
}

function playTimeline(tl: gsap.core.Timeline): Promise<void> {
  return new Promise(resolve => tl.eventCallback("onComplete", () => resolve()));
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

// Renders `newWord` in place of `oldWord`, right-to-left per-letter:
// the rightmost letter drops out while the incoming word's rightmost
// letter drops in from above at the same instant, then the next letter
// to the left repeats it, staggered, cascading leftward.
async function transitionWord(oldWord: string, newWord: string): Promise<void> {
  wordStage.innerHTML = "";
  const oldLayer = document.createElement("div");
  oldLayer.className = "lv10-word__layer";
  const newLayer = document.createElement("div");
  newLayer.className = "lv10-word__layer";
  wordStage.appendChild(oldLayer);
  wordStage.appendChild(newLayer);

  const oldLetters = buildLetters(oldWord, oldLayer);
  const newLetters = buildLetters(newWord, newLayer);
  gsap.set(newLetters, { yPercent: -130, opacity: 0 });

  const tl = gsap.timeline();
  oldLetters.forEach((el, i) => {
    const delay = (oldLetters.length - 1 - i) * LETTER_STAGGER;
    tl.to(el, { yPercent: 130, opacity: 0, duration: SWAP_DURATION, ease: "power2.in" }, delay);
  });
  newLetters.forEach((el, j) => {
    const delay = (newLetters.length - 1 - j) * LETTER_STAGGER;
    tl.to(el, { yPercent: 0, opacity: 1, duration: SWAP_DURATION, ease: "power2.out" }, delay);
  });

  await playTimeline(tl);

  // settle: drop back to one plain static layer holding the new word
  wordStage.innerHTML = "";
  const restLayer = document.createElement("div");
  restLayer.className = "lv10-word__layer";
  buildLetters(newWord, restLayer);
  wordStage.appendChild(restLayer);
}

async function playExit(): Promise<void> {
  const tl = gsap.timeline();
  tl.to(wordStage, {
    scale: 1.5,
    filter: "blur(18px)",
    opacity: 0,
    duration: 0.6,
    ease: "power2.in",
  });
  await playTimeline(tl);
}

async function runStage1(): Promise<void> {
  let current = "";
  for (let i = 0; i < WORDS.length; i++) {
    await transitionWord(current, WORDS[i]);
    current = WORDS[i];
    await wait(i < WORDS.length - 1 ? HOLD_MS : LAST_HOLD_MS);
  }
  await playExit();

  loader.remove();
  runStage2();
}

void runStage1();

// ---------------------------------------------------------------
// Stage 2 — five Shuffle phrases cycle, one at a time, scroll still
// locked. Once the last one ("scroll down") finishes shuffling in,
// scroll unlocks and Stage 3's zoom-out arms.
// ---------------------------------------------------------------
const PHRASES = ["welcome", "to my work", "enjoy your", "time", "scroll down"];
const phraseRoot = createRoot(phraseMountEl);
let allPhrasesDone = false;

function runStage2() {
  showPhrase(0);
}

function showPhrase(index: number) {
  const isLast = index === PHRASES.length - 1;
  phraseRoot.render(
    <Shuffle
      key={index}
      text={PHRASES[index]}
      tag="p"
      shuffleDirection="right"
      duration={0.35}
      animationMode="evenodd"
      shuffleTimes={1}
      ease="power3.out"
      stagger={0.03}
      threshold={0.1}
      triggerOnce={true}
      triggerOnHover={isLast}
      respectReducedMotion={true}
      loop={false}
      loopDelay={0}
      className="lv10-phrase-text"
      style={{
        fontFamily: '"Sora","Inter","Helvetica Neue",Arial,system-ui,sans-serif',
        fontWeight: 700,
        fontSize: "clamp(28px, 6vw, 60px)",
        color: "#F0F4F8",
        textShadow: "0 4px 26px rgba(4,10,20,0.5)",
      }}
      onShuffleComplete={() => {
        if (isLast) {
          if (!allPhrasesDone) {
            allPhrasesDone = true;
            html.classList.remove("lv10-lock");
            body.classList.remove("lv10-lock");
            setupZoomOut();
          }
        } else {
          window.setTimeout(() => showPhrase(index + 1), 650);
        }
      }}
    />,
  );
}

// The real hero's own ShapeBlur, mounted with the exact props the live
// homepage uses — visible live, through the transparent Stage 2 scrim,
// since the camera is already zoomed to fill the screen with this box.
const dpr = Math.min(window.devicePixelRatio || 1, 2);
const shapeMount = document.getElementById("lv10-shapeblur-mount");
if (shapeMount) {
  createRoot(shapeMount).render(
    <ShapeBlur
      variation={0}
      pixelRatioProp={dpr}
      shapeSize={1}
      roundness={0.5}
      borderSize={0.11}
      circleSize={0.3}
      circleEdge={1.6}
    />,
  );
}

// ---------------------------------------------------------------
// Stage 3 — scroll-scrubbed, one-way zoom-out. #lv10-camera is pinned
// (GSAP's own pin, same mechanism the site's own .lv2-stack pin section
// conceptually mirrors) over the #lv10-zoom-section's reserved scroll
// distance; onUpdate eases the camera content's transform from "zoomed
// into the hero box" back to none. onLeave (fired once scroll passes the
// pin's natural end) commits: kills the trigger and clamps scroll so the
// sequence can never be scrolled back into.
// ---------------------------------------------------------------
let committed = false;
let commitScrollY = 0;

function enforceFloor() {
  if (window.scrollY < commitScrollY) window.scrollTo(0, commitScrollY);
}

function setupZoomOut() {
  measureZoom();
  applyZoom(0);

  ScrollTrigger.create({
    trigger: "#lv10-zoom-section",
    start: "top top",
    end: "bottom bottom",
    pin: "#lv10-camera",
    scrub: 0.4,
    onUpdate(self) {
      if (committed) return;
      currentProgress = self.progress;
      applyZoom(currentProgress);
      phraseOverlay.style.opacity = String(Math.max(0, 1 - currentProgress / 0.08));
    },
    onLeave(self) {
      if (committed) return;
      committed = true;
      zoomCommitted = true;
      applyZoom(1);
      phraseOverlay.style.display = "none";
      commitScrollY = window.scrollY;
      window.addEventListener("scroll", enforceFloor, { passive: false });
      self.kill();
    },
  });
}
