// /lab/lv5 — full-screen nav menu, reusing the react-bits StaggeredMenu
// component exactly as built for /lab/lv3/'s mobile menu (StaggeredMenu.tsx
// here is an unmodified copy). Differences from the lv3 usage are entirely
// config, not code: position="left" instead of "right", mounted always
// (not gated to a <=860px media query) and styled full-screen via
// lv5.css's `#sm-root` overrides.
//
// The component owns its own open/closed state behind its own (hidden, see
// lv5.css) internal toggle button — lv5's sidebar hamburger and this
// panel's nav items don't reach into that state directly, they just
// simulate a click on that hidden button, so the exact tested open/close
// animation stays untouched.
import { createRoot } from 'react-dom/client';
import StaggeredMenu from './StaggeredMenu';

const smMount = document.getElementById('sm-root');
const contactLinks = document.getElementById('contact-links');

if (smMount) {
  // "Home" is a real link off lv5 entirely (the main site's root); the
  // other three stay in-page (`#`) since none of them are real destinations
  // yet — see the per-item click handling below for what each does instead.
  const smItems = [
    { label: 'Home', ariaLabel: 'Go to the main site', link: '/' },
    { label: 'About', ariaLabel: 'This section', link: '#' },
    { label: 'Works', ariaLabel: 'Works (coming soon)', link: '#' },
    { label: 'Contact', ariaLabel: 'Show contact links', link: '#' },
  ];

  const root = createRoot(smMount);
  root.render(
    <StaggeredMenu
      position="left"
      isFixed
      items={smItems}
      displaySocials={false}
      displayItemNumbering={false}
      colors={['#2E2B28']}
      accentColor="#F5F3EF"
      menuButtonColor="#F5F3EF"
      openMenuButtonColor="#F5F3EF"
      changeMenuColorOnOpen={false}
      closeOnClickAway={false}
    />
  );

  const closeMenu = () => {
    (document.querySelector('#sm-root .sm-toggle') as HTMLElement | null)?.click();
  };
  const hideContactLinks = () => {
    contactLinks?.classList.remove('is-open');
    contactLinks?.setAttribute('aria-hidden', 'true');
  };

  // lv5 triggers/closes this menu exclusively through its own hamburger
  // buttons (the component's own header/toggle is hidden in lv5.css) —
  // proxy a click onto the component's internal toggle so its untouched
  // open/close logic runs exactly as built. Every open (and close) starts
  // the contact panel fresh/hidden. Two such buttons exist: the desktop
  // sidebar's (#menu-toggle) and the separate mobile nav bar's
  // (#mobile-menu-toggle) — both share the same full-screen menu.
  document.querySelectorAll('.menu-trigger').forEach(btn => {
    btn.addEventListener('click', () => {
      closeMenu();
      hideContactLinks();
    });
  });

  // Home is a genuine <a href="/"> — left to navigate normally, no
  // handler needed. The other three are each handled on their own terms:
  // About is this very section (nothing to navigate to, just close),
  // Works has no destination yet (placeholder, just close), and Contact
  // reveals the social links panel in place instead of closing.
  smMount.addEventListener('click', e => {
    const item = (e.target as HTMLElement).closest('.sm-panel-item') as HTMLElement | null;
    if (!item) return;
    const index = Number(item.dataset.index);
    if (index === 1) return; // Home: real navigation, let it proceed

    e.preventDefault();
    if (index === 4) {
      const willOpen = !contactLinks?.classList.contains('is-open');
      contactLinks?.classList.toggle('is-open', willOpen);
      contactLinks?.setAttribute('aria-hidden', String(!willOpen));
      return;
    }
    hideContactLinks();
    closeMenu();
  });
}
