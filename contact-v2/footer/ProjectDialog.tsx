import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { setScrollLock } from '../../scroll-lock';

// "Start a project" dialog. It re-homes the site's existing contact form
// (#lv7-contact-form, kept as static markup in index.html) instead of
// rebuilding it, so the form keeps exactly its fields, validation and the
// handler main.tsx attaches to it (reportValidity, then the "Thanks" state;
// it has no backend, as before). The node is moved in while the page is
// mounted and put back afterwards. Native <dialog>: focus is contained, Esc
// closes, the page behind is inert; a click on the backdrop closes too.
export function ProjectDialog({ dialogRef }: { dialogRef: RefObject<HTMLDialogElement> }) {
  const slotRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const slot = slotRef.current;
    const form = document.getElementById('lv7-contact-form');
    const home = form?.parentElement;
    if (!slot || !form) return undefined;
    slot.appendChild(form);
    return () => {
      home?.appendChild(form);
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    const onClose = () => setScrollLock('ctv2-dialog', false);
    dialog.addEventListener('close', onClose);
    return () => {
      dialog.removeEventListener('close', onClose);
      setScrollLock('ctv2-dialog', false);
    };
  }, [dialogRef]);

  return (
    <dialog
      ref={dialogRef}
      className="ctv2-dialog"
      aria-labelledby="ctv2-dialog-title"
      onClick={e => {
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
    >
      <div className="ctv2-dialog__inner">
        <div className="ctv2-dialog__head">
          <h2 id="ctv2-dialog-title" className="ctv2-dialog__title">
            Start a project
          </h2>
          <button type="button" className="ctv2-dialog__close" aria-label="Close" onClick={() => dialogRef.current?.close()}>
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <p className="ctv2-dialog__intro">A few lines about what you’re building and where you are now is plenty.</p>
        <div ref={slotRef} className="ctv2-dialog__form" />
      </div>
    </dialog>
  );
}

export function openDialog(dialog: HTMLDialogElement | null) {
  if (!dialog || dialog.open) return;
  setScrollLock('ctv2-dialog', true);
  dialog.showModal();
}
