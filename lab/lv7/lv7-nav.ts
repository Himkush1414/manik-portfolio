// /lab/lv7 — floating-nav scroll decompose/reassemble.
//
// ASSUMPTION FLAG (see chat reply): the brief's reappear trigger was
// ambiguous ("when I come at the bottom"). Implemented here as the standard
// hide-on-scroll-down / show-on-scroll-up-toward-the-top pattern — the
// natural reverse of the three exit directions — not "only at the very
// bottom of the page". Flagged explicitly in case that's wrong.
const THRESHOLD = 48; // px of scroll before the nav starts decomposing

const logo = document.getElementById('lv7-logo');
const links = document.getElementById('lv7-nav-links');
const contact = document.getElementById('lv7-contact-btn');

if (logo && links && contact) {
  let hidden = false;
  let ticking = false;

  const apply = () => {
    ticking = false;
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
  apply();
}
