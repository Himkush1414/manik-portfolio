import { createRoot } from 'react-dom/client';
import ShapeBlur from './ShapeBlur';
import InfiniteSpiral from './InfiniteSpiral';
import StaggeredMenu from './StaggeredMenu';
import { logos } from './logos';
import navLogo from './assets/logo.png';
// §4 reuses /lab/lv1's footer verbatim — the actual component, asset and
// extra stylesheet, imported (not copied/forked) so it stays identical.
import RippleDistortion from './lab/lv1/RippleDistortion';
import watermarkSource from './lab/lv1/watermark-source.jpg';
import './lv2.css';
import './lab/lv1/lab.css';

// Freshness beacon — if this line isn't in the console you're on a cached bundle.
console.log('%croot build 2026-09-10 (synced from lab/lv4)', 'color:#8fb8ea;font-weight:600');

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
  // scale the spiral geometry down on narrow screens (the component already
  // adapts its radius to its container, but the cards are a fixed px size)
  const vw = window.innerWidth;
  const sp =
    vw <= 480
      ? { card: 88, radius: 104, spacing: 50, per: 7 }
      : vw <= 900
        ? { card: 108, radius: 126, spacing: 60, per: 7 }
        : { card: 132, radius: 150, spacing: 72, per: 7 };
  try {
    createRoot(spiralMount).render(
      <InfiniteSpiral
        className="lv2-spiral"
        items={logos}
        animationMode="scroll"
        speed={0.8}
        direction="up"
        radius={sp.radius}
        cardWidth={sp.card}
        cardHeight={sp.card}
        verticalSpacing={sp.spacing}
        perspective={1150}
        cardsPerTurn={sp.per}
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
const revealStage = document.querySelector<HTMLElement>('.lv2-reveal__stage');
if (reveal && revealPanel && revealStage) {
  // split each statement line into per-character spans so the reveal scrubs
  // letter by letter (was per-word, which stepped chunkily)
  const words: HTMLElement[] = [];
  reveal.querySelectorAll<HTMLElement>('.lv2-reveal__line').forEach(line => {
    const chars = Array.from((line.textContent || '').trim());
    line.textContent = '';
    chars.forEach(ch => {
      const span = document.createElement('span');
      span.className = 'w';
      span.textContent = ch;
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

  // ~2 letters ease in together (SPREAD) so the scrub feels fluid, not steppy
  // — shared by both the pinned (desktop) and flow (mobile) reveal below.
  const SPREAD = 2.2;
  const lightWords = (rp: number) => {
    const n = words.length;
    const denom = n - 1 + SPREAD;
    for (let i = 0; i < n; i++) {
      const wp = Math.min(Math.max((rp * denom - i) / SPREAD, 0), 1);
      words[i].style.opacity = (0.1 + 0.9 * (wp * wp * (3 - 2 * wp))).toFixed(3);
    }
  };

  let tickingR = false;
  const applyR = () => {
    tickingR = false;
    if (reveal.classList.contains('is-pin-ready')) {
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
      lightWords(Math.min(Math.max((p - 0.12) / 0.58, 0), 1));
    } else if (!reduceR) {
      // Mobile / short-viewport: the section isn't pinned, so there is no
      // scroll-jacked scrub to time this to. Instead, key it to the
      // statement's own natural scroll position — dim as it enters from the
      // bottom of the screen, fully lit by the time it nears the top — the
      // same word-by-word easing as the pinned version above, just driven by
      // ordinary document scroll instead of a scrubbed pin range.
      const stageRect = revealStage.getBoundingClientRect();
      const vh = window.innerHeight;
      const startY = vh * 0.92;
      const endY = vh * 0.24;
      const p = Math.min(Math.max((startY - stageRect.top) / (startY - endY), 0), 1);
      lightWords(p);
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
    } else {
      reveal.classList.remove('is-pin-ready', 'is-pinned', 'is-past');
      revealPanel.style.setProperty('--slide', '0');
      if (reduceR) words.forEach(w => (w.style.opacity = '1'));
    }
    applyR();
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

// The ripple is a cursor-hover effect. On touch / no-hover devices there is no
// cursor to drive it, so skip the WebGL canvas entirely and let the crisp SVG
// metal wordmark show through (sharper on mobile than a scaled raster anyway).
const coarsePointer =
  window.matchMedia && window.matchMedia('(hover: none), (pointer: coarse)').matches;
const rippleFade = document.getElementById('ripple-fade');
const rippleMount = coarsePointer ? null : document.getElementById('ripple-root');
if (coarsePointer && rippleFade) rippleFade.style.display = 'none';
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

// footer "Back to top" — scroll to the very top of the page (href="#" so the
// generic anchor handler below skips it)
const backToTop = document.querySelector<HTMLAnchorElement>('#lv2-footer [data-backtotop]');
if (backToTop) {
  backToTop.addEventListener('click', e => {
    e.preventDefault();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  });
}

// Return nav: the footer no longer carries a fixed nav. Instead the site nav
// (#lv3-returnnav, parked off the top of the viewport) slides down once the
// footer section fills enough of the screen — i.e. the bottom of the site.
const returnNav = document.getElementById('lv3-returnnav');
const returnNavFooter = document.getElementById('lv2-footer');
if (returnNav && returnNavFooter) {
  let navTicking = false;
  const syncReturnNav = () => {
    navTicking = false;
    const rect = returnNavFooter.getBoundingClientRect();
    // start the slow fade/drift once the footer's top edge is ~60% down the
    // viewport, so the long entrance has finished settling by the bottom
    const show = rect.top < window.innerHeight * 0.6;
    returnNav.classList.toggle('is-in', show);
    returnNav.setAttribute('aria-hidden', show ? 'false' : 'true');
  };
  const onReturnNavScroll = () => {
    if (!navTicking) {
      navTicking = true;
      requestAnimationFrame(syncReturnNav);
    }
  };
  syncReturnNav();
  window.addEventListener('scroll', onReturnNavScroll, { passive: true });
  window.addEventListener('resize', onReturnNavScroll);
}

// Footer lower content block: rises up into view as ONE unit as the footer
// enters the viewport, holds once you're at the bottom, and sinks back down on
// scroll-out. It's purely a function of scroll position, so scrolling back up
// exactly reverses the entrance.
const footerBlock = document.querySelector<HTMLElement>('#lv2-footer .content');
const footerBlockSection = document.getElementById('lv2-footer');
if (footerBlock && footerBlockSection) {
  const reduceFB = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // a smaller lift on phones so it settles within the shorter viewport
  let RISE_PX = window.innerWidth <= 600 ? 44 : 80;
  window.addEventListener('resize', () => {
    RISE_PX = window.innerWidth <= 600 ? 44 : 80;
  });
  let fbTicking = false;
  const applyFooterBlock = () => {
    fbTicking = false;
    const vh = window.innerHeight;
    const top = footerBlockSection.getBoundingClientRect().top;
    // progress rises as the footer's top edge climbs the viewport...
    const byFooter = (vh - top) / (vh * 0.85);
    // ...or as you approach the absolute bottom of the page (covers viewports
    // taller than the footer, where the footer's top never reaches y=0).
    const distToBottom =
      document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
    const byBottom = 1 - distToBottom / Math.min(vh * 0.55, 380);
    const p = Math.min(Math.max(Math.max(byFooter, byBottom), 0), 1);
    const e = p * p * (3 - 2 * p); // smoothstep for a soft settle
    footerBlock.style.setProperty('--footer-rise', `${((1 - e) * RISE_PX).toFixed(1)}px`);
    footerBlock.style.setProperty('--footer-fade', e.toFixed(3));
  };
  const onFooterBlockScroll = () => {
    if (!fbTicking) {
      fbTicking = true;
      requestAnimationFrame(applyFooterBlock);
    }
  };
  if (reduceFB) {
    footerBlock.style.setProperty('--footer-rise', '0px');
    footerBlock.style.setProperty('--footer-fade', '1');
  } else {
    applyFooterBlock();
    window.addEventListener('scroll', onFooterBlockScroll, { passive: true });
    window.addEventListener('resize', onFooterBlockScroll);
  }
}

// ---- MOBILE MENU: the react-bits StaggeredMenu ----
// Only lives at <=860px. Above that it is never mounted, so desktop / tablet
// keep the existing .lv2-nav (pills) and .lv3-returnnav (slide-down) untouched.
const smMount = document.getElementById('sm-root');
if (smMount) {
  const smItems = [
    { label: 'About', ariaLabel: 'Jump to About', link: '#about' },
    { label: 'Projects', ariaLabel: 'Jump to Projects', link: '#projects' },
    { label: 'Games', ariaLabel: 'Jump to Games', link: '#games' },
    { label: 'Fun', ariaLabel: 'Jump to Fun', link: '#fun' },
    { label: 'Dashboard', ariaLabel: 'Jump to Dashboard', link: '#dashboard' },
  ];
  const smSocials = [
    { label: 'GitHub', link: 'https://github.com/Himkush1414' },
    { label: 'LinkedIn', link: 'https://www.linkedin.com/in/manik-rana-752154277' },
    { label: 'Gmail', link: 'mailto:manikrana831@gmail.com' },
  ];
  const lockScroll = (on: boolean) => {
    document.documentElement.style.overflow = on ? 'hidden' : '';
  };
  const smMQ = window.matchMedia('(max-width: 860px)');
  let smRoot: ReturnType<typeof createRoot> | null = null;
  const syncSM = () => {
    if (smMQ.matches && !smRoot) {
      smRoot = createRoot(smMount);
      smRoot.render(
        <StaggeredMenu
          position="right"
          isFixed
          items={smItems}
          socialItems={smSocials}
          displaySocials
          displayItemNumbering
          logoUrl={navLogo}
          /* deep-sea navy palette (not the react-bits purple defaults) */
          colors={['#12335C', '#0A1E38']}
          accentColor="#5C87BC"
          menuButtonColor="#EAF1FB"
          openMenuButtonColor="#EAF1FB"
          changeMenuColorOnOpen={false}
          closeOnClickAway
          onMenuOpen={() => lockScroll(true)}
          onMenuClose={() => lockScroll(false)}
        />
      );
    } else if (!smMQ.matches && smRoot) {
      smRoot.unmount();
      smRoot = null;
      lockScroll(false);
      smMount.innerHTML = '';
    }
  };
  syncSM();
  smMQ.addEventListener('change', syncSM);

  // the component only closes on the toggle / click-away — also close it when a
  // menu item or social link is chosen (delegated; survives re-mounts).
  smMount.addEventListener('click', e => {
    const link = (e.target as HTMLElement).closest('.sm-panel-item, .sm-socials-link');
    if (!link) return;
    const toggle = smMount.querySelector<HTMLButtonElement>('.sm-toggle');
    if (toggle && smMount.querySelector('.staggered-menu-wrapper[data-open]')) {
      setTimeout(() => toggle.click(), 10);
    }
  });
}

// Mobile nav: the hamburger (shown by CSS at <=860px) toggles the .nav__menu
// dropdown on both the hero nav and the footer's return nav.
document.querySelectorAll<HTMLElement>('.nav').forEach(nav => {
  const toggle = nav.querySelector<HTMLButtonElement>('.nav__toggle');
  const menu = nav.querySelector<HTMLElement>('.nav__menu');
  if (!toggle || !menu) return;
  const setOpen = (open: boolean) => {
    menu.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  };
  toggle.addEventListener('click', e => {
    e.stopPropagation();
    setOpen(!menu.classList.contains('is-open'));
  });
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setOpen(false)));
  document.addEventListener('click', e => {
    if (menu.classList.contains('is-open') && !nav.contains(e.target as Node)) setOpen(false);
  });
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') setOpen(false);
  });
  // clean state if the viewport grows back to desktop
  window.addEventListener('resize', () => {
    if (window.innerWidth > 860) setOpen(false);
  });
});

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
