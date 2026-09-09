import { createRoot } from 'react-dom/client';
import ShapeBlur from './ShapeBlur';
import InfiniteSpiral from './InfiniteSpiral';
import { logos } from './logos';
// §4 is /lab/lv1's footer — the RippleDistortion component + its texture are
// imported (not copied/forked) from /lab/lv1 so that code stays identical and
// untouched; lv3's footer changes are all additive (lv3.css + main.tsx below).
import RippleDistortion from '../lv1/RippleDistortion';
import watermarkSource from '../lv1/watermark-source.jpg';
import './lv3.css';
import '../lv1/lab.css';

// Freshness beacon — if this line isn't in the console you're on a cached bundle.
console.log('%clab/lv3 build 2026-09-09-footer-revert', 'color:#8fb8ea;font-weight:600');

// Clear any stray service worker / caches on localhost:5173 that could pin a
// stale page at the bare URL (the "?query works, plain doesn't" symptom).
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    if (regs.length) {
      regs.forEach(r => r.unregister());
      console.warn(`[lab/lv3] unregistered ${regs.length} service worker(s) — reload once more for a clean load`);
    }
  });
  if (window.caches && caches.keys) caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
}

const dpr = Math.min(window.devicePixelRatio || 1, 2);

const mount = document.getElementById('shapeblur-mount');
if (mount) {
  try {
    createRoot(mount).render(
      <ShapeBlur
        variation={0}
        pixelRatioProp={dpr}
        shapeSize={1}
        roundness={0.5}
        borderSize={0.11}
        circleSize={0.3}
        circleEdge={1.6}
      />
    );
  } catch (err) {
    console.error('[lab/lv3] ShapeBlur failed to mount:', err);
  }

  // If WebGL is blocked, no <canvas> appears — say so instead of a silent blank.
  setTimeout(() => {
    if (!mount.querySelector('canvas')) {
      console.warn(
        '[lab/lv3] ShapeBlur did not mount a <canvas> — WebGL is likely disabled ' +
          'or blocked in this browser (enable hardware acceleration / WebGL).'
      );
    }
  }, 2500);
}

// ---- §2 InfiniteSpiral (right side of the pinned stack section) ----
const spiralMount = document.getElementById('spiral-mount');
if (spiralMount) {
  try {
    createRoot(spiralMount).render(
      <InfiniteSpiral
        className="lv3-spiral"
        items={logos}
        animationMode="scroll"
        speed={0.8}
        direction="up"
        radius={150}
        cardWidth={132}
        cardHeight={132}
        verticalSpacing={72}
        perspective={1150}
        cardsPerTurn={7}
        rotation={0}
        cardTilt={0}
        cardRadius={16}
        centerScale={1.22}
        edgeFade={0.32}
        edgeBlur={5}
        pauseOnHover={false}
        imageFit="contain"
        grayscale={0}
      />
    );
  } catch (err) {
    console.error('[lab/lv3] InfiniteSpiral failed to mount:', err);
  }
}

// ---- §2 scroll-pinned stack: fade each row pale -> dark as it comes into
// focus, and hold the section fixed until all three rows have been cycled.
const stack = document.querySelector<HTMLElement>('.lv3-stack');
const stackRows = Array.from(document.querySelectorAll<HTMLElement>('.lv3-row'));
if (stack && stackRows.length === 3) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canPin = () =>
    !reduce && window.innerWidth > 900 && window.innerHeight >= 620;

  const sstep = (a: number, b: number, x: number) => {
    const t = Math.min(Math.max((x - a) / (b - a || 1), 0), 1);
    return t * t * (3 - 2 * t);
  };
  const setAct = (a0: number, a1: number, a2: number) => {
    stackRows[0].style.setProperty('--act', a0.toFixed(3));
    stackRows[1].style.setProperty('--act', Math.max(0, a1).toFixed(3));
    stackRows[2].style.setProperty('--act', a2.toFixed(3));
  };

  let ticking = false;
  const apply = () => {
    ticking = false;
    if (!stack.classList.contains('is-pin-ready')) return;

    const rect = stack.getBoundingClientRect();
    const span = stack.offsetHeight - window.innerHeight;
    let p: number;
    if (rect.top >= 0 || span <= 0) {
      p = 0;
      stack.classList.remove('is-pinned', 'is-past');
    } else if (-rect.top >= span) {
      p = 1;
      stack.classList.remove('is-pinned');
      stack.classList.add('is-past');
    } else {
      p = -rect.top / span;
      stack.classList.add('is-pinned');
      stack.classList.remove('is-past');
    }

    // one row dark at a time; smooth crossfades; row 3 stays dark to the end.
    const a0 = 1 - sstep(0.08, 0.30, p);
    const a1 = sstep(0.20, 0.40, p) - sstep(0.52, 0.70, p);
    const a2 = sstep(0.60, 0.80, p);
    setAct(a0, a1, a2);
  };

  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(apply);
    }
  };

  const sync = () => {
    if (canPin()) {
      stack.classList.add('is-pin-ready');
      apply();
    } else {
      stack.classList.remove('is-pin-ready', 'is-pinned', 'is-past');
      setAct(1, 1, 1);
    }
  };

  sync();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => {
    sync();
    onScroll();
  });
}

// ---- §3 "CREATIVE DESIGN": a 50vh deep-sea-navy band pinned to the top of the
// viewport. §4 sits in the bottom half from the first frame; on scroll the band
// translates up by its own height, bottom edge flush with §4's rising top edge,
// until it has fully cleared and §4 owns the viewport. --slide is driven
// LINEARLY (not eased) so that flush tracking holds.
const reveal = document.querySelector<HTMLElement>('.lv3-reveal');
const revealPanel = document.querySelector<HTMLElement>('.lv3-reveal__panel');
if (reveal && revealPanel) {
  const reduceR = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canPinR = () =>
    !reduceR && window.innerWidth > 900 && window.innerHeight >= 620;

  let tickingR = false;
  const applyR = () => {
    tickingR = false;
    if (!reveal.classList.contains('is-pin-ready')) return;

    const rect = reveal.getBoundingClientRect();
    // section height == the slide budget (one half-viewport)
    const spanH = reveal.offsetHeight;
    let p: number;
    if (rect.top >= 0 || spanH <= 0) {
      p = 0;
      reveal.classList.remove('is-pinned', 'is-past');
    } else if (-rect.top >= spanH) {
      p = 1;
      reveal.classList.remove('is-pinned');
      reveal.classList.add('is-past');
    } else {
      p = -rect.top / spanH;
      reveal.classList.add('is-pinned');
      reveal.classList.remove('is-past');
    }

    revealPanel.style.setProperty('--slide', p.toFixed(4));
  };
  const onScrollR = () => {
    if (!tickingR) {
      tickingR = true;
      requestAnimationFrame(applyR);
    }
  };
  const syncR = () => {
    if (canPinR()) {
      reveal.classList.add('is-pin-ready');
      applyR();
    } else {
      reveal.classList.remove('is-pin-ready', 'is-pinned', 'is-past');
      revealPanel.style.setProperty('--slide', '0');
    }
  };
  syncR();
  window.addEventListener('scroll', onScrollR, { passive: true });
  window.addEventListener('resize', () => {
    syncR();
    onScrollR();
  });
}

/* ==========================================================================
   §4 — EXACT reuse of /lab/lv1's footer (deep-sea "Manik Rana" watermark +
   RippleDistortion cursor effect). The markup below #lv3-footer mirrors
   lab/lv1/index.html; the alignment + mount logic below mirrors
   lab/lv1/main.tsx. /lab/lv1 itself is untouched.
   ========================================================================== */

// no-op sign-up form (carried over from lv1 / the homepage's script.js)
const footerForm = document.querySelector<HTMLFormElement>('#lv3-footer .signup__form');
if (footerForm) {
  footerForm.addEventListener('submit', e => {
    e.preventDefault();
    const input = footerForm.querySelector<HTMLInputElement>('.signup__input');
    if (input && input.value.trim()) {
      input.value = '';
      input.setAttribute('placeholder', "Thanks — I'll be in touch.");
      setTimeout(() => input.setAttribute('placeholder', 'Enter your email'), 2600);
    }
  });
}

// Pixel-align the ripple layer to the LIVE watermark SVG (same maths as lv1:
// viewBox 0 0 1920 400, preserveAspectRatio xMidYMax meet).
const VB_W = 1920;
const VB_H = 400;
const footerWatermark = document.querySelector<HTMLElement>('#lv3-footer .watermark');

function layoutRippleLayer() {
  if (!footerWatermark) return;
  const cw = footerWatermark.clientWidth;
  const ch = footerWatermark.clientHeight;
  if (!cw || !ch) return;
  const s = Math.min(cw / VB_W, ch / VB_H);
  const w = VB_W * s;
  const h = VB_H * s;
  const left = (cw - w) / 2;
  for (const id of ['ripple-root', 'ripple-fade']) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.style.left = `${left}px`;
    el.style.right = 'auto';
    el.style.bottom = '0';
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
  }
}

layoutRippleLayer();
window.addEventListener('resize', layoutRippleLayer);
requestAnimationFrame(() => requestAnimationFrame(layoutRippleLayer));
if (document.fonts && document.fonts.ready) document.fonts.ready.then(layoutRippleLayer);

// manual horizontal alignment nudge — kept independent from lv1's own key so
// tuning it here can never change what /lab/lv1 renders.
const NUDGE_KEY = 'lv3FooterRippleNudgeX';
const urlNudge = new URLSearchParams(location.search).get('rx');
let nudgeX =
  urlNudge != null
    ? parseFloat(urlNudge) || 0
    : parseFloat(localStorage.getItem(NUDGE_KEY) || '0') || 0;

function applyNudge() {
  for (const id of ['ripple-root', 'ripple-fade']) {
    document.getElementById(id)?.style.setProperty('--ripple-nudge-x', `${nudgeX}px`);
  }
}
applyNudge();

window.addEventListener('keydown', e => {
  if (e.key === '[' || e.key === ']') {
    nudgeX += e.key === '[' ? -2 : 2;
    try {
      localStorage.setItem(NUDGE_KEY, String(nudgeX));
    } catch {
      /* ignore */
    }
    applyNudge();
    console.log(`[lab/lv3] footer ripple nudge X = ${nudgeX}px`);
  }
});

const rippleMount = document.getElementById('ripple-root');
if (rippleMount) {
  try {
    createRoot(rippleMount).render(
      <RippleDistortion
        src={watermarkSource}
        trigger="hover"
        grayscale
        enabled
        quality="high"
        brushSize={185}
        strength={0.115}
        swirl={0.7}
        rings={3}
        spread={5}
        fade={2.6}
        spacing={13}
        dispersion={0.022}
        glint={0.08}
        tint="#8fb8ea"
        tintAmount={0.06}
        highlightColor="#e2efff"
        style={{ pointerEvents: 'none' }}
      />
    );
  } catch (err) {
    console.error('[lab/lv3] RippleDistortion failed to mount:', err);
    rippleMount.style.display = 'none';
  }

  setTimeout(() => {
    if (!rippleMount.querySelector('canvas')) {
      console.warn(
        '[lab/lv3] RippleDistortion did not mount a <canvas> — WebGL is ' +
          'likely disabled or blocked in this browser.'
      );
    }
  }, 2500);
}

// smooth-scroll for in-page anchors, consistent with the rest of the site
document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    if (!id || id.length < 2) return;
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

/* ==========================================================================
   lv3 CHANGE 1 + CHANGE 2 — footer behaviour (lv3 only)

   1a. Back to Top — the footer button now smooth-scrolls to y = 0.
   1b. Watermark entrance — an IntersectionObserver adds .lv3-wm-in to
       #lv3-footer once it is ~90% in view; CSS then transitions the
       wordmark (SVG + ripple canvas + feather, together) up from a big
       downward offset into place over ~1.2s.
   1c. Bubble burst — ~1.2s after that (as the wordmark settles) a short
       repeating spawner floods #lv3-burst for ~2.2s, then stops, so the
       rate drops back to the ambient field (.bubbles) from lv3.css.
   2.  The site nav (#lv3-topnav) slides back in once the footer owns the
       upper part of the viewport, and hides again above it.
   ========================================================================== */
const lv3Footer = document.querySelector<HTMLElement>('#lv3-footer');
const lv3TopNav = document.querySelector<HTMLElement>('#lv3-topnav');
const lv3BurstLayer = document.querySelector<HTMLElement>('#lv3-burst');
const lv3Reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// 1a — Back to Top
document.querySelectorAll<HTMLAnchorElement>('#lv3-footer .backtotop a').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: lv3Reduce ? 'auto' : 'smooth' });
  });
});

if (lv3Footer) {
  // ---- 1c. the burst spawner ----
  let burstArmed = true;
  let burstStartTimer = 0;
  let burstSpawnTimer = 0;
  let burstSpawningUntil = 0;

  const spawnBurstBubble = () => {
    if (!lv3BurstLayer) return;
    const b = document.createElement('span');
    b.className = 'lv3-burst-bubble';
    b.style.left = (3 + Math.random() * 94).toFixed(1) + '%';
    b.style.width = (7 + Math.random() * 12).toFixed(1) + 'px';
    b.style.setProperty('--lv3-burst-dur', (1.6 + Math.random() * 1.2).toFixed(2) + 's');
    b.style.setProperty('--lv3-drift', (Math.random() * 44 - 22).toFixed(0) + 'px');
    b.addEventListener('animationend', () => b.remove(), { once: true });
    lv3BurstLayer.appendChild(b);

    if (performance.now() < burstSpawningUntil) {
      burstSpawnTimer = window.setTimeout(spawnBurstBubble, 65 + Math.random() * 65);
    }
  };

  const fireBurst = () => {
    if (!lv3BurstLayer || lv3Reduce) return;
    burstSpawningUntil = performance.now() + 2200; // ~2.2s heavy flurry, then back to ambient
    spawnBurstBubble();
  };

  const cancelBurst = () => {
    clearTimeout(burstStartTimer);
    clearTimeout(burstSpawnTimer);
    burstSpawningUntil = 0;
  };

  // ---- 1b. watermark entrance, triggered by visibility ----
  const enterFooter = () => {
    lv3Footer.classList.add('lv3-wm-in');
    if (burstArmed && !lv3Reduce) {
      burstArmed = false;
      burstStartTimer = window.setTimeout(fireBurst, 1200); // ≈ when the rise settles
    }
  };
  const leaveFooter = () => {
    lv3Footer.classList.remove('lv3-wm-in');
    burstArmed = true;
    cancelBurst();
  };

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          // fire when the footer (and so the whole wordmark) is essentially
          // in view, so the ~1.2s rise plays fully on screen
          if (e.intersectionRatio >= 0.9) enterFooter();
          else if (e.intersectionRatio <= 0.03) leaveFooter();
        }
      },
      { threshold: [0, 0.03, 0.5, 0.9, 1] }
    );
    io.observe(lv3Footer);
  } else {
    enterFooter();
  }

  // ---- 2. returning site nav (scroll-driven) + entrance safety net ----
  let tickingF = false;
  const applyF = () => {
    tickingF = false;
    const vh = window.innerHeight;
    const rectTop = lv3Footer.getBoundingClientRect().top;

    if (lv3TopNav) {
      lv3TopNav.classList.toggle('is-visible', rectTop < vh * 0.45);
    }

    // safety net: if IO somehow didn't fire, trigger the entrance once we're
    // basically at the bottom of the page
    const atBottom =
      window.scrollY + vh >= document.documentElement.scrollHeight - 4;
    if (atBottom) enterFooter();
  };
  const onScrollF = () => {
    if (!tickingF) {
      tickingF = true;
      requestAnimationFrame(applyF);
    }
  };
  applyF();
  window.addEventListener('scroll', onScrollF, { passive: true });
  window.addEventListener('resize', onScrollF);
}
