import { GLSL_SRGB } from '../../gl/gl'

// Fog sphere: ray-march a thick shell; warp each sample with layered sinusoidal
// turbulence and accumulate glow as brightness / distance-to-shell, so thin
// bright ribbons appear where the folded shell is crossed, dark gaps between.
export interface FogParams {
  steps: number
  iters: number
  amp: number // turbulence amplitude
  freq: number // base frequency
  mul: number // per-octave frequency multiplier
  space: number // sample-space scale (sphere radius in turbulence units)
  coreK: number // ribbon brightness
  coreEps: number // ribbon thinness (smaller = thinner)
  glowK: number
  glowEps: number
  pass: number // passthrough fog inside the shell
  div: number // turbulence falloff: amp * sin(...) / freq^div
  expo: number // tonemap exposure
  bands: number // ribbons across the height
  sigma: number // shell thickness (soft)
  jitter: number // per-pixel step jitter (0..1)
  coreDense: number // bright dense fog at the centre
}

// tuned by eye for a 64px sphere (see fog-tune.html): amplitude/frequency are
// applied in a sample space scaled by `space`, so the folds stay >= ~1.5 css px
export const FOG_DEFAULTS: FogParams = {
  steps: 20,
  iters: 4,
  amp: 0.32,
  freq: 7.5,
  mul: 2.1,
  space: 0.4, // lower turbulence frequency: no shimmer at a 64px sphere
  coreK: 0.18,
  coreEps: 0.06,
  glowK: 0.05,
  glowEps: 0.3,
  pass: 0.18,
  div: 1,
  expo: 1.7,
  bands: 5,
  sigma: 0.12,
  jitter: 0,
  coreDense: 0.7,
}

const f = (n: number) => (Number.isInteger(n) ? n.toFixed(1) : String(n))

export const fogShader = (P: FogParams) => /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uOrbit;
uniform vec2 uLean;
uniform vec4 uW;          // shape weights: sphere, cube, tetra, torus
uniform vec3 uCore;       // linear
uniform vec3 uGlow;       // linear
uniform float uSphere;    // visible sphere radius / half canvas
out vec4 o;
${GLSL_SRGB}

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

// shapes, all roughly sphere-sized (radius ~0.8)
float sdSphere(vec3 p) { return length(p) - 0.8; }
float sdCube(vec3 p) { vec3 q = abs(p) - vec3(0.52); return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - 0.1; }
float sdTetra(vec3 p) {
  p.y += 0.1;
  return (max(abs(p.x + p.z) - p.y, abs(p.x - p.z) + p.y) - 0.66) / sqrt(3.0) - 0.05;
}
float sdTorus(vec3 p) {
  p.yz *= rot(0.95);   // tilted toward the viewer so it reads as a ring, not a bar
  vec2 q = vec2(length(p.xz) - 0.58, p.y);
  return length(q) - 0.22;
}

// p = unwarped sample, q = turbulence-warped sample. The sphere uses p, so its
// silhouette is a perfect circle (turbulence only moves its ribbons); the other
// shapes use q, so they stay foggy.
float shape(vec3 p, vec3 q) {
  float ws = max(uW.x + uW.y + uW.z + uW.w, 1e-3);
  float d = uW.x * sdSphere(p);
  p = q;
  if (uW.y > 0.001) d += uW.y * sdCube(p);
  if (uW.z > 0.001) d += uW.z * sdTetra(p);
  if (uW.w > 0.001) d += uW.w * sdTorus(p);
  return d / ws;
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / (0.5 * uRes.y) / uSphere;   // 1.0 = sphere edge
  vec3 ro = vec3(0.0, 0.0, 3.0);
  // uv 1.0 = the fog's soft edge (r ~0.92); the bounding fog (1.15) ends at uv ~1.25, inside the canvas (1.385)
  vec3 rd = normalize(vec3(uv * 0.92 / 3.0, -1.0));
  ro.yz *= rot(uLean.y);  rd.yz *= rot(uLean.y);
  ro.xz *= rot(uOrbit + uLean.x);  rd.xz *= rot(uOrbit + uLean.x);

  float bR = 1.15;
  float b = dot(ro, rd);
  float h = b * b - (dot(ro, ro) - bR * bR);
  vec3 col = vec3(0.0);
  if (h > 0.0) {
    h = sqrt(h);
    float t0 = -b - h, t1 = -b + h;
    float dt = (t1 - t0) / ${f(P.steps)};
    float t = t0 + dt * ${f(P.jitter)} * hash12(gl_FragCoord.xy) + dt * 0.5 * (1.0 - ${f(P.jitter)});
    for (int i = 0; i < ${P.steps}; i++) {
      vec3 p = ro + rd * t;
      vec3 q = p * ${f(P.space)};
      float fr = ${f(P.freq)};
      for (int k = 0; k < ${P.iters}; k++) {
        q += ${f(P.amp)} * sin(q.yzx * fr + uTime) / pow(fr, ${f(P.div)});
        fr *= ${f(P.mul)};
      }
      q /= ${f(P.space)};
      float sd = shape(p, q);
      // a thick, soft shell around the (warped) shape
      float shellW = exp(-(sd * sd) / (${f(P.sigma)} * ${f(P.sigma)}));
      // turbulent latitude ribbons on it: brightness / distance to the ribbon's centre line
      float u = q.y * ${f(P.bands)} + 0.35 * sin(q.x * 3.1 + q.z * 2.3 + uTime * 0.7);
      float bd = abs(fract(u) - 0.5);
      float ribbon = ${f(P.coreK)} / (bd + ${f(P.coreEps)});
      float halo = ${f(P.glowK)} / (bd + ${f(P.glowEps)});
      // fade everything toward the bounding sphere: no hard edge, no clip
      float fade = 1.0 - smoothstep(0.78, 1.0, length(p) / bR);
      col += (uCore * ribbon + uGlow * halo) * shellW * fade * dt;
      col += uGlow * ${f(P.pass)} * smoothstep(0.06, -0.12, sd) * fade * dt;   // passthrough fog filling the gaps
      col += uCore * ${f(P.coreDense)} * exp(-dot(p, p) / 0.22) * dt;            // dense bright core
      t += dt;
    }
  }
  // lighter outer glow around the silhouette, gone well before the canvas edge
  float ru = length(uv);
  float sphereW = uW.x / max(uW.x + uW.y + uW.z + uW.w, 1e-3);   // only the sphere has a round halo
  col += uGlow * 0.11 * sphereW * exp(-max(ru - 0.86, 0.0) * 7.0) * (1.0 - smoothstep(1.18, 1.36, ru)) * smoothstep(0.55, 0.95, ru);
  float m = max(col.r, max(col.g, col.b));
  vec3 ratio = m > 1e-5 ? col / m : vec3(0.0);
  vec3 c = toSrgb(ratio * toLinear1(1.0 - exp(-m * ${f(P.expo)})));
  c += (hash12(gl_FragCoord.xy + uTime * 61.0) - 0.5) / 255.0 * step(0.004, m);
  c = clamp(c, 0.0, 1.0);
  o = vec4(c, max(c.r, max(c.g, c.b)));
}`
