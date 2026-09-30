// What the bay's open end looks out on (brief §11): twinkling stars, a
// procedural nebula, a real planet (lit day side, night-side city lights,
// atmosphere fresnel) and the shimmering force field across the opening.
// All far-field materials ignore fog.
import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BackSide, BufferGeometry, Float32BufferAttribute, PlaneGeometry, Points, ShaderMaterial, SphereGeometry, Vector3 } from 'three';
import { createRng } from '../../../core/rng';
import { hdr, col } from '../../../render/palette';
import { BAY } from './bayGeometry';

const NOISE = /* glsl */ `
  float h13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
  float vn(vec3 p) {
    vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h13(i), h13(i + vec3(1,0,0)), f.x), mix(h13(i + vec3(0,1,0)), h13(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(h13(i + vec3(0,0,1)), h13(i + vec3(1,0,1)), f.x), mix(h13(i + vec3(0,1,1)), h13(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * vn(p); p *= 2.03; a *= 0.5; } return s; }
`;

// sun behind the planet's right limb: night side (city lights) faces the bay
const SUN = new Vector3(0.78, 0.32, -0.55).normalize();

export function SpaceVista({ reduceMotion = false }: { reduceMotion?: boolean }) {
  const v = useMemo(() => {
    // stars: a shell in front of the opening
    const rng = createRng(9001);
    const n = 1800;
    const pos = new Float32Array(n * 3), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const u = rng.range(-1, 1), a = rng.range(0, Math.PI * 2);
      const d = new Vector3(Math.sqrt(1 - u * u) * Math.cos(a), u * 0.7, -Math.abs(Math.sqrt(1 - u * u) * Math.sin(a)) - 0.35).normalize();
      pos.set(d.multiplyScalar(560).toArray(), i * 3);
      seed[i] = rng.next();
    }
    const starGeo = new BufferGeometry();
    starGeo.setAttribute('position', new Float32BufferAttribute(pos, 3));
    starGeo.setAttribute('aSeed', new Float32BufferAttribute(seed, 1));
    const starMat = new ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute float aSeed; uniform float uTime; varying float vB; varying float vS;
        void main() {
          vS = aSeed;
          vB = (0.35 + 0.65 * pow(aSeed, 3.0)) * (0.75 + 0.25 * sin(uTime * (0.8 + aSeed * 2.5) + aSeed * 40.0));
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = 1.2 + pow(aSeed, 6.0) * 2.6;
        }`,
      fragmentShader: /* glsl */ `
        varying float vB; varying float vS;
        void main() {
          vec2 c = gl_PointCoord - 0.5; float a = exp(-dot(c, c) * 14.0);
          vec3 tint = mix(vec3(0.75, 0.82, 1.0), vec3(1.0, 0.86, 0.72), step(0.8, fract(vS * 13.0)));
          gl_FragColor = vec4(tint * vB * a * 1.6, 1.0);
        }`,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    });
    const stars = new Points(starGeo, starMat);
    stars.frustumCulled = false;

    // nebula: inside of a big sphere, low-saturation violet/indigo wisps
    const nebGeo = new SphereGeometry(600, 48, 24);
    const nebMat = new ShaderMaterial({
      uniforms: { uA: { value: col('violet') }, uB: { value: col('indigo') }, uC: { value: col('nebula') } },
      vertexShader: /* glsl */ `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        ${NOISE}
        uniform vec3 uA, uB, uC; varying vec3 vD;
        void main() {
          float f = fbm(vD * 3.2 + vec3(0.0, 0.0, 4.0));
          float g = fbm(vD * 7.0 + f * 1.8);
          float band = exp(-pow((vD.y + 0.25 * vD.x + 0.1) * 3.2, 2.0));
          float m = smoothstep(0.35, 0.95, f * 0.7 + g * 0.5) * band;
          vec3 c = mix(uB * 0.25, uA * 0.55, m) + uC * pow(m, 3.0) * 0.35;
          float dust = smoothstep(0.55, 0.8, g) * band * 0.6;
          c *= 1.0 - dust;
          gl_FragColor = vec4(c * 0.55, 1.0);
        }`,
      side: BackSide,
      depthWrite: false,
      toneMapped: true,
    });

    // planet
    const planetGeo = new SphereGeometry(95, 96, 64);
    const planetMat = new ShaderMaterial({
      uniforms: { uSun: { value: SUN }, uTime: { value: 0 }, uCity: { value: hdr('hot', 2.2) }, uAtm: { value: col('ice') } },
      vertexShader: /* glsl */ `
        varying vec3 vN; varying vec3 vP; varying vec3 vV;
        void main() {
          vN = normalize(mat3(modelMatrix) * normal);
          vP = position / 95.0;
          vec4 w = modelMatrix * vec4(position, 1.0);
          vV = normalize(cameraPosition - w.xyz);
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        ${NOISE}
        uniform vec3 uSun, uCity, uAtm; uniform float uTime;
        varying vec3 vN; varying vec3 vP; varying vec3 vV;
        void main() {
          float land = smoothstep(0.48, 0.56, fbm(vP * 2.4));
          float cloud = smoothstep(0.52, 0.78, fbm(vP * 4.0 + vec3(uTime * 0.004, 0.0, 0.0)));
          vec3 ocean = vec3(0.012, 0.03, 0.06), ground = vec3(0.07, 0.065, 0.05);
          vec3 alb = mix(ocean, ground, land);
          alb = mix(alb, vec3(0.42, 0.46, 0.52), cloud * 0.7);
          float ndl = dot(normalize(vN), uSun);
          float day = smoothstep(-0.08, 0.25, ndl);
          vec3 c = alb * max(ndl, 0.0) * 2.2;
          // night side: city lights on land, under thin cloud
          float city = smoothstep(0.6, 0.75, fbm(vP * 9.0)) * smoothstep(0.66, 0.8, vn(vP * 140.0)) * land * (1.0 - cloud * 0.8);
          c += uCity * city * (1.0 - day) * 0.9;
          // atmosphere fresnel, brighter toward the terminator/day side
          float fr = pow(1.0 - max(dot(normalize(vN), vV), 0.0), 3.2);
          c += uAtm * fr * (0.15 + 1.4 * smoothstep(-0.3, 0.6, ndl));
          gl_FragColor = vec4(c, 1.0);
        }`,
      toneMapped: true,
    });
    const halo = new ShaderMaterial({
      uniforms: { uSun: { value: SUN }, uAtm: { value: col('ice') } },
      vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(mat3(modelMatrix)*normal); vec4 w = modelMatrix*vec4(position,1.0); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uSun, uAtm; varying vec3 vN; varying vec3 vV;
        void main(){
          float rim = pow(1.0 - abs(dot(normalize(vN), vV)), 5.0);
          float lit = smoothstep(-0.4, 0.5, dot(normalize(vN), uSun));
          gl_FragColor = vec4(uAtm * rim * lit * 1.4, 1.0);
        }`,
      side: BackSide,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: true,
    });
    const haloGeo = new SphereGeometry(101, 64, 32);

    // force field across the opening
    const O = BAY.opening;
    const fieldGeo = new PlaneGeometry(2 * O.x - 0.6, O.y1 - O.y0 - 0.4, 1, 1);
    const fieldMat = new ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uCol: { value: hdr('ice', 1) }, uSize: { value: [2 * O.x - 0.6, O.y1 - O.y0 - 0.4] } },
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        ${NOISE}
        uniform float uTime; uniform vec3 uCol; uniform vec2 uSize; varying vec2 vUv;
        float hexEdge(vec2 p) {
          p *= 2.6;
          vec2 r = vec2(1.0, 1.7320508), h = r * 0.5;
          vec2 a = mod(p, r) - h, b = mod(p - h, r) - h;
          vec2 g = dot(a, a) < dot(b, b) ? a : b;
          vec2 q = abs(g);
          float d = max(dot(q, normalize(vec2(1.0, 1.7320508))), q.x);
          return smoothstep(0.44, 0.5, d);
        }
        void main() {
          vec2 p = vUv * uSize;
          float n = fbm(vec3(p * 0.18, uTime * 0.12));
          float ripple = 0.5 + 0.5 * sin(p.y * 0.9 - uTime * 1.3 + n * 6.0);
          float hex = hexEdge(p) * (0.25 + 0.75 * smoothstep(0.45, 0.8, n));
          vec2 e = min(vUv, 1.0 - vUv);
          float edge = 1.0 - smoothstep(0.0, 0.035, min(e.x * uSize.x / uSize.y, e.y));
          float a = hex * 0.012 + ripple * n * 0.01 + edge * 0.08;
          gl_FragColor = vec4(uCol * a, 1.0);
        }`,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    });
    return { stars, starGeo, starMat, nebGeo, nebMat, planetGeo, planetMat, halo, haloGeo, fieldGeo, fieldMat };
  }, []);

  useEffect(
    () => () => {
      [v.starGeo, v.nebGeo, v.planetGeo, v.haloGeo, v.fieldGeo].forEach(g => g.dispose());
      [v.starMat, v.nebMat, v.planetMat, v.halo, v.fieldMat].forEach(m => m.dispose());
    },
    [v],
  );

  useFrame(state => {
    const t = reduceMotion ? 0 : state.clock.elapsedTime;
    v.starMat.uniforms.uTime.value = t;
    v.planetMat.uniforms.uTime.value = t;
    v.fieldMat.uniforms.uTime.value = t;
  });

  const O = BAY.opening;
  return (
    <group name="vista">
      <mesh geometry={v.nebGeo} material={v.nebMat} renderOrder={-10} />
      <primitive object={v.stars} />
      <group position={[95, -80, -470]} rotation={[0.3, 0.6, 0.1]}>
        <mesh geometry={v.planetGeo} material={v.planetMat} />
        <mesh geometry={v.haloGeo} material={v.halo} />
      </group>
      <mesh geometry={v.fieldGeo} material={v.fieldMat} position={[0, (O.y0 + O.y1) / 2, BAY.zBack + 0.2]} renderOrder={8} />
    </group>
  );
}
