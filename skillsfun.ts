// / (the main site) — bootstrap for the "Skill & Fun" section (see chat
// reply): a full copy of /lab/lv9's own hero -> "Move Next" flip
// transition -> figure section -> About -> footer, embedded here as a
// fifth toggled view (#skillsfun-root) alongside Home/Projects/Contact/
// About, wired into lv6-transition.ts the same way Projects/Contact are.
// lv9 itself is untouched — this is its own copy, scoped to #skillsfun-root
// instead of body.lv9, with its own cool-teal palette (see skillsfun.css)
// instead of lv9's warm ember one, and no standalone nav/back button
// (goTo('home') via the plain <a href="/"> below covers that, same as
// every other view's own floating nav).
import { setHeroActive, triggerFlipReveal } from './skillsfun-strip-field';

// Freshness beacon, matching the convention every other route on this site uses.
console.log('%c/ skillsfun build 2026-09-15 (Skill & Fun section, ported from lab/lv9)', 'color:#2FD1D9;font-weight:600;background:#0B1417;padding:2px 6px');

// ---------------------------------------------------------------
// "Move Next" — flips the hero's curtain strips away (see
// triggerFlipReveal in skillsfun-strip-field.ts) to reveal the figure
// section, whose own behaviour (ambient background + portrait rotation +
// inert menu) lives in skillsfun-page2.ts, dynamically imported here so
// its portrait PNGs don't load for a visit that never scrolls into this
// section and clicks this. No reverse transition back to the hero exists
// (same as lv9/lv8) — leaving the section entirely is what
// lv6-transition.ts's own Home/Projects/About links are for.
//
// .is-entering (see skillsfun.css) is added in the SAME tick as
// .is-visible, before the flip even starts — so what the strip-flip
// actually reveals is the figure section's white-blurred entering state,
// not the finished layout. Removing it (once the flip's onDone fires) is
// what triggers the veil fading + the portrait/text/topbar easing into
// place; that's a separate, slower CSS transition from the flip itself.
// ---------------------------------------------------------------
const heroEl = document.getElementById('skillsfun-hero');
const page2El = document.getElementById('skillsfun-page2');
const aboutEl = document.getElementById('skillsfun-about');
const footerEl = document.getElementById('skillsfun-footer');
const moveNextBtn = document.getElementById('skillsfun-move-next');
const entryNavEl = document.querySelector('.skillsfun-nav');
let moveNextFired = false;

moveNextBtn?.addEventListener('click', () => {
  if (moveNextFired) return;
  moveNextFired = true;

  heroEl?.classList.add('is-transitioning');
  page2El?.classList.add('is-visible', 'is-entering');
  page2El?.setAttribute('aria-hidden', 'false');
  // the light-theme section below the figure, and its own footer — only
  // reachable once "Move Next" has actually been clicked, not by
  // scrolling past the entry hero directly (see .skillsfun-about's
  // comment in skillsfun.css)
  aboutEl?.classList.add('is-visible');
  footerEl?.classList.add('is-visible');
  // the figure section has its own logo/wordmark + menu + contact top
  // bar — the entry hero's own floating nav would otherwise sit on top
  // of it
  entryNavEl?.classList.add('is-hidden');

  void import('./skillsfun-page2').then(({ startPage2 }) => startPage2());
  void import('./skillsfun-about').then(({ startAbout }) => startAbout());

  triggerFlipReveal(() => {
    heroEl?.classList.add('is-hidden');
    page2El?.classList.remove('is-entering');
    setHeroActive(false); // stop the (now invisible) strip canvas's own rAF loop
  });
});
