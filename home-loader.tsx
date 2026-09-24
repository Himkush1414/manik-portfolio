// / (the main site) — first-visit-only loading gate. Plays a full-screen
// Lottie mark over a matte background, then hands off into the home page
// (already rendering normally underneath — nothing here blocks or delays
// the rest of main.tsx's own setup) via the SAME strip cover/reveal used
// for the site's real Home<->About/Projects/Contact/Skills transitions
// (strip-transition.ts + view-colors.ts, not a rebuilt copy — see
// lv6-transition.ts, which uses the identical two modules).
//
// Ported from /lab/lv12/'s preview of this same loading concept — that
// route is left exactly as it was, not repointed at this file, per the
// brief that introduced it.
//
// sessionStorage gate: index.html's own inline script already hides
// #home-loader synchronously (before first paint) if the flag from a
// previous run this session is set — by the time THIS module runs, a
// repeat-visit's #home-loader is already display:none and inert-toggling
// #home-root would only be extra, pointless work. So the real gate here
// is simple: if the flag is set, do nothing at all — no DOM writes, no
// dynamic import of the ~1.4MB Lottie player/WASM, nothing — a repeat
// visit costs this feature exactly zero bytes and zero main-thread time,
// which is the whole point (this page's mobile Performance score was
// recently brought up from ~55 to ~77; a loader that fired on every load
// would undo a meaningful share of that).
import { createRoot } from 'react-dom/client';
import type { DotLottie } from '@lottiefiles/dotlottie-react';
import { buildStripProfile, playStripCoverReveal } from './strip-transition';
import { LEAVE_COLOR } from './view-colors';

const SESSION_KEY = 'homeLoaderPlayed';
const LOTTIE_SRC = 'https://lottie.host/2ea6358a-5f8e-4b93-b5d0-864fd52c6e24/Y4dkjb7YJ9.lottie';
const MIN_DURATION_MS = 4000;

function alreadyPlayed(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    // Unavailable (private-mode Safari, storage blocked, ...) — index.html's
    // inline script already fails open (hides the loader) in this case for
    // the exact same reason; mirror that here rather than getting stuck.
    return true;
  }
}

function markPlayed() {
  try {
    sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    /* nothing to do — worst case it plays again next load, never stuck */
  }
}

const loader = document.getElementById('home-loader');

if (loader && !alreadyPlayed()) {
  void runLoader(loader);
}

async function runLoader(loaderEl: HTMLElement) {
  const homeRoot = document.getElementById('home-root');
  // Keyboard/screen-reader users shouldn't be able to reach the home page
  // through the loader — same `inert` treatment already used elsewhere on
  // this page (main.tsx's return-nav, StaggeredMenu's closed panel) for
  // exactly this "visually covered but not actually removed" situation.
  homeRoot?.toggleAttribute('inert', true);

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {
    // Don't autoplay an animation the user asked not to see motion from —
    // a short hold on the plain matte background instead. Still hands off
    // through the same strip reveal afterward: that's the site's ordinary
    // page-transition mechanism, used for every real navigation
    // regardless of motion preference, so treating it as "not part of the
    // loading animation" keeps this consistent with how the rest of the
    // site already behaves rather than inventing a new exception.
    await wait(500);
  } else {
    await playLottie();
  }

  await revealViaStrip(loaderEl);

  homeRoot?.toggleAttribute('inert', false);
  markPlayed();
}

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

async function playLottie(): Promise<void> {
  const mount = document.getElementById('home-loader-lottie-mount');
  if (!mount) return;

  // Dynamic import: the ~1.4MB dotlottie-web WASM/JS payload is fetched
  // only on a first visit that actually reaches this line — never on a
  // repeat visit (short-circuited above before this function is even
  // called), and not eagerly bundled into this page's main chunk either
  // way. (react-dom/client itself is imported statically above — it's
  // already part of this page's eager critical path regardless of this
  // loader, every other React island here needs it too — so there's
  // nothing to gain deferring that specific import.)
  const { DotLottieReact } = await import('@lottiefiles/dotlottie-react');

  return new Promise<void>(resolve => {
    // Counting whole cycles against a precomputed target (rather than
    // comparing Date.now() to a wall-clock deadline on every 'loop'
    // event) avoids a real failure mode found while building /lab/lv12/:
    // this source's cycle is 2.000s exactly, but event-dispatch jitter
    // means the 2nd 'loop' fires at ~1980ms elapsed, not 2000 — a
    // wall-clock `>= 4000` check misses that by ~20ms and forces a
    // needless 3rd cycle (6s instead of ~4s). cyclesNeeded is computed
    // once playback actually starts, from the player's own reported
    // duration, so it's exact regardless of any single event's timing.
    let cyclesNeeded = 1;
    let cyclesDone = 0;
    let settled = false;

    const onCycleBoundary = (dotLottie: DotLottie) => {
      if (settled) return;
      cyclesDone += 1;
      if (cyclesDone >= cyclesNeeded) {
        settled = true;
        dotLottie.pause();
        resolve();
      }
    };

    createRoot(mount).render(
      <DotLottieReact
        src={LOTTIE_SRC}
        autoplay
        loop
        layout={{ fit: 'contain', align: [0.5, 0.5] }}
        renderConfig={{ autoResize: true, devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2) }}
        style={{ width: '100%', height: '100%' }}
        dotLottieRefCallback={dotLottie => {
          if (!dotLottie) return;
          dotLottie.addEventListener('play', () => {
            const cycleMs = dotLottie.duration * 1000;
            cyclesNeeded = cycleMs > 0 ? Math.max(1, Math.ceil(MIN_DURATION_MS / cycleMs)) : 1;
          });
          dotLottie.addEventListener('loop', () => onCycleBoundary(dotLottie));
          dotLottie.addEventListener('complete', () => onCycleBoundary(dotLottie));
        }}
      />
    );
  });
}

async function revealViaStrip(loaderEl: HTMLElement): Promise<void> {
  const mobileMQ = window.matchMedia('(max-width: 720px)');
  const desktopProfile = buildStripProfile(document.getElementById('lv6-transition'), '.lv6-transition__col');
  const mobileProfile = buildStripProfile(document.getElementById('lv6-transition-mobile'), '.lv6-transition-mobile__bar');
  const profile = mobileMQ.matches ? mobileProfile ?? desktopProfile : desktopProfile ?? mobileProfile;

  if (!profile) {
    loaderEl.style.display = 'none';
    return;
  }

  await playStripCoverReveal(profile, {
    color: LEAVE_COLOR.home,
    onCovered: () => {
      // Fully hidden behind the now-opaque strips — the home page is
      // already fully rendered underneath (nothing in main.tsx waits on
      // this loader), so an instant swap here is all that's needed, same
      // as showOnly() does for a real view change.
      loaderEl.style.display = 'none';
    },
  });
}
