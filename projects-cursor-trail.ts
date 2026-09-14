export {}; // forces module scope — see lv6-about-mobile-nav.ts for why: without
// this, a script with no top-level import/export pollutes the global
// namespace, and lv7's own (untouched) copy of this file declares the same
// top-level names, causing a "Cannot redeclare" TS error across the two.

// / (the main site) — ported from /lab/lv7/lv7-cursor-trail.ts (lv7's own
// copy untouched), with the same two divergences this file already had
// before this port: the two scoped-view element ids match this
// integration's own Projects/Contact view ids, and mobileMQ additionally
// gates on actual viewport width (see below) — neither touched here.
//
// Decorative cursor-follow box: a small rounded square that chases the
// real cursor with a slight smoothing lag. No trail behind it (removed —
// this used to also draw a short fading black streak; see git history if
// that's ever wanted back).
//
// Colour: rather than detecting what's underneath (hit-testing an element,
// or maintaining a per-section colour list — brittle at every new section
// and every boundary), the canvas itself is composited with
// mix-blend-mode: difference (see .lv7-cursor-trail in projects.css). The
// whole Projects/Contact surface only ever uses two colours, --lv7-bg
// (#E3E1DC) and --lv7-ink (#111111), always as a background/foreground
// pair, never mixed — so the square is filled with their sum, #F4F2ED
// (0xE3+0x11, 0xE1+0x11, 0xDC+0x11 per channel). Because difference is
// `|backdrop - source|`, and source = bgA + bgB, that resolves to EXACTLY
// bgB wherever the backdrop is bgA, and EXACTLY bgA wherever it's bgB —
// automatically, per pixel, at full opacity — so it inverts cleanly right
// at every light/dark boundary (including a single dark character on the
// light background, or the dark inverted hover-row/CTA sections) with no
// JS detection needed at all.
//
// Scope: Projects + Contact only, desktop viewport only. Coarse pointers
// (touch) skip mounting entirely below; a live width check (mobileMQ, the
// same 720px breakpoint the rest of this integration's mobile treatment
// uses) additionally stops it drawing at mobile/narrow viewport widths
// regardless of pointer type — e.g. a touch laptop with a fine pointer
// but a narrow window, or just resizing the browser across the
// breakpoint — so "mobile" is judged by actual viewport size, not only
// by input capability. See projects-rows.ts for the matching "no hover/
// no cursor-follow at all on mobile" rule for the row list.
// Home is this document's own default content and About is a hidden
// iframe (see projects-transition.ts) — mouse movement over an iframe
// never reaches this document's own mousemove listener at all, so the
// box already can't track the cursor there; isScopedViewActive() below
// additionally resets hasMoved whenever neither view is active, so
// leaving (or returning to) scope never shows a stale box jumping from
// wherever it was last left.
const coarsePointer = window.matchMedia('(hover: none), (pointer: coarse)').matches;
const mobileMQ = window.matchMedia('(max-width: 720px)');
const canvas = document.getElementById('lv7-cursor-trail') as HTMLCanvasElement | null;

if (canvas && !coarsePointer) {
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const SIZE = 14;
    const RADIUS = 5;
    const EASE = 0.22;
    // exact difference-blend source colour — see file header for the maths
    const FILL = '#F4F2ED';

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = window.innerWidth * dpr;
      canvas!.height = window.innerHeight * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let x = targetX;
    let y = targetY;
    let hasMoved = false;

    window.addEventListener('mousemove', e => {
      targetX = e.clientX;
      targetY = e.clientY;
      hasMoved = true;
    });

    const projRoot = document.getElementById('proj-root');
    const projectsView = document.getElementById('proj-view-projects');
    const contactView = document.getElementById('proj-view-contact');
    // Requiring #proj-root itself to be active too (not just one of the
    // inner views) is deliberate belt-and-suspenders: a stray default
    // is-active on an inner view while its hidden parent isn't active is
    // exactly what leaked this trail onto Home before (fixed at the
    // source in index.html — #proj-view-projects no longer defaults to
    // is-active — but this guards against the same mistake recurring).
    const isScopedViewActive = () =>
      !!projRoot?.classList.contains('is-active') &&
      !!(projectsView?.classList.contains('is-active') || contactView?.classList.contains('is-active'));

    function drawRoundedSquare(cx: number, cy: number) {
      const half = SIZE / 2;
      const x0 = cx - half;
      const y0 = cy - half;
      ctx!.beginPath();
      ctx!.moveTo(x0 + RADIUS, y0);
      ctx!.arcTo(x0 + SIZE, y0, x0 + SIZE, y0 + SIZE, RADIUS);
      ctx!.arcTo(x0 + SIZE, y0 + SIZE, x0, y0 + SIZE, RADIUS);
      ctx!.arcTo(x0, y0 + SIZE, x0, y0, RADIUS);
      ctx!.arcTo(x0, y0, x0 + SIZE, y0, RADIUS);
      ctx!.closePath();
      ctx!.fillStyle = FILL;
      ctx!.fill();
    }

    function frame() {
      requestAnimationFrame(frame);
      ctx!.clearRect(0, 0, canvas!.width / dpr, canvas!.height / dpr);

      if (mobileMQ.matches || !isScopedViewActive()) {
        hasMoved = false;
        return;
      }
      if (!hasMoved) return;

      x += (targetX - x) * EASE;
      y += (targetY - y) * EASE;

      drawRoundedSquare(x, y);
    }
    requestAnimationFrame(frame);
  }
}
