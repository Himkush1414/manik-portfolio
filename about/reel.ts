// /about — the motion reel inside "THE WORK"'s growing box (desktop
// #work-video, mobile #m-work-video — only the one for the active layout
// is ever touched).
//
// Two encodes of the same 30s / 60fps master, both H.264 + faststart so
// playback starts after the first few hundred KB instead of the whole file:
//  - 2160p (true 4K) for screens that can actually show more than 1080p
//    physical pixels (1440p/4K monitors, Retina laptops)
//  - 1080p for everything else — on a 1080p display (or a phone, where
//    the box is at most a few hundred CSS px wide) the 4K file looks
//    pixel-identical but costs 4x the bandwidth and decode work, which is
//    exactly what shows up as stutter
//
// Nothing downloads on page load: this page also runs inside the main
// site's hidden, pre-loaded About iframe (lv6-transition.ts), and a 30MB
// video fetch there would compete with the homepage for bandwidth. The src
// is attached only once the visitor starts moving through About (first
// wheel/key/touch on desktop; the panel approaching on mobile), and the
// video only plays while its panel is actually on screen.
//
// `export {}` keeps this an ES module (same reason as main.ts/mobile.ts).
export {};

const IS_MOBILE_LAYOUT = window.matchMedia('(max-width: 720px)').matches;

const SRC_4K = new URL('./about-reel-2160p.mp4', import.meta.url).href;
const SRC_HD = new URL('./about-reel-1080p.mp4', import.meta.url).href;

function pickSource() {
  if (IS_MOBILE_LAYOUT) return SRC_HD;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (conn?.saveData) return SRC_HD;
  const dpr = window.devicePixelRatio || 1;
  const physW = Math.round(window.screen.width * dpr);
  const physH = Math.round(window.screen.height * dpr);
  return physW > 1920 || physH > 1080 ? SRC_4K : SRC_HD;
}

function initReel() {
  const video = document.getElementById(IS_MOBILE_LAYOUT ? 'm-work-video' : 'work-video') as HTMLVideoElement | null;
  // the element whose on-screen-ness decides play/pause: the whole pinned
  // wrapper on mobile (its sticky panel is on screen for the wrapper's
  // full height), the panel itself on desktop
  const watch = IS_MOBILE_LAYOUT ? document.getElementById('m-work-wrap') : document.getElementById('panel-work');
  if (!video || !watch) return;

  // some browsers only honour autoplay-while-muted if the property (not
  // just the attribute) is set before playback is requested
  video.muted = true;

  let loaded = false;
  let inView = false;

  function load() {
    if (loaded) return;
    loaded = true;
    video!.preload = 'auto';
    video!.src = pickSource();
    video!.load();
    sync();
  }

  function sync() {
    if (!loaded) return;
    if (inView && document.visibilityState === 'visible') {
      const p = video!.play();
      if (p) p.catch(() => { /* autoplay refused (e.g. low-power mode) — poster stays */ });
    } else if (!video!.paused) {
      video!.pause();
    }
  }

  if (!('IntersectionObserver' in window)) {
    inView = true;
    load();
    return;
  }

  new IntersectionObserver(
    entries => {
      inView = entries[entries.length - 1].isIntersecting;
      if (inView) load();
      sync();
    },
    { threshold: 0 }
  ).observe(watch);

  if (IS_MOBILE_LAYOUT) {
    // start fetching while the visitor is still about half a screen away,
    // so it's already buffered by the time the box starts growing
    const early = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) {
          early.disconnect();
          load();
        }
      },
      { rootMargin: '50% 0px 50% 0px' }
    );
    early.observe(watch);
  } else {
    // desktop's panels are translated sideways inside a clipped container,
    // so a rootMargin look-ahead can't see them coming — the visitor's
    // first navigation input is the equivalent "they're on their way" cue
    // (panel 3 is still two full panels of scrolling away at that point)
    const onFirstInput = () => {
      window.removeEventListener('wheel', onFirstInput);
      window.removeEventListener('keydown', onFirstInput);
      window.removeEventListener('touchstart', onFirstInput);
      load();
    };
    window.addEventListener('wheel', onFirstInput, { passive: true });
    window.addEventListener('keydown', onFirstInput);
    window.addEventListener('touchstart', onFirstInput, { passive: true });
  }

  document.addEventListener('visibilitychange', sync);
}

initReel();
