// Boot sting FX in WebGL under the DOM typography (brief §8): the Ignition
// point, the anamorphic light streak (violet glow, Ignition-hot core, slow
// breathing flare) and 60-90 HDR embers rising from it with curl-like drift at
// several depths (parallax layer 1). Unlit, additive, HDR -> real bloom.
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BufferGeometry, Float32BufferAttribute, PlaneGeometry, ShaderMaterial, type Group, type Mesh, type Points } from 'three';
import { bootFx, BOOT_LAYER } from './bootFxParams';
import { hdr, col } from '../../render/palette';
import { createRng } from '../../core/rng';

const quadVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const streakFrag = /* glsl */ `
  uniform float uWidth;
  uniform float uGlow;
  uniform float uOpacity;
  uniform vec3 uCore;
  uniform vec3 uHot;
  uniform vec3 uViolet;
  varying vec2 vUv;
  void main() {
    float x = (vUv.x - 0.5) * 2.0;             // -1..1 across the plane
    float y = (vUv.y - 0.5) * 2.0;
    float reach = max(uWidth, 0.0001);
    float ends = 1.0 - smoothstep(reach * 0.55, reach, abs(x));   // expands from centre
    float core = exp(-y * y * 9000.0);         // ~2px hot line
    float hot = exp(-y * y * 700.0);
    float glow = exp(-y * y * 38.0) * (0.35 + 0.65 * uGlow);
    float centre = 1.0 - abs(x) * 0.55;        // anamorphic falloff to the tips
    vec3 c = uCore * core * 2.2 + uHot * hot * 0.9 + uViolet * glow * 0.55;
    gl_FragColor = vec4(c * ends * centre * uOpacity, 1.0);
  }`;

const pointFrag = /* glsl */ `
  uniform float uI;
  uniform vec3 uCore;
  uniform vec3 uHot;
  varying vec2 vUv;
  void main() {
    vec2 c = (vUv - 0.5) * 2.0;
    float d = dot(c, c);
    float a = exp(-d * 160.0) * 2.0 + exp(-d * 14.0) * 0.25;
    gl_FragColor = vec4((uCore * 0.6 + uHot * 0.4) * a * uI, 1.0);
  }`;

const emberVert = /* glsl */ `
  attribute vec4 aSeed;
  uniform float uTime;
  uniform float uEmit;
  varying float vA;
  varying float vHot;
  void main() {
    float life = 2.2 + aSeed.w * 1.8;
    float k = fract(uTime / life + aSeed.z);   // continuous emission
    float x0 = (aSeed.x - 0.5) * 6.4;
    // curl-ish drift: two out-of-phase sines per axis, amplitude grows with age
    float sway = sin(uTime * 0.9 + aSeed.y * 31.0) * 0.28 + sin(uTime * 1.7 + aSeed.x * 17.0) * 0.12;
    vec3 p = vec3(x0 + sway * k, k * (1.1 + aSeed.y * 1.6), (aSeed.y - 0.5) * 5.0);
    vA = smoothstep(0.0, 0.12, k) * (1.0 - smoothstep(0.55, 1.0, k)) * uEmit;
    vHot = aSeed.x;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    // depth "blur": particles off the focal plane render larger + softer
    float defocus = abs(-mv.z - 8.0) * 0.9;
    gl_PointSize = (3.2 + defocus * 6.0) * (0.6 + aSeed.w);
  }`;
const emberFrag = /* glsl */ `
  uniform vec3 uHot;
  uniform vec3 uIgn;
  varying float vA;
  varying float vHot;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = dot(c, c) * 4.0;
    float a = exp(-d * 4.0) * vA;
    if (a < 0.004) discard;
    gl_FragColor = vec4(mix(uIgn, uHot, vHot) * a, 1.0);
  }`;

type Props = { position: [number, number, number]; particles: number; reduceMotion: boolean };

export function BootFX({ position, particles, reduceMotion }: Props) {
  const group = useRef<Group>(null);
  const streak = useRef<Mesh>(null);
  const embersRef = useRef<Points>(null);

  const built = useMemo(() => {
    const plane = new PlaneGeometry(1, 1);
    const streakMat = new ShaderMaterial({
      vertexShader: quadVert,
      fragmentShader: streakFrag,
      uniforms: {
        uWidth: { value: 0 },
        uGlow: { value: 0 },
        uOpacity: { value: 1 },
        uCore: { value: hdr('core', 7) },
        uHot: { value: hdr('ignition', 4) },
        uViolet: { value: col('violet').lerp(col('nebula'), 0.5).multiplyScalar(2.2) },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending,
      toneMapped: false,
    });
    const pointMat = new ShaderMaterial({
      vertexShader: quadVert,
      fragmentShader: pointFrag,
      uniforms: { uI: { value: 0 }, uCore: { value: hdr('core', 9) }, uHot: { value: hdr('ignition', 6) } },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending,
      toneMapped: false,
    });
    const count = Math.round(80 * Math.min(1.15, particles));
    const rng = createRng(1337);
    const seeds = new Float32Array(count * 4);
    for (let i = 0; i < seeds.length; i++) seeds[i] = rng.next();
    const emberGeo = new BufferGeometry();
    emberGeo.setAttribute('position', new Float32BufferAttribute(new Float32Array(count * 3), 3));
    emberGeo.setAttribute('aSeed', new Float32BufferAttribute(seeds, 4));
    const emberMat = new ShaderMaterial({
      vertexShader: emberVert,
      fragmentShader: emberFrag,
      uniforms: { uTime: { value: 0 }, uEmit: { value: 0 }, uHot: { value: hdr('core', 3.2) }, uIgn: { value: hdr('ignition', 2.6) } },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending,
      toneMapped: false,
    });
    return { plane, streakMat, pointMat, emberGeo, emberMat };
  }, [particles]);

  useLayoutEffect(() => {
    group.current?.traverse(o => o.layers.set(BOOT_LAYER));
  }, [built]);

  useLayoutEffect(
    () => () => {
      built.plane.dispose();
      built.streakMat.dispose();
      built.pointMat.dispose();
      built.emberGeo.dispose();
      built.emberMat.dispose();
    },
    [built],
  );

  useFrame(state => {
    const g = group.current;
    if (!g) return;
    const visible = bootFx.opacity > 0.001;
    g.visible = visible;
    if (!visible) return;
    g.position.set(position[0] + bootFx.drift, position[1], position[2]);
    const u = built.streakMat.uniforms;
    u.uWidth.value = bootFx.streak;
    u.uGlow.value = bootFx.glow;
    u.uOpacity.value = bootFx.opacity;
    built.pointMat.uniforms.uI.value = bootFx.point * bootFx.opacity;
    built.emberMat.uniforms.uTime.value = state.clock.elapsedTime;
    built.emberMat.uniforms.uEmit.value = reduceMotion ? 0 : bootFx.embers * bootFx.opacity;
    if (embersRef.current) embersRef.current.visible = !reduceMotion && bootFx.embers > 0.001;
  });

  return (
    <group ref={group}>
      <mesh ref={streak} geometry={built.plane} material={built.streakMat} scale={[9.2, 1.1, 1]} position={[0, -0.02, 0]} renderOrder={20} frustumCulled={false} />
      <mesh geometry={built.plane} material={built.pointMat} scale={[0.5, 0.5, 1]} renderOrder={21} frustumCulled={false} />
      <points ref={embersRef} geometry={built.emberGeo} material={built.emberMat} renderOrder={22} frustumCulled={false} />
    </group>
  );
}
