// Navbar orb — the round Contact button right of "Skills" (both the hero
// nav and the slide-down return nav): slow liquid wave bands flowing
// through a deep-blue circle, in the hero effect box's own four blues
// (lv2.css .lv2-effect / hero-wave.ts) plus faint white highlights.
//
// Crisp edge: the canvas backing store is its CSS size x devicePixelRatio
// (capped at 3, re-measured on resize and DPR change) and every frame fills
// the whole rectangle opaquely — the circle itself is cut by the button's
// CSS border-radius + overflow: hidden (lv2.css), so there is exactly one
// clip and nothing on the boundary is faded, masked or blurred.
//
// The loop only runs while that orb is on screen (the return nav's is
// parked off the top of the viewport until the footer) and the tab is
// visible; prefers-reduced-motion gets one still frame.
import { canvasPixelRatio } from './tall-touch';

// .lv2-effect's gradient stops (dark -> light)
const BLUE = ['#060F1C', '#0A2036', '#103C69', '#205FA4'];
const BLUE_RGB: [number, number, number][] = [
  [6, 15, 28],
  [10, 32, 54],
  [16, 60, 105],
  [32, 95, 164]
];

interface Band {
  level: number; // resting surface height, 0 top .. 1 bottom
  color: number; // index into BLUE_RGB
  alpha: number;
  amp: number; // fraction of height
  k1: number; // wave counts across the orb
  k2: number;
  s1: number; // rad/s
  s2: number;
  phase: number;
}

// back to front: each band is a sheet of liquid below a two-sine surface,
// drifting at its own speed; stacked alphas lighten towards the bottom
const BANDS: Band[] = [
  { level: 0.34, color: 2, alpha: 0.8, amp: 0.09, k1: 0.8, k2: 1.6, s1: 0.5, s2: -0.3, phase: 0.0 },
  { level: 0.52, color: 3, alpha: 0.45, amp: 0.085, k1: 1.1, k2: 2.0, s1: -0.38, s2: 0.26, phase: 2.1 },
  { level: 0.7, color: 3, alpha: 0.5, amp: 0.07, k1: 1.4, k2: 2.5, s1: 0.3, s2: -0.44, phase: 4.2 }
];

const rgba = (i: number, a: number) => {
  const [r, g, b] = BLUE_RGB[i];
  return `rgba(${r},${g},${b},${a})`;
};

function drawOrb(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, energy: number) {
  if (!w || !h) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';

  // deep base, opaque edge to edge
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, BLUE[1]);
  bg.addColorStop(0.5, BLUE[1]);
  bg.addColorStop(1, BLUE[2]);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // the wave field sways gently around the centre, so the bands flow
  // rather than slide sideways
  const cx = w / 2;
  const cy = h / 2;
  ctx.translate(cx, cy);
  ctx.rotate(Math.sin(t * 0.21) * 0.22 - 0.12);
  ctx.translate(-cx, -cy);

  const steps = 36;
  const x0 = -w * 0.25;
  const x1 = w * 1.25;
  const surface = (b: Band, x: number) => {
    const u = x / w;
    const amp = b.amp * h * energy;
    return (
      h * (b.level + 0.025 * Math.sin(t * 0.37 + b.phase)) +
      amp * Math.sin(u * Math.PI * 2 * b.k1 + t * b.s1 + b.phase) +
      amp * 0.45 * Math.sin(u * Math.PI * 2 * b.k2 + t * b.s2 + b.phase * 1.7)
    );
  };

  for (const b of BANDS) {
    ctx.beginPath();
    ctx.moveTo(x0, h * 1.4);
    for (let i = 0; i <= steps; i++) {
      const x = x0 + ((x1 - x0) * i) / steps;
      ctx.lineTo(x, surface(b, x));
    }
    ctx.lineTo(x1, h * 1.4);
    ctx.closePath();
    // each sheet is lit along its surface and deepens below it
    const top = h * (b.level - b.amp);
    const fill = ctx.createLinearGradient(0, top, 0, h);
    fill.addColorStop(0, rgba(b.color, b.alpha));
    fill.addColorStop(1, rgba(b.color - 1, b.alpha * 0.6));
    ctx.fillStyle = fill;
    ctx.fill();

    // a luminous crest: a wide additive blue glow with a fine white core
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const x = x0 + ((x1 - x0) * i) / steps;
      const y = surface(b, x);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(3, 0.55);
    ctx.lineWidth = w / 22;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = w / 110;
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // gentle inner glow drifting slowly through the lower half — fully
  // transparent well inside the edge, so it never touches the boundary
  const r = Math.min(w, h) / 2;
  const gx = cx + Math.sin(t * 0.29) * r * 0.28;
  const gy = cy + r * 0.25 + Math.cos(t * 0.23) * r * 0.12;
  const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, r * 0.8);
  glow.addColorStop(0, rgba(3, 0.5 * energy));
  glow.addColorStop(1, rgba(3, 0));
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // soft white glint, upper left
  ctx.globalCompositeOperation = 'source-over';
  const hx = cx - r * 0.34;
  const hy = cy - r * 0.46;
  const hl = ctx.createRadialGradient(hx, hy, 0, hx, hy, r * 0.32);
  hl.addColorStop(0, 'rgba(255,255,255,0.14)');
  hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl;
  ctx.fillRect(0, 0, w, h);
}

function startOrb(canvas: HTMLCanvasElement, host: HTMLElement, reduceMQ: MediaQueryList) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let w = 0;
  let h = 0;
  let dpr = 0;
  let onScreen = false;
  let raf = 0;
  let last = 0;
  let t = 2;
  let energy = 1;
  let energyTarget = 1;

  // backing store = CSS size x DPR, both axes (the button is 40 x 41.5 CSS
  // px inside its border, not square)
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    dpr = canvasPixelRatio(3);
    const pw = Math.max(1, Math.round(rect.width * dpr));
    const ph = Math.max(1, Math.round(rect.height * dpr));
    if (pw !== canvas.width || ph !== canvas.height) {
      canvas.width = pw;
      canvas.height = ph;
    }
    w = pw;
    h = ph;
  };
  const redraw = () => {
    resize();
    if (!raf) drawOrb(ctx, w, h, t, energy);
  };

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min(now - last, 50) / 1000 : 1 / 60;
    last = now;
    // cheap catch-all for DPR changes the listeners below can miss
    if (canvasPixelRatio(3) !== dpr) resize();
    t += dt;
    energy += (energyTarget - energy) * Math.min(1, dt * 4);
    drawOrb(ctx, w, h, t, energy);
  };

  const sync = () => {
    const run = onScreen && !document.hidden && !reduceMQ.matches;
    if (run && !raf) {
      last = 0;
      raf = requestAnimationFrame(frame);
    } else if (!run && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    if (!run && reduceMQ.matches) drawOrb(ctx, w, h, t, 1);
  };

  resize();
  drawOrb(ctx, w, h, t, energy);
  canvas.classList.add('is-ready');

  // the waves rise a little while hovered / focused
  const lift = (on: boolean) => () => (energyTarget = on ? 1.35 : 1);
  host.addEventListener('pointerenter', lift(true));
  host.addEventListener('pointerleave', lift(false));
  host.addEventListener('focus', lift(true));
  host.addEventListener('blur', lift(false));

  new ResizeObserver(redraw).observe(canvas);
  // DPR changes (browser zoom, moving to another screen) don't resize the
  // element, so watch the current resolution and re-arm after each change
  const watchDpr = () => {
    matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addEventListener(
      'change',
      () => {
        redraw();
        watchDpr();
      },
      { once: true }
    );
  };
  watchDpr();
  // pinch zoom under Desktop site changes canvasPixelRatio too (tall-touch.ts)
  window.visualViewport?.addEventListener('resize', redraw);

  new IntersectionObserver(entries => {
    onScreen = entries[entries.length - 1].isIntersecting;
    sync();
  }).observe(canvas);
  document.addEventListener('visibilitychange', sync);
  reduceMQ.addEventListener('change', sync);
}

export function startNavOrbs() {
  const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  document.querySelectorAll<HTMLElement>('.nav__orb').forEach(host => {
    const canvas = host.querySelector<HTMLCanvasElement>('.nav__orb-canvas');
    if (canvas) startOrb(canvas, host, reduceMQ);
  });
}
