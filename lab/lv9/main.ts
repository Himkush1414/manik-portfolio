// /lab/lv9 — bootstrap for this isolated route: a faithful copy of lv8's
// hero -> "Move Next" flip transition -> page 2 figure section, plus its
// own light-theme About section below page 2 (see chat reply — lv8's own
// About section is dark-themed and stays on lv8, untouched; this is a
// separate, lv9-only build). Deliberately does NOT include lv8's game or
// its pre-game flow — none of that exists here.
import { setHeroActive, triggerFlipReveal } from './lv9-strip-field';

// Freshness beacon, matching the convention every other route on this site uses.
console.log('%clab/lv9 build 2026-09-15 (isolated copy of lv8 hero+page2)', 'color:#A83421;font-weight:600;background:#15100D;padding:2px 6px');

const backBtn = document.getElementById('lv9-nav-back');
backBtn?.addEventListener('click', () => {
  if (window.history.length > 1) window.history.back();
  else window.location.href = '/';
});

// ---------------------------------------------------------------
// "Move Next" — flips the hero's curtain strips away (see
// triggerFlipReveal in lv9-strip-field.ts) to reveal page 2, whose own
// behaviour (ambient background + portrait rotation + inert menu) lives
// in page2.ts, dynamically imported here so its portrait PNGs don't load
// for a visit that never clicks this. No reverse transition back to the
// hero exists (same as lv8) — this is a one-way trip once clicked.
//
// .is-entering (see lv9.css) is added in the SAME tick as .is-visible,
// before the flip even starts — so what the strip-flip actually reveals
// is page 2's white-blurred entering state, not the finished layout.
// Removing it (once the flip's onDone fires) is what triggers the veil
// fading + the portrait/text/topbar easing into place; that's a
// separate, slower CSS transition from the flip itself.
// ---------------------------------------------------------------
const heroEl = document.getElementById('lv9-hero');
const page2El = document.getElementById('lv9-page2');
const aboutEl = document.getElementById('lv9-about');
const footerEl = document.getElementById('lv9-footer');
const moveNextBtn = document.getElementById('lv9-move-next');
const siteNavEl = document.querySelector('.lv9-nav');
let moveNextFired = false;

moveNextBtn?.addEventListener('click', () => {
  if (moveNextFired) return;
  moveNextFired = true;

  heroEl?.classList.add('is-transitioning');
  page2El?.classList.add('is-visible', 'is-entering');
  page2El?.setAttribute('aria-hidden', 'false');
  // the light-theme section below page 2, and its own footer (see chat
  // reply) — only reachable once "Move Next" has actually been clicked,
  // not by scrolling past the original hero directly (see .lv9-about's
  // comment in lv9.css)
  aboutEl?.classList.add('is-visible');
  footerEl?.classList.add('is-visible');
  // page 2 has its own logo/wordmark + menu + contact top bar — the
  // site-wide nav would otherwise sit on top of it
  siteNavEl?.classList.add('is-hidden');

  void import('./page2').then(({ startPage2 }) => startPage2());
  void import('./lv9-about').then(({ startAbout }) => startAbout());

  triggerFlipReveal(() => {
    heroEl?.classList.add('is-hidden');
    page2El?.classList.remove('is-entering');
    setHeroActive(false); // stop the (now invisible) strip canvas's own rAF loop
  });
});
