import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { CONTACT_CONFIG as C, COPY } from '../../contact-v2/config';
import { FitText } from '../../contact-v2/components/FitText';
import { LiveClock } from '../../contact-v2/components/LiveClock';
import { ArrowUpRight } from '../../contact-v2/hero/BookCard';
import { monthName, yearNow } from '../../contact-v2/lib/time';
import { scrollToTop } from '../../contact-v2/nav/FloatingNav';
import { GAMES_NAV } from '../games.config';

// The Contact footer's look (same classes, copy, columns and wordmark), rebuilt for this page: the
// Contact footer itself is tied to its view (in-page #contact links and the project dialog that moves
// index.html's form), so it is not reused as-is. "Start a project" goes to the Contact view instead.
// This page has no floating nav, so the footer needs no room for one: the legal row sits above the
// big name and the name is the last thing on the page (games.css).
export function GamesFooter() {
  const [copied, setCopied] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(C.email);
    } catch {
      return;
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1800);
  };
  const toTop = (e: MouseEvent) => scrollToTop(e);
  const available = C.slotsLeft > 0;

  return (
    <footer className="ctv2-foot ctv2-grain gm-foot">
      <div className="ctv2-foot__top">
        <h2 className="ctv2-foot__statement">{COPY.footerStatement}</h2>
        <div className="ctv2-foot__mailrow">
          <a className="ctv2-foot__email" href={`mailto:${C.email}`}>
            {C.email}
          </a>
          <button type="button" className={`ctv2-copy${copied ? ' is-done' : ''}`} onClick={onCopy} aria-label="Copy email address">
            {copied ? (
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <rect x="8.5" y="8.5" width="11" height="11" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" fill="none" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            )}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <span className="ctv2-sr" role="status" aria-live="polite">
            {copied ? 'Email address copied' : ''}
          </span>
        </div>
        <div className="ctv2-foot__actions">
          <a className="ctv2-btn" href={C.booking}>
            Book a call <ArrowUpRight className="ctv2-btn__arrow" />
          </a>
          <a className="ctv2-btn ctv2-btn--ghost" href="/#contact">
            Start a project
          </a>
        </div>
      </div>

      <div className="ctv2-foot__cols">
        <nav className="ctv2-foot__col" aria-label="Footer">
          <p className="ctv2-foot__label">Navigate</p>
          <ul>
            {GAMES_NAV.map(item => (
              <li key={item.href}>
                <a className="ctv2-foot__link" href={item.href} onClick={item.href === '/games' ? toTop : undefined}>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ctv2-foot__col">
          <p className="ctv2-foot__label">Elsewhere</p>
          <ul>
            <li>
              <a className="ctv2-foot__link" href={C.linkedin} target="_blank" rel="noopener noreferrer">
                LinkedIn <ArrowUpRight className="ctv2-foot__ext" />
              </a>
            </li>
            <li>
              <a className="ctv2-foot__link" href={C.github} target="_blank" rel="noopener noreferrer">
                GitHub <ArrowUpRight className="ctv2-foot__ext" />
              </a>
            </li>
          </ul>
        </div>
        <div className="ctv2-foot__col">
          <p className="ctv2-foot__label">Status</p>
          <p className="ctv2-foot__status">
            <span className={`ctv2-dot${available ? '' : ' is-off'}`} aria-hidden="true" />
            {available ? `Available for new projects, ${monthName('long')}` : `Fully booked for ${monthName('long')}`}
          </p>
        </div>
        <div className="ctv2-foot__col">
          <p className="ctv2-foot__label">Local time</p>
          <p className="ctv2-foot__time">
            <LiveClock className="ctv2-clock" />
            <span className="ctv2-foot__tz">IST, India</span>
          </p>
        </div>
      </div>

      <div className="ctv2-foot__legal">
        <p>
          &copy; {yearNow()} {C.name}
        </p>
        <div className="ctv2-foot__legal-links">
          <a href="/#privacy">Privacy</a>
          <a href="/#terms">Terms</a>
        </div>
        <a className="ctv2-foot__top-link" href="#top" onClick={toTop}>
          Back to top <span aria-hidden="true">↑</span>
        </a>
      </div>
      <div className="ctv2-foot__mark" aria-hidden="true">
        <FitText text={C.heroWord} className="ctv2-foot__mark-fit" />
      </div>
    </footer>
  );
}
