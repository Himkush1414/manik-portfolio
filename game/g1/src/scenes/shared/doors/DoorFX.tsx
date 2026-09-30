// Door opening FX (brief §9): white-hot light blade through the gap, fan of
// god-ray slabs, ~800 GPU dust/steam particles bursting through, rotating
// amber beacons with real point lights. All additive, depthWrite off, HDR so
// bloom does the glow. Unlit ShaderMaterials only (no lit surfaces here).
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  ShaderMaterial,
  Color,
  type Group,
  type PointLight,
  type Mesh,
  PlaneGeometry,
  ConeGeometry,
  CylinderGeometry,
  SphereGeometry,
  MeshStandardMaterial,
  DoubleSide,
} from 'three';
import type { DoorController } from './DoorController';
import { DOOR } from './doorSpec';
import { HEX, hdr } from '../../../render/palette';
import { createRng } from '../../../core/rng';

type Props = { controller: DoorController; particles: number; reduceFlashing: boolean; reduceMotion: boolean };

const bladeVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const bladeFrag = /* glsl */ `
  uniform float uIntensity;
  uniform float uWidth;
  uniform vec3 uCore;
  uniform vec3 uGlow;
  varying vec2 vUv;
  void main() {
    float x = (vUv.x - 0.5) * 2.0;
    float core = exp(-x * x * 26.0);
    float glow = exp(-x * x * 3.0);
    float v = smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.9, vUv.y);
    vec3 c = (uCore * core * 1.6 + uGlow * glow * 0.55) * uIntensity * v;
    gl_FragColor = vec4(c, 1.0);
  }`;

const rayVert = /* glsl */ `
  attribute float aSeed;
  varying vec2 vUv;
  varying float vSeed;
  void main() { vUv = uv; vSeed = aSeed; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const rayFrag = /* glsl */ `
  uniform float uIntensity;
  uniform float uTime;
  uniform vec3 uColor;
  varying vec2 vUv;
  varying float vSeed;
  void main() {
    // clamp: with MSAA, varyings can be extrapolated just outside the
    // triangle; pow() of a negative base is NaN on D3D and bloom spreads it
    float along = clamp(vUv.y, 0.0, 1.0);   // 1 at the door, 0 at the far end
    float across = clamp(1.0 - abs(vUv.x - 0.5) * 2.0, 0.0, 1.0);
    float flick = 0.75 + 0.25 * sin(uTime * (1.3 + vSeed) + vSeed * 20.0);
    float a = pow(along, 2.2) * smoothstep(0.0, 0.6, across) * flick;
    gl_FragColor = vec4(uColor * a * uIntensity, 1.0);
  }`;

const dustVert = /* glsl */ `
  attribute vec4 aSeed;
  uniform float uAge;
  uniform float uGap;
  uniform float uSize;
  varying float vAlpha;
  varying float vWarm;
  void main() {
    float life = 1.6 + aSeed.w * 2.4;
    float t = uAge - aSeed.z * 0.6;          // staggered emission
    vec3 p = vec3(0.0, 0.0, 0.0);
    vAlpha = 0.0;
    if (t > 0.0 && t < life) {
      float k = t / life;
      float speed = 2.5 + aSeed.x * 6.0;
      float drag = (1.0 - exp(-t * 1.3)) / 1.3;
      p.x = (aSeed.y - 0.5) * max(uGap, 0.15) + (aSeed.x - 0.5) * 3.2 * drag;
      p.y = 0.4 + aSeed.w * 11.2 + (aSeed.z - 0.4) * 1.6 * drag + t * t * 0.18;
      p.z = speed * drag + sin(t * 3.0 + aSeed.y * 30.0) * 0.08;
      p.x += sin(t * 2.2 + aSeed.w * 40.0) * 0.25 * k;
      vAlpha = smoothstep(0.0, 0.08, k) * (1.0 - k);
    }
    vWarm = step(0.86, aSeed.x);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (0.6 + aSeed.y) / -mv.z;
  }`;
const dustFrag = /* glsl */ `
  uniform vec3 uCold;
  uniform vec3 uWarm;
  varying float vAlpha;
  varying float vWarm;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = dot(c, c) * 4.0;
    float a = exp(-d * 3.5) * vAlpha;
    if (a < 0.003) discard;
    gl_FragColor = vec4(mix(uCold, uWarm, vWarm) * a, 1.0);
  }`;

const beamVert = /* glsl */ `
  varying vec2 vUv;
  varying float vFacing;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * normal);
    // volumetric look: the cone's silhouette edges fade, its core stays bright
    vFacing = abs(dot(n, normalize(-mv.xyz)));
    gl_Position = projectionMatrix * mv;
  }`;
const beamFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  varying vec2 vUv;
  varying float vFacing;
  void main() {
    float a = pow(clamp(vUv.y, 0.0, 1.0), 2.4) * pow(clamp(vFacing, 0.0, 1.0), 2.0); // clamped: see rays
    gl_FragColor = vec4(uColor * a * uIntensity, 1.0);
  }`;

export function DoorFX({ controller, particles, reduceFlashing, reduceMotion }: Props) {
  const beaconRefs = useRef<Group[]>([]);
  const lightRefs = useRef<PointLight[]>([]);
  const blade = useRef<Mesh>(null);

  const built = useMemo(() => {
    const bladeMat = new ShaderMaterial({
      vertexShader: bladeVert,
      fragmentShader: bladeFrag,
      uniforms: {
        uIntensity: { value: 0 },
        uWidth: { value: 0 },
        uCore: { value: hdr('core', 1).multiplyScalar(5) },
        uGlow: { value: new Color('#ffffff').multiplyScalar(2.2) },
      },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    });

    // god-ray spokes: quads fanning from points along the seam toward the camera
    const rng = createRng(907);
    const spokes = 11;
    const pos: number[] = [];
    const uv: number[] = [];
    const seed: number[] = [];
    for (let i = 0; i < spokes; i++) {
      const y0 = 1 + rng.next() * 10.4;
      const ang = (rng.next() - 0.5) * 1.3;
      const len = 7 + rng.next() * 7;
      const w0 = 0.12 + rng.next() * 0.2;
      const w1 = 1.2 + rng.next() * 2.6;
      const dx = Math.sin(ang) * len * 0.55;
      const dy = (y0 - 6) * 0.35 + (rng.next() - 0.5) * 2;
      // two triangles, near edge at the door plane, far edge toward camera
      const quad = [
        [-w0, y0, 0, 0, 1],
        [w0, y0, 0, 1, 1],
        [dx - w1, y0 + dy, len, 0, 0],
        [w0, y0, 0, 1, 1],
        [dx + w1, y0 + dy, len, 1, 0],
        [dx - w1, y0 + dy, len, 0, 0],
      ];
      const s = rng.next();
      for (const [x, y, z, u, v] of quad) {
        pos.push(x, y, z);
        uv.push(u, v);
        seed.push(s);
      }
    }
    const rayGeo = new BufferGeometry();
    rayGeo.setAttribute('position', new Float32BufferAttribute(pos, 3));
    rayGeo.setAttribute('uv', new Float32BufferAttribute(uv, 2));
    rayGeo.setAttribute('aSeed', new Float32BufferAttribute(seed, 1));
    const rayMat = new ShaderMaterial({
      vertexShader: rayVert,
      fragmentShader: rayFrag,
      uniforms: { uIntensity: { value: 0 }, uTime: { value: 0 }, uColor: { value: new Color('#dfe6ff').multiplyScalar(0.55) } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
      toneMapped: false,
    });

    const count = Math.round(800 * particles);
    const dust = new BufferGeometry();
    const dustSeed = new Float32Array(count * 4);
    const prng = createRng(311);
    for (let i = 0; i < count * 4; i++) dustSeed[i] = prng.next();
    dust.setAttribute('position', new Float32BufferAttribute(new Float32Array(count * 3), 3));
    dust.setAttribute('aSeed', new Float32BufferAttribute(dustSeed, 4));
    const dustMat = new ShaderMaterial({
      vertexShader: dustVert,
      fragmentShader: dustFrag,
      uniforms: {
        uAge: { value: 100 },
        uGap: { value: 0 },
        uSize: { value: 140 },
        uCold: { value: new Color('#cfd9ff').multiplyScalar(0.9) },
        uWarm: { value: hdr('hot', 2.2) },
      },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    });

    const beamGeo = new ConeGeometry(2.4, 11, 24, 1, true).rotateZ(Math.PI / 2).translate(-5.5, 0, 0);
    const beamMat = new ShaderMaterial({
      vertexShader: beamVert,
      fragmentShader: beamFrag,
      uniforms: { uColor: { value: hdr('hot', 1) }, uIntensity: { value: 0.22 } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
      toneMapped: false,
    });
    const lampMat = new MeshStandardMaterial({ color: '#000', emissive: hdr('hot', 1), emissiveIntensity: 6, toneMapped: false });
    const baseMat = new MeshStandardMaterial({ color: '#1c1f26', metalness: 0.8, roughness: 0.45 });
    const lampGeo = new SphereGeometry(0.34, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    const baseGeo = new CylinderGeometry(0.42, 0.5, 0.36, 20);
    const bladeGeo = new PlaneGeometry(1, DOOR.H);
    return { bladeMat, bladeGeo, rayGeo, rayMat, dust, dustMat, beamGeo, beamMat, lampMat, baseMat, lampGeo, baseGeo };
  }, [particles]);

  useFrame((state, dt) => {
    const p = Math.max(0, controller.progress);
    const gap = 2 * DOOR.travel * p + 0.03;
    const t = state.clock.elapsedTime;
    // blade: brightest while the gap is narrow, fades as the bay opens up
    // the leak starts the instant the teeth disengage (sealed: bevels close the seam)
    const bladeI = p <= 0.0005 ? 0 : Math.max(0.22, Math.min(1, p * 14)) * (1 - smooth(0.35, 0.9, p));
    const b = blade.current;
    if (b) {
      b.scale.x = Math.min(gap, 1.2) + 0.25;
      b.visible = bladeI > 0.002;
    }
    built.bladeMat.uniforms.uIntensity.value = bladeI;
    built.rayMat.uniforms.uIntensity.value = p <= 0.0005 ? 0 : Math.min(1, p * 5) * (1 - smooth(0.55, 1.0, p));
    built.rayMat.uniforms.uTime.value = t;
    built.dustMat.uniforms.uAge.value = performance.now() / 1000 - controller.burstAt;
    built.dustMat.uniforms.uGap.value = gap;

    // beacons: rotate while moving (and slowly while sealed); strobe unless reduced
    const moving = controller.state === 'opening' || controller.state === 'closing';
    const speed = reduceMotion ? 0 : moving ? (reduceFlashing ? 2.2 : 6.5) : 1.2;
    beaconRefs.current.forEach((g, i) => {
      if (!g) return;
      g.rotation.y += dt * speed * (i === 0 ? 1 : -1);
      const facing = Math.max(0, Math.cos(g.rotation.y - Math.PI / 2 * (i === 0 ? 1 : -1)));
      const l = lightRefs.current[i];
      if (l) l.intensity = (moving ? 26 : 14) * (0.45 + 0.55 * facing);
    });
  });

  return (
    <group>
      <mesh ref={blade} geometry={built.bladeGeo} material={built.bladeMat} position={[0, DOOR.H / 2, -0.35]} renderOrder={5} />
      <mesh geometry={built.rayGeo} material={built.rayMat} position={[0, 0, 0.2]} renderOrder={6} frustumCulled={false} />
      <points geometry={built.dust} material={built.dustMat} position={[0, 0, 0.1]} renderOrder={7} frustumCulled={false} />
      {[-1, 1].map((sx, i) => (
        <group key={sx} position={[sx * (DOOR.frame.holeX + 1.35), 11.9, DOOR.frame.depth + 0.95]}>
          <mesh geometry={built.baseGeo} material={built.baseMat} />
          <mesh geometry={built.lampGeo} material={built.lampMat} position={[0, 0.18, 0]} />
          <group ref={el => { if (el) beaconRefs.current[i] = el; }} position={[0, 0.3, 0]}>
            <mesh geometry={built.beamGeo} material={built.beamMat} renderOrder={8} />
          </group>
          <pointLight ref={el => { if (el) lightRefs.current[i] = el; }} color={HEX.hot} distance={30} decay={1.6} position={[0, 0.6, 0.6]} />
        </group>
      ))}
    </group>
  );
}

function smooth(a: number, b: number, v: number) {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
