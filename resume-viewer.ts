// In-page resume viewer. Any link marked `data-resume` (the footers'
// "Resume" links, index.html) opens /resume.pdf in a modal over the current
// view instead of leaving the site; the modal has Download, Open in new tab
// and Close. The link's own href is /resume.pdf, so a modified click
// (ctrl/cmd/shift/middle) or a page without JS still opens the PDF directly.
// The overlay is built on first open, so the PDF isn't fetched until asked for.
import { setScrollLock } from './scroll-lock';
import './resume-viewer.css';

const PDF_URL = '/resume.pdf';
const DOWNLOAD_NAME = 'Manik_Rana_Resume.pdf';

let root: HTMLDivElement | null = null;
let lastFocus: HTMLElement | null = null;

function build(): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'resume-viewer';
  el.id = 'resume-viewer';
  el.hidden = true;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', 'resume-viewer-title');

  // Android Chrome (and some others) can't render a PDF inside an iframe;
  // show a short note with the same two actions there instead.
  const inline = (navigator as Navigator & { pdfViewerEnabled?: boolean }).pdfViewerEnabled !== false;

  el.innerHTML = `
    <div class="resume-viewer__backdrop" data-resume-close></div>
    <div class="resume-viewer__panel">
      <div class="resume-viewer__bar">
        <h2 class="resume-viewer__title" id="resume-viewer-title">Resume</h2>
        <div class="resume-viewer__actions">
          <a class="resume-viewer__btn resume-viewer__btn--solid" href="${PDF_URL}" download="${DOWNLOAD_NAME}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>
            <span>Download</span>
          </a>
          <a class="resume-viewer__btn resume-viewer__btn--ghost" href="${PDF_URL}" target="_blank" rel="noopener" aria-label="Open resume in a new tab">
            <span class="resume-viewer__long">Open in new tab</span><span class="resume-viewer__short" aria-hidden="true">New tab</span>
          </a>
          <button type="button" class="resume-viewer__close" data-resume-close aria-label="Close resume">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
      </div>
      <div class="resume-viewer__body">
        ${inline
          ? `<iframe class="resume-viewer__frame" title="Manik Rana — resume (PDF)"></iframe>`
          : `<div class="resume-viewer__fallback">
               <p>This browser can&rsquo;t show the PDF here.</p>
               <p>Use <strong>Download</strong> or <strong>Open in new tab</strong> above to view it.</p>
             </div>`}
      </div>
    </div>`;

  el.addEventListener('click', e => {
    if ((e.target as Element).closest('[data-resume-close]')) close();
  });
  el.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    // keep Tab inside the dialog
    const items = Array.from(el.querySelectorAll<HTMLElement>('a[href], button, iframe'));
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  document.body.appendChild(el);
  return el;
}

function open() {
  if (!root) root = build();
  if (!root.hidden) return;
  const frame = root.querySelector<HTMLIFrameElement>('.resume-viewer__frame');
  if (frame && !frame.src) frame.src = `${PDF_URL}#view=FitH&navpanes=0`;
  lastFocus = document.activeElement as HTMLElement | null;
  root.hidden = false;
  setScrollLock('resume-viewer', true);
  void root.offsetWidth; // commit the closed state so the open transition runs
  root.classList.add('is-open');
  root.querySelector<HTMLElement>('.resume-viewer__btn--solid')?.focus();
}

function close() {
  if (!root || root.hidden) return;
  root.classList.remove('is-open');
  root.hidden = true;
  setScrollLock('resume-viewer', false);
  lastFocus?.focus?.();
  lastFocus = null;
}

document.addEventListener('click', e => {
  const link = (e.target as Element | null)?.closest?.('a[data-resume]');
  if (!link) return;
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  open();
});
