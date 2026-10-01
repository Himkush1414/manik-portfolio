// Wormhole shell shader (brief §6). One tube around the player; the shader
// scrolls with the rail position (CPU passes fract-ed phases: no float32 loss
// on 10 km levels). Variants per quality tier are compiled up front (defines
// LAYERS 1..4, ARCS) and swapped — a tier change never compiles.
// NaN rule (DEV_NOTES §8): every pow() base is clamped to [0, 1].
import { AdditiveBlending, BackSide, Color, DoubleSide, ShaderMaterial, Vector3, Vector4, type Texture } from 'three';
import { TUNNEL } from '../../../data/tunnel';

export type TunnelUniforms = ReturnType<typeof createTunnelUniforms>;

export function createTunnelUniforms(noise: Texture) {
  return {
    tNoise: { value: noise },
    uTime: { value: 0 },
    /** rail scroll phases (fract-ed on the CPU in double precision) */
    uScrollV: { value: 0 },
    uRingScroll: { value: 0 },
    /** path curvature: amp x, amp y, freq a, freq b — and the phases at the player */
    uPathA: { value: new Vector4(0, 0, 0.002, 0.0031) },
    uPathPh: { value: new Vector4(0, 0, 0, 0) },
    uSpeed: { value: 0.5 },
    uStorm: { value: 0 },
    uInfest: { value: 0 },
    uPulse: { value: 0 },
    uTwist: { value: 1 },
    uFlow: { value: 0.35 },
    uRingDensity: { value: 1 },
    uGlow: { value: 1.6 },
    uNear: { value: new Color() },
    uMid: { value: new Color() },
    uFar: { value: new Color() },
    uCore: { value: new Color() },
    uFil: { value: new Color() },
    uVein: { value: new Color() },
    /** radius scale (chamber widening set piece) */
    uRadius: { value: new Vector3(1, 0, 1) },
  };
}

const PATH_GLSL = /* glsl */ `
  uniform vec4 uPathA;
  uniform vec4 uPathPh;
  // cosmetic curvature, relative to the player's own position (0 at d = 0)
  vec2 pathOffset(float d) {
    float ox = uPathA.x * (sin(uPathPh.x + d * uPathA.z) - sin(uPathPh.x)) + uPathA.x * 0.45 * (sin(uPathPh.y + d * uPathA.w) - sin(uPathPh.y));
    float oy = uPathA.y * (cos(uPathPh.z + d * uPathA.w) - cos(uPathPh.z)) + uPathA.y * 0.4 * (sin(uPathPh.w + d * uPathA.z) - sin(uPathPh.w));
    return vec2(ox, oy);
  }
`;

const VERT = /* glsl */ `
  ${PATH_GLSL}
  uniform vec3 uRadius; // x = scale, y = widen start d, z = widen length (chamber)
  varying vec2 vUv;
  varying float vD;
  void main() {
    vec3 p = position;
    float d = -p.z;
    // chamber widening (set piece): radius grows from 1 to uRadius.x over [y, y + z]
    float w = mix(1.0, uRadius.x, smoothstep(uRadius.y, uRadius.y + max(uRadius.z, 1.0), d));
    p.xy *= w;
    p.xy += pathOffset(max(d, 0.0));
    vUv = uv;
    vD = d;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D tNoise;
  uniform float uTime, uScrollV, uRingScroll, uSpeed, uStorm, uInfest, uPulse, uTwist, uFlow, uRingDensity, uGlow;
  uniform vec3 uNear, uMid, uFar, uCore, uFil, uVein;
  varying vec2 vUv;
  varying float vD;

  float ridged(float n) { return clamp(1.0 - abs(n * 2.0 - 1.0), 0.0, 1.0); }
  // interleaved gradient noise (dither)
  float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }

  // thin iso-line thread where the noise crosses 0.5 (crisp energy strands; fbm
  // clusters around 0.5, so a plain ridged transform lit EVERYTHING)
  float thread(float n, float w) { float l = clamp(1.0 - abs(n - 0.5) * w, 0.0, 1.0); return l * l * l; }

  void main() {
    float d = max(vD, 0.0);
    float t = uTime;
    // ---- depth gradient: near -> mid -> far (dark: the threads carry the light)
    float depth = smoothstep(40.0, 620.0, d);
    vec3 col = mix(uNear, uMid, smoothstep(0.0, 260.0, d));
    col = mix(col, uFar, smoothstep(180.0, 640.0, d));

    // ---- swirl coordinates: integer repeats around (seamless), rail-locked and stretched along the flow
    float u = vUv.x * ${TUNNEL.repeatsU.toFixed(1)} + uTwist * d * 0.0012 + t * 0.006;
    float v = d / ${TUNNEL.metresPerV.toFixed(1)} + uScrollV;
    // big swirl banks (volume)
    vec4 n0 = texture2D(tNoise, vec2(u * 0.5 + t * 0.004, v * 0.5 - t * uFlow * 0.05));
    float bank = smoothstep(0.32, 0.78, n0.r);
    col *= 0.4 + bank * 1.1;
    // luminous gas in the banks: indigo near, violet deeper (depth reads as colour)
    col += mix(uMid, uFar, depth) * bank * bank * (0.45 + 0.9 * depth);
    // energy threads, patchy (mask), each layer finer + faster: parallax depth
    // threads live in patches (mask), so the wall is never a uniform web
    float mask = smoothstep(0.5, 0.78, n0.g);
    float fil = 0.0;
    vec4 n1 = texture2D(tNoise, vec2(u * 1.0 - t * 0.011, v * 1.0 - t * uFlow * 0.12));
    fil += thread(n1.g, 18.0) * (0.12 + mask);
    #if LAYERS >= 2
      vec4 n2 = texture2D(tNoise, vec2(u * 1.7 + t * 0.018, v * 1.6 - t * uFlow * 0.21));
      fil += thread(n2.b, 26.0) * 0.8 * mask;
    #endif
    #if LAYERS >= 3
      vec4 n3 = texture2D(tNoise, vec2(u * 2.6 - t * 0.027, v * 2.4 - t * uFlow * 0.34));
      fil += thread(n3.a, 34.0) * 0.55 * mask;
    #endif
    #if LAYERS >= 4
      vec4 n4 = texture2D(tNoise, vec2(u * 3.9 + t * 0.04, v * 3.7 - t * uFlow * 0.5));
      fil += thread(n4.r, 40.0) * 0.45 * mask;
    #endif
    float fade = exp(-d / 650.0);
    // the huge near walls stay calmer: the eye goes down the throat
    float near = smoothstep(10.0, 140.0, d);
    col += uFil * fil * uGlow * (0.3 + 0.7 * fade) * (0.35 + 0.65 * near);

    // ---- infestation: organic veins + Danger heartbeat
    // veins are accents in patches (iso-lines, like the threads), over faint dark organic ridges
    vec4 nv = texture2D(tNoise, vec2(u * 1.2 + 0.37, v * 0.9 + 0.21));
    float vmask = smoothstep(0.5, 0.8, nv.a);
    float vein = thread(nv.g, 12.0) * vmask * uInfest;
    col *= 1.0 - uInfest * 0.35 * smoothstep(0.55, 0.75, nv.b); // tissue ridges darken the wall
    float beat = uPulse > 0.0 ? smoothstep(0.82, 1.0, sin(t * 2.4 + d * 0.01)) * uPulse * 10.0 : 0.0;
    col += uVein * vein * (0.9 + beat * 2.5) * (0.4 + 0.6 * fade);

    #if ARCS
      // ---- storm arcs: thin flickering ridged lightning bands
      float an = texture2D(tNoise, vec2(u * 0.7 + floor(t * 9.0) * 0.137, v * 0.35)).a;
      float flick = step(0.55, fract(sin(floor(t * 13.0) * 12.9898) * 43758.5453));
      col += uFil * pow(ridged(an), 40.0) * uStorm * flick * 6.0 * fade;
    #endif

    // ---- travelling rings (rail-locked, brighter with speed)
    float rd = fract((d + uRingScroll) / ${TUNNEL.ringSpacing.toFixed(1)} * uRingDensity);
    float ring = smoothstep(0.0, 0.012, rd) * (1.0 - smoothstep(0.012, 0.045, rd));
    // rings fade in with distance: no hoop sweeping past the camera at full strength
    col += mix(uFil, uFar, 0.35) * ring * (0.25 + uSpeed * 0.9) * exp(-d / ${TUNNEL.ringFade.toFixed(1)}) * smoothstep(25.0, 140.0, d);

    // ---- vanishing-point core haze (HDR: bloom lights it)
    float core = smoothstep(${TUNNEL.coreStart.toFixed(1)}, ${TUNNEL.coreEnd.toFixed(1)}, d);
    col = mix(col, uCore * ${TUNNEL.coreHdr.toFixed(1)} * (0.8 + 0.2 * bank), core * core);

    // ---- limb darkening near the camera (the eye goes forward)
    col *= 0.35 + 0.65 * smoothstep(0.0, ${TUNNEL.limb.toFixed(1)}, d);
    col += (ign(gl_FragCoord.xy) - 0.5) / 255.0;
    gl_FragColor = vec4(max(col, 0.0), 1.0);
  }
`;

/** One material per tier; all share the SAME uniform objects. */
export function createTunnelMaterial(u: TunnelUniforms, layers: number, arcs: boolean): ShaderMaterial {
  const m = new ShaderMaterial({
    uniforms: u,
    vertexShader: VERT,
    fragmentShader: FRAG,
    defines: { LAYERS: layers, ARCS: arcs ? 1 : 0 },
    side: BackSide,
    depthWrite: true,
    fog: false,
    toneMapped: false,
  });
  m.name = `tunnel-L${layers}${arcs ? 'A' : ''}`;
  return m;
}

/** Translucent inner veil (HIGH+): additive wisps between the camera and the wall. */
export function createVeilMaterial(u: TunnelUniforms): ShaderMaterial {
  const m = new ShaderMaterial({
    uniforms: u,
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      uniform sampler2D tNoise;
      uniform float uTime, uScrollV, uFlow;
      uniform vec3 uMid, uFil;
      varying vec2 vUv;
      varying float vD;
      void main() {
        float d = max(vD, 0.0);
        float u = vUv.x * 3.0 - uTime * 0.02, v = d / 90.0 + uScrollV * 0.55 - uTime * uFlow * 0.05;
        float n = texture2D(tNoise, vec2(u, v)).g;
        float w = smoothstep(0.58, 0.86, n) * smoothstep(20.0, 90.0, d) * exp(-d / 420.0);
        gl_FragColor = vec4((uMid * 1.6 + uFil * 0.35) * w * 0.32, 1.0);
      }`,
    side: DoubleSide,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    fog: false,
    toneMapped: false,
  });
  m.name = 'tunnel-veil';
  return m;
}

/** Far core disc: HDR glow + analytic streak rays at the vanishing point. */
export function createCoreMaterial(u: TunnelUniforms, rays: number): ShaderMaterial {
  const m = new ShaderMaterial({
    uniforms: u,
    // the disc sits at the far end of the curved corridor: same path offset as the tube there
    vertexShader: /* glsl */ `${PATH_GLSL}
      varying vec2 vP;
      void main(){ vP = position.xy; vec3 p = position; p.xy += pathOffset(max(-p.z, 0.0)); gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uCore, uFar;
      varying vec2 vP;
      void main() {
        float r = length(vP) / ${TUNNEL.radius.toFixed(1)};
        float a = atan(vP.y, vP.x);
        float glow = exp(-r * r * 2.2);
        float rays = pow(clamp(abs(sin(a * ${(rays / 2).toFixed(1)} + uTime * 0.07)), 0.0, 1.0), 18.0) * exp(-r * 1.6);
        vec3 col = mix(uFar, uCore * ${TUNNEL.coreHdr.toFixed(1)}, clamp(glow + rays * 0.6, 0.0, 1.0)) + uCore * rays * 2.0;
        gl_FragColor = vec4(col, 1.0);
      }`,
    side: DoubleSide,
    fog: false,
    toneMapped: false,
  });
  m.name = 'tunnel-core';
  return m;
}
