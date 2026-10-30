// Fluid orb — a small circular window into the hero box's liquid flow
// (hero-wave.ts), shared by the navbar orb (nav-orb.ts) and any other
// round control that wants the same wave language in its own palette.
//
// Same recipe as hero-wave.ts's shader, ported to plain JS: value noise ->
// fbm -> one pass of domain warping, displacing the palette's own
// top-to-bottom ramp, with two slanted sine waves bent by the flow and
// brighter crests along their ridges. Feature sizes are scaled so a ~42px
// circle holds two or three broad colour masses, not fine lines.
//
// Canvas 2D, not WebGL (the page already runs several WebGL contexts). The
// field is sampled at ~0.8x CSS pixels into a tiny offscreen canvas and
// drawn smoothly into the visible one, whose backing store is CSS size x
// devicePixelRatio (cap 3); the flow is all soft gradients (hero-wave.ts
// itself renders at 0.55x), so this looks the same as per-device-pixel
// and costs about a thousand samples a frame.
// The circle itself is cut by its host's CSS border-radius + overflow:
// hidden, so the edge stays crisp: nothing here fades or blurs a boundary.
//
// Hover (fine pointers only, never touch) and :focus-visible excite it:
// the flow speeds up ~1.8x, a swell rises toward the pointer, a lighter
// tint of the palette follows it, and the host scales up (and, with
// `magnet`, drifts toward the pointer) via transform — all lerped, easing
// back over ~600ms. The loop only runs while the host is on screen and the
// tab is visible; prefers-reduced-motion gets one still frame and no hover.
import { canvasPixelRatio } from './tall-touch';

type RGB = [number, number, number];

export interface FluidOrbOptions {
  /** four ramp stops, dark -> light, as 0..255 RGB */
  stops: [RGB, RGB, RGB, RGB];
  /** where stops 1 and 2 sit on the 0..1 ramp */
  mid: [number, number];
  /** colour of the pointer-following highlight */
  highlight: RGB;
  /** host scale at full excitement */
  scale?: number;
  /** max px the host drifts toward the pointer (0 = none) */
  magnet?: number;
  /** px around the host that still counts as hovering */
  hoverPad?: number;
}

// ---- noise, as in hero-wave.ts's FRAG ----
// Same hash, but evaluated once into a 256x256 lattice (wrapping), so each
// noise() is four table reads instead of four hashes.
const fract = (v: number) => v - Math.floor(v);
function hash(x: number, y: number) {
  let px = fract(x * 123.34);
  let py = fract(y * 456.21);
  const d = px * (px + 45.32) + py * (py + 45.32);
  px += d;
  py += d;
  return fract(px * py);
}
const LATTICE = new Float32Array(256 * 256);
for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) LATTICE[y * 256 + x] = hash(x, y);
function noise(x: number, y: number) {
  const fx0 = Math.floor(x);
  const fy0 = Math.floor(y);
  const fx = x - fx0;
  const fy = y - fy0;
  const ix = fx0 & 255;
  const iy = fy0 & 255;
  const ix1 = (ix + 1) & 255;
  const row0 = iy << 8;
  const row1 = ((iy + 1) & 255) << 8;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = LATTICE[row0 + ix];
  const b = LATTICE[row0 + ix1];
  const c = LATTICE[row1 + ix];
  const d = LATTICE[row1 + ix1];
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
function fbm(x: number, y: number, octaves = 3) {
  let v = 0;
  let a = 0.5;
  for (let i = 0; i < octaves; i++) {
    v += a * noise(x, y);
    const nx = 0.8 * x - 0.6 * y;
    const ny = 0.6 * x + 0.8 * y;
    x = nx * 2.03 + 7.1;
    y = ny * 2.03 + 7.1;
    a *= 0.5;
  }
  return v;
}
const smooth = (e0: number, e1: number, v: number) => {
  const k = Math.min(1, Math.max(0, (v - e0) / (e1 - e0)));
  return k * k * (3 - 2 * k);
};

interface Pointer {
  x: number;
  y: number;
  mouse: boolean;
}

// one shared listener for every orb on the page: last fine-pointer position
const pointer: Pointer = { x: -1e4, y: -1e4, mouse: false };
let pointerBound = false;
function bindPointer() {
  if (pointerBound) return;
  pointerBound = true;
  const track = (e: PointerEvent) => {
    pointer.mouse = e.pointerType === 'mouse' || e.pointerType === 'pen';
    pointer.x = e.clientX;
    pointer.y = e.clientY;
  };
  window.addEventListener('pointermove', track, { passive: true });
  window.addEventListener('pointerdown', track, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => {
    pointer.x = pointer.y = -1e4;
  });
}

export function startFluidOrb(host: HTMLElement, canvas: HTMLCanvasElement, opts: FluidOrbOptions) {
  const ctx = canvas.getContext('2d');
  const field = document.createElement('canvas');
  const fctx = field.getContext('2d');
  if (!ctx || !fctx) return;

  const [C0, C1, C2, C3] = opts.stops.map(c => c.map(v => v / 255) as RGB);
  const [m1, m2] = opts.mid;
  const HL = opts.highlight.map(v => v / 255) as RGB;
  const maxScale = opts.scale ?? 1.08;
  const magnet = opts.magnet ?? 0;
  const pad = opts.hoverPad ?? 12;

  const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  const fineMQ = window.matchMedia('(hover: hover) and (pointer: fine)');
  bindPointer();

  let w = 0; // backing store, device px
  let h = 0;
  let fw = 0; // field samples
  let fh = 0;
  let img: ImageData | null = null;
  let dpr = 0;
  let onScreen = false;
  let raf = 0;
  let last = 0;
  let t = 6;
  let ex = 0; // excitement 0..1, lerped
  let focused = false;
  // pointer in field uv (0..1, y up), lerped; starts above centre
  let pu = 0.5;
  let pv = 0.62;
  let driftX = 0;
  let driftY = 0;

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    // the host may be mid-scale; measure its untransformed size
    const cssW = canvas.offsetWidth || rect.width;
    const cssH = canvas.offsetHeight || rect.height;
    dpr = canvasPixelRatio(3);
    const pw = Math.max(1, Math.round(cssW * dpr));
    const ph = Math.max(1, Math.round(cssH * dpr));
    if (pw !== canvas.width || ph !== canvas.height) {
      canvas.width = pw;
      canvas.height = ph;
    }
    w = pw;
    h = ph;
    const sw = Math.max(8, Math.round(cssW * 0.8));
    const sh = Math.max(8, Math.round(cssH * 0.8));
    if (sw !== fw || sh !== fh) {
      fw = field.width = sw;
      fh = field.height = sh;
      img = fctx.createImageData(fw, fh);
    }
  };

  const ramp = (v: number, out: RGB) => {
    v = Math.min(1, Math.max(0, v));
    let a: RGB, b: RGB, k: number;
    if (v < m1) [a, b, k] = [C0, C1, smooth(0, m1, v)];
    else if (v < m2) [a, b, k] = [C1, C2, smooth(m1, m2, v)];
    else [a, b, k] = [C2, C3, smooth(m2, 1, v)];
    out[0] = a[0] + (b[0] - a[0]) * k;
    out[1] = a[1] + (b[1] - a[1]) * k;
    out[2] = a[2] + (b[2] - a[2]) * k;
  };

  const col: RGB = [0, 0, 0];
  const draw = () => {
    if (!img || !w) return;
    const data = img.data;
    const aspect = fw / fh;
    for (let j = 0; j < fh; j++) {
      const v = 1 - j / (fh - 1); // y up, like gl_FragCoord
      for (let i = 0; i < fw; i++) {
        const u = i / (fw - 1);
        // feature scale: the whole circle spans ~1.4 noise cells
        const px = u * aspect * 1.4;
        const py = v * 1.4;
        const qx = fbm(px, py + 0.07 * t);
        const qy = fbm(px + 5.2, py + 1.3 - 0.05 * t);
        // two octaves on the last pass: broad masses, no fine wiggles
        const f = fbm(px + 3.0 * qx + 1.7, py + 3.0 * qy + 9.2 + 0.04 * t, 2);

        // swell toward the pointer: a smooth bump, strongest under it
        const dx = (u - pu) * aspect;
        const dy = v - pv;
        const d2 = dx * dx + dy * dy;
        const swell = ex > 0.001 ? ex * Math.exp(-d2 / 0.09) : 0;

        // two or three broad slanted crests across the circle, bent by the
        // flow and lifted by the swell
        const wave = Math.sin(v * 4.6 + u * 1.8 + f * 5.0 - t * 0.55 - swell * 1.6) * 0.5 + 0.5;
        const wave2 = Math.sin(v * 2.6 - u * 2.2 + qx * 4.0 + t * 0.35) * 0.5 + 0.5;

        // flow level: the palette's own top-to-bottom ramp, displaced by
        // the flow, the waves and the swell (hero-wave.ts's `tt`)
        const base = 1 - v;
        const L =
          base * 0.95 + 0.08 + (f - 0.45) * 0.62 + (wave - 0.5) * 0.3 + (wave2 - 0.5) * 0.14 + swell * 0.3;

        // terraced into three broad masses — deep, mid, light — with soft
        // fronts, so a 42px circle reads as layers of liquid, not murk;
        // each keeps a little depth of its own
        const s1 = smooth(0.3, 0.38, L);
        const s2 = smooth(0.58, 0.66, L);
        const terr =
          (0.2 + (L - 0.2) * 0.25) * (1 - s1) +
          ((0.6 + (L - 0.5) * 0.25) * (1 - s2) + (0.9 + (L - 0.8) * 0.25) * s2) * s1;
        ramp(terr, col);

        // a soft bright crest riding each front, toward the lightest stop
        const c1 = (L - 0.38) / 0.05;
        const c2 = (L - 0.66) / 0.05;
        const rk = Math.min(1, Math.exp(-c1 * c1) * 0.45 + Math.exp(-c2 * c2) * 0.7);
        let r = col[0] + (C3[0] - col[0]) * rk;
        let g = col[1] + (C3[1] - col[1]) * rk;
        let b = col[2] + (C3[2] - col[2]) * rk;

        // soft highlight following the pointer
        if (ex > 0.001) {
          const hk = ex * 0.45 * Math.exp(-d2 / 0.035);
          r += (HL[0] - r) * hk;
          g += (HL[1] - g) * hk;
          b += (HL[2] - b) * hk;
        }

        const o = (j * fw + i) * 4;
        data[o] = r * 255;
        data[o + 1] = g * 255;
        data[o + 2] = b * 255;
        data[o + 3] = 255;
      }
    }
    fctx.putImageData(img, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    // opaque edge to edge — the CSS clip cuts the circle
    ctx.drawImage(field, 0, 0, w, h);
  };

  const applyTransform = () => {
    const s = 1 + (maxScale - 1) * ex;
    host.style.transform =
      ex > 0.001 ? `translate(${driftX.toFixed(2)}px, ${driftY.toFixed(2)}px) scale(${s.toFixed(4)})` : '';
  };

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min(now - last, 50) / 1000 : 1 / 60;
    last = now;
    // cheap catch-all for DPR changes the listeners below can miss
    if (canvasPixelRatio(3) !== dpr) resize();

    // hover zone: the host's box plus `pad` px, fine pointers only
    let target = focused ? 1 : 0;
    let inZone = false;
    let tu = 0.5;
    let tv = 0.62;
    if (fineMQ.matches && pointer.mouse) {
      const r = host.getBoundingClientRect();
      if (
        pointer.x >= r.left - pad &&
        pointer.x <= r.right + pad &&
        pointer.y >= r.top - pad &&
        pointer.y <= r.bottom + pad
      ) {
        target = 1;
        inZone = true;
        tu = Math.min(1.2, Math.max(-0.2, (pointer.x - r.left) / r.width));
        tv = Math.min(1.2, Math.max(-0.2, 1 - (pointer.y - r.top) / r.height));
      }
      // drift follows the pointer only while it is in the zone (keyboard
      // focus alone excites the orb in place)
      if (magnet && inZone) {
        const cx = r.left + r.width / 2 - driftX;
        const cy = r.top + r.height / 2 - driftY;
        const ddx = pointer.x - cx;
        const ddy = pointer.y - cy;
        const len = Math.hypot(ddx, ddy) || 1;
        const pull = Math.min(1, len / (r.width / 2 + pad));
        driftX += ((ddx / len) * magnet * pull * ex - driftX) * Math.min(1, dt * 10);
        driftY += ((ddy / len) * magnet * pull * ex - driftY) * Math.min(1, dt * 10);
      }
    }
    if (magnet && !inZone) {
      driftX += (0 - driftX) * (1 - Math.exp(-dt / 0.2));
      driftY += (0 - driftY) * (1 - Math.exp(-dt / 0.2));
    }
    // ~600ms to settle on leave, a touch quicker on the way in
    ex += (target - ex) * (1 - Math.exp(-dt / (target > ex ? 0.12 : 0.2)));
    if (Math.abs(target - ex) < 0.001) ex = target;
    pu += (tu - pu) * (1 - Math.exp(-dt / 0.09));
    pv += (tv - pv) * (1 - Math.exp(-dt / 0.09));

    t += dt * (1 + 0.8 * ex);
    draw();
    applyTransform();
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
    if (reduceMQ.matches) {
      // still frame, no hover state
      ex = 0;
      driftX = driftY = 0;
      applyTransform();
      draw();
    }
  };
  const redraw = () => {
    resize();
    if (!raf) draw();
  };

  resize();
  draw();
  canvas.classList.add('is-ready');

  host.addEventListener('focus', () => (focused = host.matches(':focus-visible')));
  host.addEventListener('blur', () => (focused = false));

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
