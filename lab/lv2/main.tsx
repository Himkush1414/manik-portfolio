import { createRoot } from 'react-dom/client';
import ShapeBlur from './ShapeBlur';
import InfiniteSpiral from './InfiniteSpiral';
import { logos } from './logos';
// §4 reuses /lab/lv1's footer verbatim — the actual component, asset and
// extra stylesheet, imported (not copied/forked) so it stays identical.
import RippleDistortion from '../lv1/RippleDistortion';
import watermarkSource from '../lv1/watermark-source.jpg';
import './lv2.css';
import '../lv1/lab.css';

// Freshness beacon — if this line isn't in the console you're on a cached bundle.
console.log('%clab/lv2 build 2026-09-08-rebuild-d', 'color:#8fb8ea;font-weight:600');

// Clear any stray service worker / caches on localhost:5173 that could pin a
// stale page at the bare URL (the "?query works, plain doesn't" symptom).
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    if (regs.length) {
      regs.forEach(r => r.unregister());
      console.warn(`[lab/lv2] unregistered ${regs.length} service worker(s) — reload once more for a clean load`);
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
    console.error('[lab/lv2] ShapeBlur failed to mount:', err);
  }

  // If WebGL is blocked, no <canvas> appears — say so instead of a silent blank.
  setTimeout(() => {
    if (!mount.querySelector('canvas')) {
      console.warn(
        '[lab/lv2] ShapeBlur did not mount a <canvas> — WebGL is likely disabled ' +
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
        className="lv2-spiral"
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
    console.error('[lab/lv2] InfiniteSpiral failed to mount:', err);
  }
}

// ---- §2 scroll-pinned stack: fade each row pale -> dark as it comes into
// focus, and hold the section fixed until all three rows have been cycled.
const stack = document.querySelector<HTMLElement>('.lv2-stack');
const stackRows = Array.from(document.querySelectorAll<HTMLElement>('.lv2-row'));
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

// ---- §3 "Creative Design" reveal: pin a dark-navy background, slide the
// solid panel up off the top on scroll, and fade in the statement behind it
// word by word, timed to scroll position.
const reveal = document.querySelector<HTMLElement>('.lv2-reveal');
const revealPanel = document.querySelector<HTMLElement>('.lv2-reveal__panel');
if (reveal && revealPanel) {
  // split each statement line into per-word spans so they can fade individually
  const words: HTMLElement[] = [];
  reveal.querySelectorAll<HTMLElement>('.lv2-reveal__line').forEach(line => {
    const parts = (line.textContent || '').trim().split(/\s+/);
    line.textContent = '';
    parts.forEach((word, i) => {
      const span = document.createElement('span');
      span.className = 'w';
      span.textContent = i < parts.length - 1 ? `${word} ` : word;
      line.appendChild(span);
      words.push(span);
    });
  });

  const reduceR = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canPinR = () =>
    !reduceR && window.innerWidth > 900 && window.innerHeight >= 620;
  const ssR = (a: number, b: number, x: number) => {
    const t = Math.min(Math.max((x - a) / (b - a || 1), 0), 1);
    return t * t * (3 - 2 * t);
  };

  let tickingR = false;
  const applyR = () => {
    tickingR = false;
    if (!reveal.classList.contains('is-pin-ready')) return;

    const rect = reveal.getBoundingClientRect();
    const spanH = reveal.offsetHeight - window.innerHeight;
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

    // panel clears the top first...
    revealPanel.style.setProperty('--slide', ssR(0.04, 0.5, p).toFixed(4));
    // ...then the statement finishes filling in, then it dwells before release
    const rp = Math.min(Math.max((p - 0.12) / 0.58, 0), 1);
    const n = words.length;
    for (let i = 0; i < n; i++) {
      const wp = Math.min(Math.max(rp * n - i, 0), 1);
      words[i].style.opacity = (0.1 + 0.9 * (wp * wp * (3 - 2 * wp))).toFixed(3);
    }
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
      words.forEach(w => (w.style.opacity = '1'));
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
   RippleDistortion cursor effect). The markup below #lv2-footer mirrors
   lab/lv1/index.html; the alignment + mount logic below mirrors
   lab/lv1/main.tsx. /lab/lv1 itself is untouched.
   ========================================================================== */

// no-op sign-up form (carried over from lv1 / the homepage's script.js)
const footerForm = document.querySelector<HTMLFormElement>('#lv2-footer .signup__form');
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
const footerWatermark = document.querySelector<HTMLElement>('#lv2-footer .watermark');

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
const NUDGE_KEY = 'lv2FooterRippleNudgeX';
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
    console.log(`[lab/lv2] footer ripple nudge X = ${nudgeX}px`);
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
    console.error('[lab/lv2] RippleDistortion failed to mount:', err);
    rippleMount.style.display = 'none';
  }

  setTimeout(() => {
    if (!rippleMount.querySelector('canvas')) {
      console.warn(
        '[lab/lv2] RippleDistortion did not mount a <canvas> — WebGL is ' +
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
