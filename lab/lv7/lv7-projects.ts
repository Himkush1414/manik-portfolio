// /lab/lv7 — Projects list row interaction: hover-invert + thumbnail
// spring-in + cursor-follow "VIEW LIVE WEBSITE" pill (desktop/mouse), with a
// tap-to-expand fallback on touch (see MOBILE FLAG below — this fallback
// wasn't spec'd, it's a minimum so touch isn't left broken).
const rows = Array.from(document.querySelectorAll<HTMLElement>('.lv7-row'));
const isCoarsePointer = window.matchMedia('(hover: none), (pointer: coarse)').matches;

rows.forEach(row => {
  const pill = row.querySelector<HTMLElement>('.lv7-row__pill');

  if (isCoarsePointer) {
    // GAP FLAG: no hover-driven cursor-follow badge on touch — there is no
    // persistent pointer to follow. Tap toggles the same visual treatment
    // (inverted row + thumbnail) instead, pill centred rather than
    // cursor-tracked. This is a stand-in, not a spec'd mobile design.
    row.classList.add('lv7-row--tap');
    row.addEventListener('click', e => {
      if ((e.target as HTMLElement).closest('.lv7-row__link')) return; // let the live-site link through
      e.preventDefault();
      const willOpen = !row.classList.contains('is-active');
      rows.forEach(r => r.classList.remove('is-active'));
      if (willOpen) row.classList.add('is-active');
    });
    return;
  }

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
    // seed the pill at the actual entry point immediately, instead of
    // waiting for the first mousemove — otherwise it flashes at its CSS
    // default (row centre) for a frame before jumping to the cursor.
    positionPill(e.clientX, e.clientY);
  });
  row.addEventListener('mouseleave', () => row.classList.remove('is-active'));

  if (!pill) return;
  row.addEventListener('mousemove', e => positionPill(e.clientX, e.clientY));
});
