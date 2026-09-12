// / (the main site) — the column-wipe transition, generalised from two
// destinations (Home/About) to four: Home (this document's own default
// content, now wrapped in #home-root so it can be hidden/shown as a
// whole), Projects + Contact (ported from /lab/lv7/ as two more inline
// views under #proj-root — lv7 itself is untouched), and About (unchanged
// — still a hidden iframe, preloaded the whole time so there's nothing
// left to finish loading once the cover peels away). (Filenames/element
// IDs keep the "lv6-" prefix from where this mechanism was first built
// and verified — /lab/lv6/.)
//
// Colour rule (restated for this integration, and now applied uniformly
// across all four destinations rather than just the two Projects/Contact
// ones it was written for at lab/lv7/): the overlay always takes the
// colour of the page being LEFT, not the destination. This is a genuine
// behaviour change for the pre-existing Home<->About crossing — it used
// to colour the cover with whichever page was the DESTINATION (About's
// own brown either way you were headed) — flagged clearly in the chat
// reply rather than silently changed, since it wasn't explicitly asked
// for, but leaving two different rules active on the same site (one for
// Home<->About, another for everything touching Projects/Contact) seemed
// more likely to read as a bug than the alternative.
import { setScrollLock } from './scroll-lock';

type ViewId = 'home' | 'projects' | 'contact' | 'about';

interface Profile {
  overlay: HTMLElement;
  els: HTMLElement[];
  coverDelays: number[];
  revealDelays: number[];
  totalPlayTime: number;
}

function buildProfile(overlay: HTMLElement | null, elClass: string, stagger: number, duration: number): Profile | null {
  if (!overlay) return null;
  const els = Array.from(overlay.querySelectorAll<HTMLElement>(elClass));
  if (!els.length) return null;
  const n = els.length;
  return {
    overlay,
    els,
    coverDelays: els.map((_, i) => i * stagger),
    revealDelays: els.map((_, i) => (n - 1 - i) * stagger),
    totalPlayTime: (n - 1) * stagger + duration,
  };
}

const STAGGER = 70;
const DURATION = 420;
const HOLD = 120;

const desktopProfile = buildProfile(document.getElementById('lv6-transition'), '.lv6-transition__col', STAGGER, DURATION);
const mobileProfile = buildProfile(document.getElementById('lv6-transition-mobile'), '.lv6-transition-mobile__bar', STAGGER, DURATION);
const mobileMQ = window.matchMedia('(max-width: 720px)');

// "Colour of the page being left" for each of the four views — the exact
// same map/values lv7 itself already established (Home's own navy
// "iceberg" gradient, About's own dark warm background, Projects/Contact's
// shared light background nudged a few percent so the wipe stays visible
// even between two same-family crossings).
const LEAVE_COLOR: Record<ViewId, { solid?: string; gradient?: string }> = {
  home: { gradient: 'linear-gradient(180deg, #0A1E38 0%, #12335C 100%)' },
  about: { solid: '#3A3632' },
  projects: { solid: '#D7D4CC' },
  contact: { solid: '#D7D4CC' },
};

function applyColor(profile: Profile, view: ViewId) {
  const c = LEAVE_COLOR[view];
  profile.overlay.classList.toggle('theme-gradient', !!c.gradient);
  if (c.gradient) {
    profile.overlay.style.setProperty('--tgrad', c.gradient);
  } else if (c.solid) {
    profile.overlay.style.setProperty('--tcolor', c.solid);
  }
}

function setDelays(profile: Profile, delays: number[]) {
  profile.els.forEach((el, i) => {
    el.style.transitionDelay = `${delays[i]}ms`;
    el.style.transitionDuration = `${DURATION}ms`;
  });
}

function waitForEl(el: HTMLElement, fallback: number): Promise<void> {
  return new Promise(resolve => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el.removeEventListener('transitionend', onEnd);
      resolve();
    };
    const onEnd = (e: TransitionEvent) => {
      if (e.target === el && e.propertyName === 'transform') finish();
    };
    el.addEventListener('transitionend', onEnd);
    setTimeout(finish, fallback + 200);
  });
}

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

const homeRoot = document.getElementById('home-root');
const projRoot = document.getElementById('proj-root');
const projViewProjects = document.getElementById('proj-view-projects');
const projViewContact = document.getElementById('proj-view-contact');
const frameWrap = document.getElementById('lv6-about-frame-wrap');
const frame = document.getElementById('lv6-about-frame') as HTMLIFrameElement | null;

let current: ViewId = 'home';
let playing = false;
let pending: (() => void) | null = null;

function lockRootScroll(on: boolean) {
  // Only About (an iframe with its own independent scroll) needs the root
  // frozen underneath it — Home/Projects/Contact are all this document's
  // own inline content and scroll normally while active, same as lv7
  // itself only locks for its own iframe-based Home/About destinations.
  setScrollLock('about', on);
}

function showOnly(view: ViewId) {
  if (homeRoot) homeRoot.style.display = view === 'home' ? '' : 'none';
  projRoot?.classList.toggle('is-active', view === 'projects' || view === 'contact');
  projViewProjects?.classList.toggle('is-active', view === 'projects');
  projViewContact?.classList.toggle('is-active', view === 'contact');
  frameWrap?.classList.toggle('is-visible', view === 'about');
  frameWrap?.setAttribute('aria-hidden', String(view !== 'about'));
  window.scrollTo(0, 0);

  // Reload the About iframe the instant it's hidden behind the fully-
  // covered overlay, exactly as before — resets its own in-page nav state
  // so it's fresh well before it's ever shown again.
  if (view !== 'about' && current === 'about') frame?.contentWindow?.location.reload();
}

async function playTransition(leaving: ViewId, arriving: ViewId) {
  if (playing) return;
  const profile = mobileMQ.matches ? mobileProfile ?? desktopProfile : desktopProfile ?? mobileProfile;
  if (!profile) {
    showOnly(arriving);
    current = arriving;
    return;
  }
  playing = true;
  lockRootScroll(arriving === 'about' || leaving === 'about');

  const { overlay, els, coverDelays, revealDelays, totalPlayTime } = profile;
  applyColor(profile, leaving);
  overlay.setAttribute('aria-hidden', 'false');
  overlay.classList.add('is-active');

  setDelays(profile, coverDelays);
  void overlay.offsetWidth;
  overlay.classList.add('is-covering');
  await waitForEl(els[els.length - 1], totalPlayTime);

  showOnly(arriving);
  current = arriving;
  await wait(HOLD);

  setDelays(profile, revealDelays);
  void overlay.offsetWidth;
  overlay.classList.remove('is-covering');
  overlay.classList.add('is-revealing');
  await waitForEl(els[0], totalPlayTime);

  els.forEach(el => {
    el.style.transitionDelay = '0ms';
    el.style.transitionDuration = '0ms';
  });
  void overlay.offsetWidth;
  overlay.classList.remove('is-active', 'is-revealing');
  void overlay.offsetWidth;
  overlay.setAttribute('aria-hidden', 'true');
  if (arriving !== 'about') lockRootScroll(false);
  playing = false;

  if (pending) {
    const next = pending;
    pending = null;
    next();
  }
}

function goTo(target: ViewId) {
  if (target === current) {
    if (target === 'home' || target === 'projects') window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  if (playing) {
    pending = () => goTo(target);
    return;
  }
  playTransition(current, target);
}

// ---- wiring ----
// Every real "Home"/"About"/"Projects" link already on the page — the
// hero/return nav pills, the hero card, the footer link, the mobile
// hamburger menu's own items, and the ones now living on the ported
// Projects/Contact views — is a plain <a href="/">, <a href="/about"> or
// <a href="#projects">. Delegated on `document` (not attached per-element)
// since several of these are only rendered once React mounts them, well
// after this script's first run.
document.addEventListener('click', e => {
  const target = e.target as HTMLElement;

  const about = target.closest('a[href="/about"]');
  if (about) {
    e.preventDefault();
    goTo('about');
    return;
  }
  const projects = target.closest('a[href="#projects"]');
  if (projects) {
    e.preventDefault();
    goTo('projects');
    return;
  }
  // The brand/logo link (both the hero nav's own "Home" and the ported
  // Projects page's own logo, which now means "go to the real Home" in
  // this integration rather than lv7's standalone "return to Projects").
  const home = target.closest('a[href="/"]');
  if (home) {
    e.preventDefault();
    goTo('home');
  }
});

document.getElementById('lv7-contact-btn')?.addEventListener('click', e => {
  e.preventDefault();
  goTo('contact');
});
document.getElementById('lv7-footer-contact')?.addEventListener('click', e => {
  e.preventDefault();
  goTo('contact');
});

// Wire up the About iframe's own internal "Home" link the same way as
// before (delegated on the iframe's OWN document, a separate browsing
// context — this never collides with the outer document.body.contains
// listener above).
let wiredDoc: Document | null = null;
function wireAboutFrameHomeLink() {
  const doc = frame?.contentDocument;
  if (!doc || doc === wiredDoc) return;
  wiredDoc = doc;
  doc.addEventListener('click', e => {
    const a = (e.target as HTMLElement).closest('a[href="/"]');
    if (!a) return;
    e.preventDefault();
    goTo('home');
  });
}
if (frame) {
  frame.addEventListener('load', wireAboutFrameHomeLink);
  if (frame.contentDocument && frame.contentDocument.readyState === 'complete') {
    wireAboutFrameHomeLink();
  }
}

// Landing here directly at "/#projects" (e.g. the "Projects" item in
// /about/'s own mobile menu is a real cross-page link, not a same-document
// click this file's own delegation above can intercept) should land on the
// Projects view straight away rather than showing Home with an inert
// hash. Instant, no wipe — there is no prior page on screen to wipe away
// from on a fresh load.
if (location.hash === '#projects') {
  showOnly('projects');
  current = 'projects';
}
