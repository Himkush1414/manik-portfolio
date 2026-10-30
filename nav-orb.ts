// Navbar orb — the round button right of "Skills" (both the hero nav and
// the slide-down return nav) drawn as a Siri-style orb: a few luminous
// wave ribbons flowing through a deep-navy sphere, blended additively so
// they bloom where they cross.
//
// Canvas 2D at the button's own ~42px size, so each frame is a handful of
// small path fills. The loop only runs while that orb is on screen (the
// return nav's is parked off the top of the viewport until the footer) and
// the tab is visible; prefers-reduced-motion gets one still frame.
import { canvasPixelRatio } from './tall-touch';

interface Wave {
  color: [number, number, number];
  freq: number;
  speed: number;
  amp: number;
  phase: number;
}

// Siri-style hues, deepened to sit on the site's navy (#0A1E38 / #12335C)
// next to its #5C87BC accent blue.
const WAVES: Wave[] = [
  { color: [92, 135, 188], freq: 1.0, speed: 0.9, amp: 0.78, phase: 0.0 },
  { color: [56, 196, 255], freq: 1.4, speed: -1.25, amp: 0.66, phase: 1.7 },
  { color: [148, 98, 255], freq: 1.2, speed: 1.05, amp: 0.6, phase: 3.1 },
  { color: [255, 84, 170], freq: 1.7, speed: -0.8, amp: 0.48, phase: 4.4 },
];

function drawOrb(ctx: CanvasRenderingContext2D, size: number, t: number, energy: number) {
  const r = size / 2;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, size, size);

  ctx.save();
  ctx.beginPath();
  ctx.arc(r, r, r, 0, Math.PI * 2);
  ctx.clip();

  // deep sphere
  const bg = ctx.createRadialGradient(r * 0.85, r * 0.7, r * 0.1, r, r, r);
  bg.addColorStop(0, '#12335C');
  bg.addColorStop(1, '#0A1E38');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  // soft colour glows orbiting inside the sphere, under the ribbons
  ctx.globalCompositeOperation = 'lighter';
  WAVES.forEach((w, i) => {
    const a = t * (0.35 + i * 0.12) * (i % 2 ? -1 : 1) + w.phase;
    const gx = r + Math.cos(a) * r * 0.45;
    const gy = r + Math.sin(a * 1.3) * r * 0.45;
    const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, r * 0.8);
    const [cr, cg, cb] = w.color;
    glow.addColorStop(0, `rgba(${cr},${cg},${cb},0.38)`);
    glow.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size, size);
  });

  // the wave field drifts round slowly, so the ribbons flow rather than slide
  ctx.translate(r, r);
  ctx.rotate(Math.sin(t * 0.23) * 0.5 + t * 0.08);
  ctx.globalCompositeOperation = 'lighter';

  const steps = 28;
  for (const w of WAVES) {
    // each ribbon breathes on its own slow cycle
    const amp = r * w.amp * energy * (0.65 + 0.35 * Math.sin(t * 0.7 + w.phase));
    const [cr, cg, cb] = w.color;
    const grad = ctx.createLinearGradient(-r, 0, r, 0);
    grad.addColorStop(0, `rgba(${cr},${cg},${cb},0)`);
    grad.addColorStop(0.5, `rgba(${cr},${cg},${cb},0.55)`);
    grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
    ctx.fillStyle = grad;

    // a lens between the wave and its mirror, pinched to nothing at both
    // ends (the classic Siri waveform envelope)
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const x = (u * 2 - 1) * r * 1.1;
      const env = Math.pow(1 - Math.pow(u * 2 - 1, 2), 1.6);
      const y = Math.sin(u * Math.PI * 2 * w.freq + t * w.speed + w.phase) * amp * env;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    for (let i = steps; i >= 0; i--) {
      const u = i / steps;
      const x = (u * 2 - 1) * r * 1.1;
      const env = Math.pow(1 - Math.pow(u * 2 - 1, 2), 1.6);
      const y = -Math.sin(u * Math.PI * 2 * w.freq + t * w.speed * 0.8 + w.phase + 0.9) * amp * env * 0.8;
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  // glassy finish: top-left sheen and a soft dark rim
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  const sheen = ctx.createRadialGradient(r * 0.62, r * 0.42, 0, r * 0.62, r * 0.42, r * 0.9);
  sheen.addColorStop(0, 'rgba(255,255,255,0.32)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, size, size);
  const rim = ctx.createRadialGradient(r, r, r * 0.62, r, r, r);
  rim.addColorStop(0, 'rgba(6,15,28,0)');
  rim.addColorStop(1, 'rgba(6,15,28,0.55)');
  ctx.fillStyle = rim;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();
}

function startOrb(canvas: HTMLCanvasElement, host: HTMLElement, reduceMQ: MediaQueryList) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let size = 0;
  let onScreen = false;
  let raf = 0;
  let last = 0;
  let t = 2;
  let energy = 1;
  let energyTarget = 1;

  const resize = () => {
    const css = canvas.getBoundingClientRect().width;
    const px = Math.max(1, Math.round(css * canvasPixelRatio(2)));
    if (px !== canvas.width) {
      canvas.width = canvas.height = px;
    }
    size = px;
  };

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min(now - last, 50) / 1000 : 1 / 60;
    last = now;
    t += dt;
    energy += (energyTarget - energy) * Math.min(1, dt * 6);
    drawOrb(ctx, size, t, energy);
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
    if (!run && reduceMQ.matches) drawOrb(ctx, size, t, 1);
  };

  resize();
  drawOrb(ctx, size, t, energy);
  canvas.classList.add('is-ready');

  // a little more energy while hovered / focused
  const lift = (on: boolean) => () => (energyTarget = on ? 1.3 : 1);
  host.addEventListener('pointerenter', lift(true));
  host.addEventListener('pointerleave', lift(false));
  host.addEventListener('focus', lift(true));
  host.addEventListener('blur', lift(false));

  new ResizeObserver(() => {
    resize();
    if (!raf) drawOrb(ctx, size, t, energy);
  }).observe(canvas);
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
