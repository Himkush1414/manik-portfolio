export {}; // forces module scope — see lv6-about-mobile-nav.ts for why: without
// this, a script with no top-level import/export pollutes the global
// namespace, and lv7's own (untouched) copy of this file declares the same
// top-level names, causing a "Cannot redeclare" TS error across the two.

// / (the main site) — ported verbatim from /lab/lv7/lv7-cursor-trail.ts
// (lv7's own copy untouched), only the two scoped-view element ids changed
// to match this integration's own Projects/Contact view ids.
//
// Decorative cursor-follow trail: a small rounded square that chases the
// real cursor with a slight smoothing lag, leaving a short black streak
// behind it that fades out quickly rather than staying on screen. The
// trail is ONE continuous stroked path through a short rolling buffer of
// the square's own recent (eased) positions — round-capped/round-joined
// segments tapering width/alpha from full at the head to ~0 at the tail —
// not repeated stamped copies of the square.
//
// Scope: Projects + Contact only, desktop/mouse only. Coarse pointers
// (touch) skip this entirely — see projects-rows.ts for the matching
// "no hover/no cursor-follow at all on mobile" rule for the row list.
// Home is this document's own default content and About is a hidden
// iframe (see projects-transition.ts) — mouse movement over an iframe
// never reaches this document's own mousemove listener at all, so the
// trail already can't track the cursor there; isScopedViewActive() below
// additionally empties the point buffer whenever neither view is active,
// so leaving (or returning to) scope never shows a stale trail jumping
// from wherever it was last left.
const coarsePointer = window.matchMedia('(hover: none), (pointer: coarse)').matches;
const canvas = document.getElementById('lv7-cursor-trail') as HTMLCanvasElement | null;

if (canvas && !coarsePointer) {
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const SIZE = 14;
    const RADIUS = 5;
    const EASE = 0.22;
    const MAX_POINTS = 16;
    const TRAIL_MAX_WIDTH = 10;
    const TRAIL_MAX_ALPHA = 0.85;

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
      ctx!.fillStyle = '#111111';
      ctx!.fill();
    }

    const points: { x: number; y: number }[] = [];

    function drawTrail() {
      const n = points.length;
      if (n < 2) return;
      ctx!.lineCap = 'round';
      ctx!.lineJoin = 'round';
      for (let i = 0; i < n - 1; i++) {
        const t = (i + 1) / n;
        ctx!.beginPath();
        ctx!.moveTo(points[i].x, points[i].y);
        ctx!.lineTo(points[i + 1].x, points[i + 1].y);
        ctx!.lineWidth = TRAIL_MAX_WIDTH * t;
        ctx!.strokeStyle = `rgba(17, 17, 17, ${(TRAIL_MAX_ALPHA * t).toFixed(3)})`;
        ctx!.stroke();
      }
    }

    function frame() {
      requestAnimationFrame(frame);
      ctx!.clearRect(0, 0, canvas!.width / dpr, canvas!.height / dpr);

      if (!isScopedViewActive()) {
        points.length = 0;
        return;
      }
      if (!hasMoved) return;

      x += (targetX - x) * EASE;
      y += (targetY - y) * EASE;

      points.push({ x, y });
      if (points.length > MAX_POINTS) points.shift();

      drawTrail();
      drawRoundedSquare(x, y);
    }
    requestAnimationFrame(frame);
  }
}
