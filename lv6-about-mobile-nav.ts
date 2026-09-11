// / (the main site) — mobile-only addition: once the About iframe's final
// "NEXT CHAPTER" panel scrolls into view on a phone-width screen, a
// hamburger icon automatically appears (no tap needed) at the top-right of
// the screen, since that panel — unlike the hero panel at the very top —
// has no nav bar of its own to open the menu from otherwise. (Filenames/
// element IDs keep the "lv6-" prefix from where this was built and
// verified — /lab/lv6/.)
//
// This never touches /about/ or /lab/lv5/ on disk — everything here is a
// same-origin runtime injection into the iframe's own live document (a
// cloned-in-spirit button using About's own existing classes so it's
// pixel-identical, plus one small inline style block for its fixed
// position), reaching in from this page's own script the same way
// lv6-transition.ts already does for the "Home" link. Desktop is
// untouched: the whole thing is gated behind the same 720px mobile
// breakpoint the rest of this mobile-specific behaviour uses, and does
// nothing at all above it.
export {};

const frame = document.getElementById('lv6-about-frame') as HTMLIFrameElement | null;
const mobileMQ = window.matchMedia('(max-width: 720px)');

if (frame) {
  let wiredDoc: Document | null = null;
  let observer: IntersectionObserver | null = null;
  let injectedBtn: HTMLElement | null = null;

  function teardown() {
    observer?.disconnect();
    observer = null;
    injectedBtn?.remove();
    injectedBtn = null;
    wiredDoc = null;
  }

  function setup() {
    const doc = frame!.contentDocument;
    const win = frame!.contentWindow;
    if (!doc || !win || doc === wiredDoc) return;
    const nextPanel = doc.querySelector('.m-panel--next');
    // About's own real hamburger, already wired by its menu.tsx (it
    // queries every .menu-trigger once at load and proxies a click on it
    // to the StaggeredMenu's internal toggle) — proxying a click onto it
    // reuses that exact, already-correct open logic instead of needing to
    // reach into the menu component's own state.
    const heroToggle = doc.getElementById('mobile-menu-toggle');
    if (!nextPanel || !heroToggle) return; // not the mobile markup (e.g. still loading) — bail, 'load' will retry

    wiredDoc = doc;

    const btn = doc.createElement('button');
    btn.type = 'button';
    // Same classes as the real hamburger, so it's rendered pixel-identical
    // (icon size/shape/colour) via About's own existing lv5.css rules —
    // only position/visibility are overridden below, inline, since there's
    // no lv5.css of our own to add a rule to.
    btn.className = 'm-nav__menu menu-trigger';
    btn.setAttribute('aria-label', 'Menu');
    btn.innerHTML = '<span></span><span></span><span></span>';
    Object.assign(btn.style, {
      position: 'fixed',
      // matches the hero nav's own hamburger position exactly (.m-nav's
      // 18px vertical padding inside .m-panel--hero's 20px side padding)
      top: '18px',
      right: '20px',
      // above ordinary page content, but below #sm-root's own z-index:25 —
      // once the menu it opens is actually open, it should read exactly
      // like the hero's own hamburger does: covered by the full-screen
      // menu panel, not floating on top of it.
      zIndex: '10',
      opacity: '0',
      visibility: 'hidden',
      transition: 'opacity 0.3s ease',
    });
    btn.addEventListener('click', () => heroToggle.click());
    doc.body.appendChild(btn);
    injectedBtn = btn;

    // Constructed via the iframe's OWN window, not the parent's — an
    // IntersectionObserver's implicit root (none given here) is the
    // viewport of whichever document it belongs to, and the target
    // (nextPanel) lives in the iframe's document, not this one.
    const IO = (win as unknown as { IntersectionObserver: typeof IntersectionObserver }).IntersectionObserver;
    const io = new IO(
      (entries: IntersectionObserverEntry[]) => {
        entries.forEach(entry => {
          btn.style.opacity = entry.isIntersecting ? '1' : '0';
          btn.style.visibility = entry.isIntersecting ? 'visible' : 'hidden';
        });
      },
      { threshold: 0.4 }
    );
    io.observe(nextPanel);
    observer = io;
  }

  function sync() {
    if (mobileMQ.matches) {
      setup();
    } else {
      teardown();
    }
  }

  // Re-run on every load, including the reload lv6-transition.ts triggers
  // each time the user leaves About — that replaces the iframe's document
  // (and with it, any element/observer set up against the old one), so the
  // old references are torn down and rebuilt fresh against the new one.
  frame.addEventListener('load', () => {
    teardown();
    sync();
  });
  if (frame.contentDocument && frame.contentDocument.readyState === 'complete') {
    sync();
  }
  // Live viewport resizing across the breakpoint — mirrors how the main
  // site's own mobile menu (main.tsx: smMQ.addEventListener('change', ...))
  // mounts/unmounts itself, rather than only ever checking once.
  mobileMQ.addEventListener('change', sync);
}
