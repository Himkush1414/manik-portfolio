// Hero effect box — slow fluid colour movement behind ShapeBlur's
// cursor-following square and the MR logo (both untouched, stacked above).
//
// A single full-box WebGL1 quad: domain-warped fbm noise displaces the box's
// own vertical gradient, so the water-like folds only ever mix the four
// colours .lv2-effect's CSS background already uses (lv2.css) — no new
// colours. That CSS gradient stays underneath as the fallback, shown as-is
// if WebGL is unavailable or the context is lost.
//
// Kept cheap: no dependencies, the backing store is drawn at a fraction of
// the box's pixel size (the effect is soft, so it upscales cleanly), and the
// loop only runs while the box is on screen and the tab is visible. With
// prefers-reduced-motion it renders one still frame instead.
import { canvasPixelRatio } from './tall-touch';

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision mediump float;
uniform vec2 uRes;
uniform float uTime;

// .lv2-effect's gradient stops: #060F1C 0%, #0A2036 38%, #103C69 74%, #205FA4 100%
const vec3 C0 = vec3(0.024, 0.059, 0.110);
const vec3 C1 = vec3(0.039, 0.125, 0.212);
const vec3 C2 = vec3(0.063, 0.235, 0.412);
const vec3 C3 = vec3(0.125, 0.373, 0.643);

vec3 ramp(float t) {
  t = clamp(t, 0.0, 1.0);
  if (t < 0.38) return mix(C0, C1, smoothstep(0.0, 0.38, t));
  if (t < 0.74) return mix(C1, C2, smoothstep(0.38, 0.74, t));
  return mix(C2, C3, smoothstep(0.74, 1.0, t));
}

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 3; i++) {
    v += a * noise(p);
    p = rot * p * 2.03 + 7.1;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = vec2(uv.x * uRes.x / uRes.y, uv.y) * 1.35;
  float t = uTime;

  // two passes of domain warping -> slow, folding, liquid motion
  vec2 q = vec2(fbm(p + vec2(0.0, 0.07 * t)), fbm(p + vec2(5.2, 1.3) - 0.05 * t));
  vec2 r = vec2(fbm(p + 3.2 * q + vec2(1.7, 9.2) + 0.09 * t),
                fbm(p + 3.2 * q + vec2(8.3, 2.8) - 0.07 * t));
  float f = fbm(p + 3.0 * r);

  // long, slanted wave bands rolling up through the box, bent by the flow
  float wave = sin(uv.y * 4.2 + uv.x * 1.6 + f * 5.5 - t * 0.45) * 0.5 + 0.5;
  float wave2 = sin(uv.y * 2.3 - uv.x * 2.1 + r.x * 4.0 + t * 0.3) * 0.5 + 0.5;

  // the CSS gradient's own top->bottom ramp, displaced by the flow
  float base = 1.0 - uv.y;
  float tt = base + (f - 0.44) * 0.85 + (wave - 0.5) * 0.24 + (wave2 - 0.5) * 0.12;
  vec3 col = ramp(tt);

  // soft brighter crests along the wave ridges, still within the palette
  // (toward its lightest stop), fading out toward the dark top
  float ridge = smoothstep(0.7, 1.0, wave) * smoothstep(0.36, 0.7, f);
  col = mix(col, C3, ridge * 0.55 * smoothstep(0.05, 0.6, base));

  // dither so the dark end never bands
  col += (hash(gl_FragCoord.xy + fract(t)) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}
`;

// Backing store as a fraction of the box's on-screen pixels — the flow is
// all soft gradients, so this is visually identical and ~3-4x cheaper.
const RENDER_SCALE = 0.55;
// Simulation speed (seconds of shader time per real second).
const SPEED = 1.1;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.warn('[hero-wave] shader compile failed:', gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

export function startHeroWave(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
  if (!gl) return;

  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;
  const prog = gl.createProgram();
  if (!prog) return;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(prog, 'uRes');
  const uTime = gl.getUniformLocation(prog, 'uTime');

  const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  let onScreen = false;
  let lost = false;
  let raf = 0;
  let last = 0;
  // shader time only advances while running, so pausing never jumps the flow
  let time = 7;

  const resize = () => {
    const r = canvas.getBoundingClientRect();
    const k = canvasPixelRatio(2) * RENDER_SCALE;
    const w = Math.max(1, Math.round(r.width * k));
    const h = Math.max(1, Math.round(r.height * k));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  };

  const draw = () => {
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, time);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    canvas.classList.add('is-ready');
  };

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    // clamp the step so a long frame (tab switch, GC) doesn't lurch the flow
    const dt = last ? Math.min(now - last, 50) : 16;
    last = now;
    time += (dt / 1000) * SPEED;
    draw();
  };

  const shouldRun = () => onScreen && !lost && !document.hidden && !reduceMQ.matches;
  const sync = () => {
    if (shouldRun()) {
      if (!raf) {
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    } else {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      // reduced motion: one still frame of the flow instead of the loop
      if (!lost && onScreen && reduceMQ.matches) draw();
    }
  };

  resize();
  draw();

  new ResizeObserver(() => {
    resize();
    if (!raf && !lost) draw();
  }).observe(canvas);
  new IntersectionObserver(entries => {
    onScreen = entries[entries.length - 1].isIntersecting;
    sync();
  }).observe(canvas);
  document.addEventListener('visibilitychange', sync);
  reduceMQ.addEventListener('change', sync);

  // a lost context just hands the box back to its CSS gradient
  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    lost = true;
    canvas.classList.remove('is-ready');
    sync();
  });
}
