// /lab/lv7 — decorative cursor-follow trail: a small rounded square that
// chases the real cursor with a slight smoothing lag, leaving a short black
// streak behind it that fades out quickly rather than staying on screen.
//
// The trail is ONE continuous stroked path through a short rolling buffer
// of the square's own recent (eased) positions — drawn as a sequence of
// round-capped/round-joined segments whose width and alpha taper from full
// at the head down toward the tail, not as repeated stamped copies of the
// square. Point-stamping (the previous approach) left visible gaps at
// anything above a slow cursor speed, since consecutive frames' stamps
// simply didn't overlap — an explicit connected stroke through the buffer
// bridges that distance regardless of how fast the cursor moves.
//
// DEFAULT CHOSEN, FLAG BACK IF WRONG: the trail fades out shortly after
// being drawn rather than persisting — this wasn't specified either way,
// so this follows the brief's own stated default. If Manik wants it to
// stay on screen instead, that's a one-line change (raise MAX_POINTS a
// lot and stop clearing the buffer on scroll/idle).
//
// Scope: Projects + Contact only. Home/About are shown in hidden iframes
// (see lv7-transition.ts) — mouse movement over an iframe never reaches
// this document's own mousemove listener at all, so the trail already
// can't track the cursor there. isScopedViewActive() below additionally
// empties the point buffer whenever neither view is active, so leaving
// (or returning to) scope never shows a stale trail jumping from wherever
// it was last left.
const coarsePointer = window.matchMedia('(hover: none), (pointer: coarse)').matches;
const canvas = document.getElementById('lv7-cursor-trail') as HTMLCanvasElement | null;

if (canvas && !coarsePointer) {
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const SIZE = 14; // leading square, px — unchanged from before
    const RADIUS = 5; // leading square's corner radius — unchanged from before
    const EASE = 0.22; // how quickly the square catches up to the real cursor — smooth, not instant
    const MAX_POINTS = 16; // rolling buffer length — trail length/duration (moderate, ~a quarter second at 60fps)
    const TRAIL_MAX_WIDTH = 10; // stroke width right behind the head, tapering to ~0 at the tail
    const TRAIL_MAX_ALPHA = 0.85; // stroke opacity right behind the head, tapering to ~0 at the tail

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

    const projectsView = document.getElementById('lv7-view-projects');
    const contactView = document.getElementById('lv7-view-contact');
    const isScopedViewActive = () =>
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

    // Drawn as one continuous line through the buffer, not separate shapes
    // — each segment is its own stroke() call only because canvas has no
    // single call for a path with per-point width/alpha, but round caps on
    // every segment plus their endpoints meeting exactly make the seams
    // invisible, so it reads as one tapered strip, not discrete pieces.
    function drawTrail() {
      const n = points.length;
      if (n < 2) return;
      ctx!.lineCap = 'round';
      ctx!.lineJoin = 'round';
      for (let i = 0; i < n - 1; i++) {
        const t = (i + 1) / n; // 0 near the tail -> 1 at the segment nearest the head
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
