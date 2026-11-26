import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type MouseEvent } from 'react';
import { OrbDock } from './OrbDock';
import { prefersReducedMotion } from '../lib/scroll';

// The site's real destinations. lv6-transition.ts's document-level click
// handler turns these exact hrefs into view changes (strip transition).
export const NAV_ITEMS = [
  { label: 'Home', href: '/' },
  { label: 'Projects', href: '#projects' },
  { label: 'Skills', href: '#skills' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '#contact' },
] as const;
const ACTIVE = NAV_ITEMS.length - 1; // Contact

export function scrollToTop(e?: MouseEvent) {
  e?.preventDefault();
  window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

// Bottom-centre cluster: orb dock + nav pill. Appears once the intro is done.
export function NavCluster({ show }: { show: boolean }) {
  return (
    <div className={`ctv2-navwrap${show ? ' is-in' : ''}`}>
      {show && <OrbDock />}
      <DesktopNav />
      <MobileNav />
    </div>
  );
}

// ≥ 640px: all five items, a white chip that rests on Contact and slides to
// whichever item is hovered or focused.
function DesktopNav() {
  const listRef = useRef<HTMLUListElement>(null);
  const chipRef = useRef<HTMLSpanElement>(null);
  const [target, setTarget] = useState(ACTIVE);

  const place = useCallback((index: number) => {
    const list = listRef.current;
    const chip = chipRef.current;
    const link = list?.querySelectorAll('a')[index];
    if (!list || !chip || !link) return;
    chip.style.width = `${link.offsetWidth}px`;
    chip.style.transform = `translate3d(${link.offsetLeft}px, 0, 0)`;
  }, []);

  useLayoutEffect(() => place(target), [target, place]);
  useEffect(() => {
    const list = listRef.current;
    if (!list) return undefined;
    // re-measure once the web font is in and on resize (item widths change)
    const ro = new ResizeObserver(() => place(target));
    ro.observe(list);
    document.fonts?.ready.then(() => place(target)).catch(() => undefined);
    return () => ro.disconnect();
  }, [target, place]);

  return (
    <nav className="ctv2-nav ctv2-nav--desk" aria-label="Primary">
      <span ref={chipRef} className="ctv2-nav__chip" aria-hidden="true" />
      <ul ref={listRef} className="ctv2-nav__list" onMouseLeave={() => setTarget(ACTIVE)}>
        {NAV_ITEMS.map((item, i) => (
          <li key={item.href}>
            <a
              href={item.href}
              className={`ctv2-nav__link${i === target ? ' is-on' : ''}`}
              aria-current={i === ACTIVE ? 'page' : undefined}
              onMouseEnter={() => setTarget(i)}
              onFocus={() => setTarget(i)}
              onBlur={() => setTarget(ACTIVE)}
              onClick={i === ACTIVE ? scrollToTop : undefined}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// < 640px: "Menu ≡" + the white current-page chip; Menu opens a list upward.
function MobileNav() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <nav ref={rootRef} className={`ctv2-nav ctv2-nav--mob${open ? ' is-open' : ''}`} aria-label="Primary">
      <ul id={listId} className="ctv2-nav__menu" hidden={!open}>
        {NAV_ITEMS.map((item, i) => (
          <li key={item.href}>
            <a
              href={item.href}
              className={`ctv2-nav__mlink${i === ACTIVE ? ' is-on' : ''}`}
              aria-current={i === ACTIVE ? 'page' : undefined}
              onClick={e => {
                setOpen(false);
                if (i === ACTIVE) scrollToTop(e);
              }}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
      <div className="ctv2-nav__bar">
        <button
          ref={buttonRef}
          type="button"
          className="ctv2-nav__menu-btn"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen(o => !o)}
        >
          <span>{open ? 'Close' : 'Menu'}</span>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            {open ? (
              <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            )}
          </svg>
        </button>
        <a href="#contact" className="ctv2-nav__current" aria-current="page" onClick={scrollToTop}>
          Contact
        </a>
      </div>
    </nav>
  );
}
