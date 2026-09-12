export {}; // forces module scope — see lv6-about-mobile-nav.ts / projects-cursor-trail.ts for why.

// / (the main site) — Projects row interaction, ported from
// /lab/lv7/lv7-projects.ts (lv7's own copy untouched) with ONE deliberate
// change: lv7 falls back to tap-to-expand on touch; this integration
// instead disables the whole hover/expand/cursor-follow-pill layer
// outright on coarse pointers and lets projects.css show every row's
// info (year/category, name, thumbnail) directly and statically instead
// — no interaction needed, nothing to fall back to.
const rows = Array.from(document.querySelectorAll<HTMLElement>('.lv7-row'));
const isCoarsePointer = window.matchMedia('(hover: none), (pointer: coarse)').matches;

if (!isCoarsePointer) {
  rows.forEach(row => {
    const pill = row.querySelector<HTMLElement>('.lv7-row__pill');

    const positionPill = (clientX: number, clientY: number) => {
      if (!pill) return;
      const rect = row.getBoundingClientRect();
      const pw = pill.offsetWidth || 110;
      const ph = pill.offsetHeight || 26;
      const x = Math.min(Math.max(clientX - rect.left, pw / 2 + 8), rect.width - pw / 2 - 8);
      const y = Math.min(Math.max(clientY - rect.top, ph / 2 + 8), rect.height - ph / 2 - 8);
      pill.style.left = `${x}px`;
      pill.style.top = `${y}px`;
      pill.style.transform = 'translate(-50%, -50%) scale(1)';
    };

    row.addEventListener('mouseenter', e => {
      row.classList.add('is-active');
      positionPill(e.clientX, e.clientY);
    });
    row.addEventListener('mouseleave', () => row.classList.remove('is-active'));

    if (!pill) return;
    row.addEventListener('mousemove', e => positionPill(e.clientX, e.clientY));
  });
}
// isCoarsePointer === true: intentionally no listeners at all — the row's
// own <a class="lv7-row__link"> already opens the live site natively on
// tap, and projects.css's mobile breakpoint shows the thumbnail/name/
// meta statically without any JS-driven state.
