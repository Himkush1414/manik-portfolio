// / (the main site) — one addition beyond the rest of the page: a
// staggered wipe transition for the "About" nav entry, and its reverse for
// "Home" navigation back out of it. (Filenames/element IDs keep the
// "lv6-" prefix from where this was built and verified — /lab/lv6/ — same
// as About's own "lv5"-named files keep that prefix here at /about/.)
//
// The real About page is preloaded into a hidden iframe (#lv6-about-frame,
// src set directly in index.html) for the entire time this page is open —
// so by the time a click triggers the reveal, it's already fully loaded and
// painted underneath. There is nothing left to finish loading once the
// cover peels away: no fetch delay, no flash of unstyled content, no
// layout shift. Every real "About" link (href="/about" — the pills, the
// hero card, the footer link, and the mobile hamburger menu's own item) is
// intercepted here instead of navigating — delegated on `document` rather
// than attached per-element, since the mobile menu's item is only rendered
// once React mounts it, well after this script's first run.
//
// Same-origin, so the iframe's own DOM is reachable from here too: once it
// has loaded, its internal "Home" link (About's own StaggeredMenu, present
// on both its desktop sidebar and mobile nav hamburger) is intercepted the
// same way, running the same transition in reverse — recoloured to the
// main site's own navy palette instead of About's brown — rather than
// letting it navigate the iframe itself to "/" and end up with the main
// site nested a second time inside its own page.
//
// Two entirely separate overlays exist for the wipe itself — one desktop
// (7 narrow vertical columns), one mobile (5 wide horizontal bars, CSS-swapped
// in below 720px, same breakpoint lv5/about use for their own mobile split).
// Which one plays is decided fresh each time a transition starts, from
// whichever matches the viewport at that moment.
export {};

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
  // transition-duration itself is set by setDelays(), fresh before every
  // single cover/reveal phase (including the first) — nothing to do here.
  return {
    overlay,
    els,
    // COVERING always sweeps left -> right: element 0 starts first.
    // REVEALING always sweeps right -> left: element (n-1) starts first —
    // the reverse order, not just the reverse motion — so uncovering reads
    // as a genuine mirrored continuation of the same sweep, not the same
    // wave playing twice.
    coverDelays: els.map((_, i) => i * stagger),
    revealDelays: els.map((_, i) => (n - 1 - i) * stagger),
    totalPlayTime: (n - 1) * stagger + duration,
  };
}

const STAGGER = 70; // ms between each element's own animation start
const DURATION = 420; // ms each element's own cover/reveal animation
const HOLD = 120; // ms fully covered (view already swapped) before revealing

const desktopProfile = buildProfile(document.getElementById('lv6-transition'), '.lv6-transition__col', STAGGER, DURATION);
const mobileProfile = buildProfile(document.getElementById('lv6-transition-mobile'), '.lv6-transition-mobile__bar', STAGGER, DURATION);
const mobileMQ = window.matchMedia('(max-width: 720px)');

const frameWrap = document.getElementById('lv6-about-frame-wrap');
const frame = document.getElementById('lv6-about-frame') as HTMLIFrameElement | null;

if ((desktopProfile || mobileProfile) && frameWrap && frame) {
  const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

  function setDelays(profile: Profile, delays: number[]) {
    profile.els.forEach((el, i) => {
      el.style.transitionDelay = `${delays[i]}ms`;
      // Restored every time, not just once at profile build time: cleanup
      // (below) deliberately zeroes both delay and duration afterward so
      // the snap back to idle is instant, and this is the only place that
      // ever puts the real duration back before the next cover phase.
      // Without it, every transition after the very first one would still
      // carry that leftover 0ms duration and jump instead of animate.
      el.style.transitionDuration = `${DURATION}ms`;
    });
  }

  // Waits for `el`'s own transform transition to genuinely finish (a real
  // 'transitionend', not a guessed setTimeout) — timer/paint scheduling can
  // land a handful of ms after a transition visually completes, and acting
  // on "fully covered" even slightly early flashes a hairline of whatever's
  // behind that element through it before it catches up. `el` is always
  // whichever element has the longest delay in the phase just started, i.e.
  // the last one to finish. The timeout is a safety net only, in case the
  // event is ever missed (e.g. the tab was backgrounded mid-transition).
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

  let playing = false;
  let open = false;
  // A click that arrives while the other direction's transition is still
  // finishing (e.g. "About" clicked in the last moments of the Home
  // reverse-transition) would otherwise just be silently dropped — nothing
  // re-checks it once `playing` clears. Queue it instead: at most one
  // pending action, replacing whatever was queued before, run the instant
  // the in-flight transition completes.
  let pending: (() => void) | null = null;

  // Runs one full cover -> swap -> reveal cycle on whichever overlay
  // matches the viewport right now. `theme` picks the colour (default
  // About brown, or 'theme-home' for the navy palette). `swap` runs at the
  // exact moment the screen is fully covered — invisible behind it — to
  // switch which content is showing underneath.
  async function playTransition(theme: 'about' | 'home', swap: () => void) {
    if (playing) return;
    const profile = mobileMQ.matches ? mobileProfile ?? desktopProfile : desktopProfile ?? mobileProfile;
    if (!profile) return;
    playing = true;

    const { overlay, els, coverDelays, revealDelays, totalPlayTime } = profile;
    overlay.setAttribute('aria-hidden', 'false');
    overlay.classList.add('is-active');
    overlay.classList.toggle('theme-home', theme === 'home');

    // COVERING PHASE — staggered until solid. The last element in
    // coverDelays order has the longest delay, so is always the last to
    // finish.
    setDelays(profile, coverDelays);
    void overlay.offsetWidth; // force reflow so the fresh delays apply cleanly
    overlay.classList.add('is-covering');
    await waitForEl(els[els.length - 1], totalPlayTime);

    // Fully covered — swap what's underneath while it's still completely
    // hidden, then hold a beat so the cover reads as a deliberate pause,
    // not a flicker, before revealing.
    swap();
    await wait(HOLD);

    // REVEALING PHASE — mirrors the cover: element 0 now has the longest
    // delay, so it's the last to finish instead.
    setDelays(profile, revealDelays);
    void overlay.offsetWidth;
    overlay.classList.remove('is-covering');
    overlay.classList.add('is-revealing');
    await waitForEl(els[0], totalPlayTime);

    // Snap back to the idle state instantly and simultaneously (transitions
    // off, one reflow, then remove the classes) rather than just removing
    // 'is-revealing' and letting the CSS cascade fall back to the plain
    // element rule on its own. That fallback rule isn't guaranteed to
    // already equal wherever 'is-revealing' left the element (the mobile
    // bars' idle position is off the LEFT edge, but reveal exits off the
    // RIGHT — a deliberate asymmetry, see lv6-transition.css), and with the
    // transition still switched on and the reveal's own per-element delay
    // and duration still sitting there, removing the class would otherwise
    // itself kick off a second, fully uncontrolled animation sliding every
    // element back to idle right after the real one finishes — a phantom
    // extra wipe with none of the is-active/aria-hidden bookkeeping, right
    // over whatever just got revealed. Zeroing BOTH the delay and the
    // duration matters: duration alone still respects each element's own
    // leftover delay, so instead of one simultaneous snap it plays out as a
    // staggered sequence of instant jumps over the next several hundred ms
    // — better than an animated slide, but still visibly wrong motion.
    els.forEach(el => {
      el.style.transitionDelay = '0ms';
      el.style.transitionDuration = '0ms';
    });
    void overlay.offsetWidth;
    overlay.classList.remove('is-active', 'is-revealing');
    void overlay.offsetWidth;
    overlay.setAttribute('aria-hidden', 'true');
    playing = false;

    if (pending) {
      const next = pending;
      pending = null;
      next();
    }
  }

  function openAbout() {
    if (open) return;
    if (playing) {
      pending = openAbout;
      return;
    }
    playTransition('about', () => {
      frameWrap!.classList.add('is-visible');
      frameWrap!.setAttribute('aria-hidden', 'false');
      open = true;
    });
  }

  function closeAbout() {
    if (!open) return;
    if (playing) {
      pending = closeAbout;
      return;
    }
    playTransition('home', () => {
      frameWrap!.classList.remove('is-visible');
      frameWrap!.setAttribute('aria-hidden', 'true');
      open = false;

      // The iframe is never actually navigated away, so About's own React
      // state (its StaggeredMenu left open — exactly how the user just got
      // here — any hover/contact-panel state, its desktop scroll-jack's
      // virtual scroll position) would otherwise just sit there and still
      // be however it was left the NEXT time this iframe is revealed,
      // landing the user back on the menu instead of the hero. Reloading it
      // now, the instant it's hidden behind the fully-covered columns,
      // resets all of that in one guaranteed-correct stroke — no need to
      // separately track and reset each individual piece of state — and
      // happens invisibly with a full HOLD + reveal (and however long the
      // user then spends on the main site before clicking "About" again) to
      // finish, so it's already fresh and fully loaded well before it's
      // ever needed again, same as the very first load.
      frame!.contentWindow?.location.reload();
    });
  }

  // Delegated on document (not attached per-element): the mobile hamburger
  // menu's own "About" item is a React-rendered <a href="/about"> that
  // doesn't exist in the DOM yet at this script's first run, so a one-time
  // querySelectorAll+forEach would silently miss it. Delegation catches it
  // (and anything else added later) regardless of when it's added.
  document.addEventListener('click', e => {
    const a = (e.target as HTMLElement).closest('a[href="/about"]');
    if (!a) return;
    e.preventDefault();
    openAbout();
  });

  // Wire up the About iframe's own internal "Home" link (delegated, so it
  // works the moment the listener is attached regardless of exactly when
  // About's own React tree renders that anchor). Re-runs on every load —
  // including the reload above — since a reload replaces `contentDocument`
  // with a brand new Document whose listeners start empty; `wiredDoc` just
  // guards against wiring the same document twice (both the immediate call
  // below and the 'load' event can otherwise fire for one document).
  let wiredDoc: Document | null = null;
  function wireHomeLink() {
    const doc = frame!.contentDocument;
    if (!doc || doc === wiredDoc) return;
    wiredDoc = doc;
    doc.addEventListener('click', e => {
      const a = (e.target as HTMLElement).closest('a[href="/"]');
      if (!a) return;
      e.preventDefault();
      closeAbout();
    });
  }
  frame.addEventListener('load', wireHomeLink);
  if (frame.contentDocument && frame.contentDocument.readyState === 'complete') {
    wireHomeLink();
  }
}
