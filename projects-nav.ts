export {}; // forces module scope — see lv6-about-mobile-nav.ts for why.

// / (the main site) — Projects/Contact floating-nav scroll decompose/
// reassemble (logo exits left, Contact exits right, Home/About links exit
// upward, reversing on scroll back up), ported from /lab/lv7/lv7-nav.ts
// (lv7's own copy untouched).
//
// This one was a genuine gap, not just a divergence: the nav's markup
// (#lv7-logo/#lv7-nav-links/#lv7-contact-btn) and its .is-hidden CSS
// states (projects.css) were both already ported, but the scroll listener
// that actually toggles those classes never was — so the nav simply never
// hid on scroll here. Added now using the ALREADY-slowed transition
// durations from lv7's own speed fix (transform 1.1s / opacity 0.85s, see
// .lv7-nav__logo/.lv7-nav__links/.lv7-nav__contact in projects.css) rather
// than lv7's original faster timing and then re-slowing it here too.
//
// Scoping: Home and Projects/Contact share this one document (unlike lv7,
// a standalone page) — #proj-root is toggled .is-active by
// lv6-transition.ts exactly when Projects/Contact is showing (same class
// projects-cursor-trail.ts already keys off of). apply() below no-ops
// while it's inactive, and a MutationObserver re-runs it the instant
// #proj-root's class changes — needed because lv6-transition.ts resets
// scroll to 0 in the very same call that activates the view, which won't
// itself fire a 'scroll' event if the page was already at y=0, so without
// this the nav could stay stuck in a stale hidden state from a previous
// visit to this view until the user scrolled again.
const THRESHOLD = 48; // px of scroll before the nav starts decomposing — same as lv7

const projRoot = document.getElementById('proj-root');
const logo = document.getElementById('lv7-logo');
const links = document.getElementById('lv7-nav-links');
const contact = document.getElementById('lv7-contact-btn');

if (projRoot && logo && links && contact) {
  let hidden = false;
  let ticking = false;

  const apply = () => {
    ticking = false;
    if (!projRoot.classList.contains('is-active')) return;
    const y = window.scrollY || document.documentElement.scrollTop;
    const shouldHide = y > THRESHOLD;
    if (shouldHide === hidden) return;
    hidden = shouldHide;
    logo.classList.toggle('is-hidden', hidden);
    links.classList.toggle('is-hidden', hidden);
    contact.classList.toggle('is-hidden', hidden);
  };

  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(apply);
    }
  };

  window.addEventListener('scroll', onScroll, { passive: true });

  new MutationObserver(apply).observe(projRoot, { attributes: true, attributeFilter: ['class'] });

  apply();
}
