// /lab/lv7 — decorative cursor-follow box: a small rounded square that
// chases the real cursor with a slight smoothing lag. No trail behind it
// (removed — this used to also draw a short fading black streak; see git
// history if that's ever wanted back).
//
// Colour: rather than detecting what's underneath (hit-testing an element,
// or maintaining a per-section colour list — brittle at every new section
// and every boundary), the canvas itself is composited with
// mix-blend-mode: difference (see .lv7-cursor-trail in lv7.css). The whole
// page only ever uses two colours, --lv7-bg (#E3E1DC) and --lv7-ink
// (#111111), always as a background/foreground pair, never mixed — so the
// square is filled with their sum, #F4F2ED (0xE3+0x11, 0xE1+0x11, 0xDC+0x11
// per channel). Because difference is `|backdrop - source|`, and
// source = bgA + bgB, that resolves to EXACTLY bgB wherever the backdrop is
// bgA, and EXACTLY bgA wherever it's bgB — automatically, per pixel, at
// full opacity — so it inverts cleanly right at every light/dark boundary
// (including a single dark character on the light background, or the
// dark inverted hover-row/CTA sections) with no JS detection needed at all.
//
// Scope: Projects + Contact only. Home/About are shown in hidden iframes
// (see lv7-transition.ts) — mouse movement over an iframe never reaches
// this document's own mousemove listener at all, so the box already can't
// track the cursor there. isScopedViewActive() below additionally resets
// hasMoved whenever neither view is active, so leaving (or returning to)
// scope never shows a stale box jumping from wherever it was last left.
const coarsePointer = window.matchMedia('(hover: none), (pointer: coarse)').matches;
const canvas = document.getElementById('lv7-cursor-trail') as HTMLCanvasElement | null;

if (canvas && !coarsePointer) {
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const SIZE = 14; // leading square, px — unchanged from before
    const RADIUS = 5; // leading square's corner radius — unchanged from before
    const EASE = 0.22; // how quickly the square catches up to the real cursor — smooth, not instant
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
      ctx!.fillStyle = FILL;
      ctx!.fill();
    }

    function frame() {
      requestAnimationFrame(frame);
      ctx!.clearRect(0, 0, canvas!.width / dpr, canvas!.height / dpr);

      if (!isScopedViewActive()) {
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
