// /lab/lv12/ — isolated preview of a cinematic loading-screen concept.
// No real homepage copied in. Full-bleed Lottie mark
// (@lottiefiles/dotlottie-react) with a 4s-minimum runtime: natural
// playback is 2.0s, so it loops for exactly the number of cycles needed
// to reach 4s, stopping only at a clean loop boundary.
//
// On completion, this hands off via the SAME strip cover/reveal used for
// the real site's Home<->About (etc.) transition — the actual
// strip-transition.ts mechanism and lv6-transition.css rules, imported
// here rather than rebuilt (see those files' own comments for the
// stagger/duration/easing this reuses verbatim), coloured with the real
// "Home" entry from view-colors.ts rather than a guessed hex value.
import { createRoot } from 'react-dom/client';
import { DotLottieReact, type DotLottie } from '@lottiefiles/dotlottie-react';
import { buildStripProfile, playStripCoverReveal } from '../../strip-transition';
import { LEAVE_COLOR } from '../../view-colors';

// lottie.host's /embed/... URL (as given) serves an HTML player page, not
// the asset itself — dropping /embed/ from the path is the actual .lottie
// file (confirmed via content-type: application/zip on that URL).
const LOTTIE_SRC = 'https://lottie.host/2ea6358a-5f8e-4b93-b5d0-864fd52c6e24/Y4dkjb7YJ9.lottie';

const MIN_DURATION_MS = 4000;

const mount = document.getElementById('lv12-lottie-mount');
const loader = document.getElementById('lv12-loader');

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Same 720px breakpoint lv6-transition.ts itself uses to pick desktop
// columns vs. mobile bars.
const mobileMQ = window.matchMedia('(max-width: 720px)');
const desktopProfile = buildStripProfile(document.getElementById('lv6-transition'), '.lv6-transition__col');
const mobileProfile = buildStripProfile(document.getElementById('lv6-transition-mobile'), '.lv6-transition-mobile__bar');

function fadeFinish() {
  // Reduced-motion path only, and a last-resort fallback if the strip
  // overlay's elements aren't found for some reason — a plain opacity
  // cross-fade rather than the strip sweep.
  if (!loader) return;
  loader.classList.add('is-exiting');
  loader.addEventListener(
    'transitionend',
    () => {
      loader.style.display = 'none';
    },
    { once: true }
  );
}

async function stripFinish() {
  const profile = mobileMQ.matches ? mobileProfile ?? desktopProfile : desktopProfile ?? mobileProfile;
  if (!profile || !loader) {
    fadeFinish();
    return;
  }
  await playStripCoverReveal(profile, {
    color: LEAVE_COLOR.home,
    onCovered: () => {
      // Fully hidden behind the now-opaque strips — an instant swap here
      // is exactly what showOnly() does for a real view change, no
      // cross-fade needed on top of the strips themselves.
      loader.style.display = 'none';
    },
  });
}

if (mount) {
  if (reduce) {
    // Don't autoplay an animation the user asked not to see motion from —
    // hold briefly on the plain loader (background + grain only) instead,
    // then hand off with a plain fade rather than the strip sweep (also
    // real motion, kept out of the reduced-motion path).
    setTimeout(fadeFinish, 500);
  } else {
    // Counting whole cycles against a precomputed target (rather than
    // comparing Date.now() to a wall-clock deadline on every 'loop' event)
    // deliberately avoids a real failure mode: this source's cycle is
    // 2.000s exactly, but event-dispatch jitter means the 2nd 'loop' fires
    // at ~1980ms elapsed, not 2000 — a wall-clock `>= 4000` check misses
    // that by ~20ms and forces a needless 3rd cycle (6s instead of ~4s).
    // cyclesNeeded is computed once playback actually starts, from the
    // player's own reported duration, so it's exact regardless of any
    // single event's timing.
    let cyclesNeeded = 1;
    let cyclesDone = 0;
    let settled = false;

    const onCycleBoundary = (dotLottie: DotLottie) => {
      // Fires at 'loop' (every wrap-back-to-start while loop=true) and, as
      // a defensive fallback, 'complete' (in case a future source's
      // natural length is already >=4s and never loops at all — with
      // loop=true that would still surface as 'complete' once playback
      // genuinely stops rather than restarting). Either way this only
      // ever fires at a clean cycle boundary, never mid-playback, so
      // stopping here can't cut the animation off partway through.
      if (settled) return;
      cyclesDone += 1;
      if (cyclesDone >= cyclesNeeded) {
        settled = true;
        dotLottie.pause();
        void stripFinish();
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
        dotLottieRefCallback={(dotLottie: DotLottie | null) => {
          if (!dotLottie) return;
          dotLottie.addEventListener('play', () => {
            // duration (seconds) is only meaningful once the animation
            // data has actually loaded, which 'play' guarantees.
            const cycleMs = dotLottie.duration * 1000;
            cyclesNeeded = cycleMs > 0 ? Math.max(1, Math.ceil(MIN_DURATION_MS / cycleMs)) : 1;
          });
          dotLottie.addEventListener('loop', () => onCycleBoundary(dotLottie));
          dotLottie.addEventListener('complete', () => onCycleBoundary(dotLottie));
        }}
      />
    );
  }
}
