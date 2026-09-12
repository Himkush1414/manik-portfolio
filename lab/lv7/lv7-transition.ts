// /lab/lv7 — column-strip transition, generalised from lab/lv6's
// About<->Home wipe (lv6-transition.ts) to four destinations living on one
// page: Projects and Contact (both inline views in this document) plus Home
// and About (both preloaded in hidden iframes, exactly lv6's own pattern for
// About — reused here rather than edited, per scope: lv6 itself is untouched).
//
// Colour rule (spec'd fresh for lv7, NOT the same rule lv6 uses): the
// overlay always takes the colour of the page being LEFT, not the
// destination. Since there are now more than two colours, the two lv6
// "theme" classes are replaced with a single CSS custom property the JS
// sets right before every play — see lv7-transition.css.
import { setScrollLock } from './scroll-lock';

type ViewId = 'projects' | 'contact' | 'home' | 'about';

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

const desktopProfile = buildProfile(document.getElementById('lv7-transition'), '.lv7-transition__col', STAGGER, DURATION);
const mobileProfile = buildProfile(document.getElementById('lv7-transition-mobile'), '.lv7-transition-mobile__bar', STAGGER, DURATION);
const mobileMQ = window.matchMedia('(max-width: 720px)');

// "Colour of the page being left" for each of the four views. Home's is the
// site's own established navy "iceberg" gradient (the exact two tones its
// mobile StaggeredMenu / lv6's own theme-home already use); About's is its
// own dark warm background. Projects/Contact share the same page family —
// per spec that's "#E3E1DC both ways" — but using the EXACT body colour
// made the covering bar invisible against the identical page behind it
// (fix #9: this was the actual cause of the Contact crossing looking like
// an abrupt cut instead of a wipe). A few percent darker keeps it visibly
// the same warm off-white family while making the sweep legible.
const LEAVE_COLOR: Record<ViewId, { solid?: string; gradient?: string }> = {
  projects: { solid: '#D7D4CC' },
  contact: { solid: '#D7D4CC' },
  about: { solid: '#3A3632' },
  home: { gradient: 'linear-gradient(180deg, #0A1E38 0%, #12335C 100%)' },
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

const viewProjects = document.getElementById('lv7-view-projects');
const viewContact = document.getElementById('lv7-view-contact');
const frameHomeWrap = document.getElementById('lv7-frame-home');
const frameHomeEl = document.getElementById('lv7-frame-home-el') as HTMLIFrameElement | null;
const frameAboutWrap = document.getElementById('lv7-frame-about');
const frameAboutEl = document.getElementById('lv7-frame-about-el') as HTMLIFrameElement | null;

let current: ViewId = 'projects';
let playing = false;
let pending: (() => void) | null = null;

function lockRootScroll(on: boolean) {
  setScrollLock('lv7-transition', on);
}

function showOnly(view: ViewId) {
  viewProjects?.classList.toggle('is-active', view === 'projects');
  viewContact?.setAttribute('aria-hidden', String(view !== 'contact'));
  if (viewContact) viewContact.classList.toggle('is-active', view === 'contact');
  frameHomeWrap?.classList.toggle('is-visible', view === 'home');
  frameHomeWrap?.setAttribute('aria-hidden', String(view !== 'home'));
  frameAboutWrap?.classList.toggle('is-visible', view === 'about');
  frameAboutWrap?.setAttribute('aria-hidden', String(view !== 'about'));
  window.scrollTo(0, 0);

  // Reload whichever iframe we just left, the instant it's hidden behind
  // the fully-covered overlay (mirrors lv6's own About-frame reload): resets
  // any in-page nav state (their own StaggeredMenu, their own About<->Home
  // toggle) so it's fresh well before it's ever shown again.
  if (view !== 'home' && current === 'home') frameHomeEl?.contentWindow?.location.reload();
  if (view !== 'about' && current === 'about') frameAboutEl?.contentWindow?.location.reload();
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
  const needsLock = arriving !== 'projects' || leaving !== 'projects';
  if (needsLock) lockRootScroll(true);

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
  if (arriving === 'projects') lockRootScroll(false);
  playing = false;

  if (pending) {
    const next = pending;
    pending = null;
    next();
  }
}

function goTo(target: ViewId) {
  if (target === current) {
    if (target === 'projects') window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  if (playing) {
    pending = () => goTo(target);
    return;
  }
  playTransition(current, target);
}

// ---- wiring ----
document.getElementById('lv7-logo')?.addEventListener('click', e => {
  e.preventDefault();
  goTo('projects');
});

document.querySelectorAll<HTMLAnchorElement>('a[data-lv7-nav="home"]').forEach(a =>
  a.addEventListener('click', e => {
    e.preventDefault();
    goTo('home');
  })
);
document.querySelectorAll<HTMLAnchorElement>('a[data-lv7-nav="about"]').forEach(a =>
  a.addEventListener('click', e => {
    e.preventDefault();
    goTo('about');
  })
);

document.getElementById('lv7-contact-btn')?.addEventListener('click', e => {
  e.preventDefault();
  goTo('contact');
});
document.getElementById('lv7-footer-contact')?.addEventListener('click', e => {
  e.preventDefault();
  goTo('contact');
});

export { goTo };
