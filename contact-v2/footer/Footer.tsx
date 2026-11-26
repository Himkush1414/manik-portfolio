import { useEffect, useRef, useState } from 'react';
import { CONTACT_CONFIG as C, COPY } from '../config';
import { FitText } from '../components/FitText';
import { LiveClock } from '../components/LiveClock';
import { ArrowUpRight } from '../hero/BookCard';
import { NAV_ITEMS, scrollToTop } from '../nav/FloatingNav';
import { monthName, yearNow } from '../lib/time';
import { ProjectDialog, openDialog } from './ProjectDialog';

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // older browsers / insecure contexts: the textarea + execCommand route
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

// Matte near-black footer: statement + email (copy button) + actions, four
// columns, an edge-to-edge low-contrast wordmark, and the legal row. Bottom
// padding leaves room for the floating nav.
export function Footer() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onCopy = async () => {
    if (!(await copyText(C.email))) return;
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1800);
  };

  const available = C.slotsLeft > 0;

  return (
    <footer className="ctv2-foot ctv2-grain" data-ctv2-section="footer">
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
          <button type="button" className="ctv2-btn ctv2-btn--ghost" onClick={() => openDialog(dialogRef.current)}>
            Start a project
          </button>
        </div>
      </div>

      <div className="ctv2-foot__cols">
        <nav className="ctv2-foot__col" aria-label="Footer">
          <p className="ctv2-foot__label">Navigate</p>
          <ul>
            {NAV_ITEMS.map(item => (
              <li key={item.href}>
                <a className="ctv2-foot__link" href={item.href} onClick={item.href === '#contact' ? scrollToTop : undefined}>
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

      <div className="ctv2-foot__mark" aria-hidden="true">
        <FitText text={C.heroWord} className="ctv2-foot__mark-fit" />
      </div>

      <div className="ctv2-foot__legal">
        <p>
          &copy; {yearNow()} {C.name}
        </p>
        <div className="ctv2-foot__legal-links">
          <a href="#privacy">Privacy</a>
          <a href="#terms">Terms</a>
        </div>
        <a className="ctv2-foot__top-link" href="#contact" onClick={scrollToTop}>
          Back to top <span aria-hidden="true">↑</span>
        </a>
      </div>

      <ProjectDialog dialogRef={dialogRef} />
    </footer>
  );
}
