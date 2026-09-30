// Non-paint ship materials (brief §3 material language, §10 engines/canopy).
// Emissives use HDR values (> 1, toneMapped false) so only engines, lights and
// trims bloom. Transparent parts: depthWrite off + explicit renderOrder.
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  ShaderMaterial,
  CanvasTexture,
  NoColorSpace,
  RepeatWrapping,
  type Texture,
} from 'three';
import { hdr, HEX } from '../../render/palette';
import { ValueNoise } from '../../render/tex/noise';

let glassDirt: Texture | null = null;
/** Shared dirt/scratch mask for canopy glass (roughness variation), baked once. */
function dirtMap(): Texture {
  if (glassDirt) return glassDirt;
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const n = new ValueNoise(99);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = n.fbm(x / size, y / size, 6, 4);
      const scratch = Math.abs(Math.sin((x * 0.7 + y * 0.18) * 0.9)) > 0.995 ? 0.5 : 0;
      const r = Math.min(255, (0.06 + Math.max(0, v - 0.45) * 0.9 + scratch) * 255);
      const i = (y * size + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = r;
      img.data[i + 2] = r;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new CanvasTexture(c);
  t.colorSpace = NoColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  glassDirt = t;
  return t;
}

export type EngineGlow = { core: MeshStandardMaterial; plume: ShaderMaterial; setLevel(l: number, t: number): void };

export function createEngineGlow(kind: 'annular' | 'slit' | 'ion', tint: 'ignition' | 'nebula' = 'ignition'): EngineGlow {
  const coreColor = tint === 'nebula' ? hdr('nebula', 1) : hdr('hot', 1);
  const core = new MeshStandardMaterial({ color: '#000000', emissive: coreColor, emissiveIntensity: 2, toneMapped: false });
  const plume = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uLevel: { value: 0.25 },
      uHot: { value: tint === 'nebula' ? hdr('nebula', 3) : hdr('core', 3.2) },
      uCool: { value: tint === 'nebula' ? hdr('violet', 1.4) : hdr('ignition', 1.6) },
      uStretch: { value: kind === 'ion' ? 1.4 : 1 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying float vFacing;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * normal);
        vFacing = abs(dot(n, normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uLevel, uStretch;
      uniform vec3 uHot, uCool;
      varying vec2 vUv;
      varying float vFacing;
      float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      void main() {
        float along = clamp(1.0 - vUv.y, 0.0, 1.0);        // 1 at the nozzle exit (uv.y runs to the far end)
        float flow = n2(vec2(vUv.x * 18.0, vUv.y * 6.0 / uStretch + uTime * 7.0)) * 0.6 + n2(vec2(vUv.x * 40.0, vUv.y * 14.0 + uTime * 11.0)) * 0.4;
        float core = pow(along, 3.0 / (0.6 + uLevel));
        float a = core * (0.55 + flow * 0.45) * pow(clamp(vFacing, 0.0, 1.0), 1.5) * uLevel;
        vec3 c = mix(uCool, uHot, pow(along, 2.0));
        gl_FragColor = vec4(c * a, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    toneMapped: false,
  });
  return {
    core,
    plume,
    // level: 0.25 idle (pulsing), 1 = flare (START MISSION hover / launch)
    setLevel(l: number, t: number) {
      const pulse = l < 0.4 ? 0.88 + 0.12 * Math.sin(t * 2.4) : 1;
      core.emissiveIntensity = (1.4 + l * 5.5) * pulse;
      plume.uniforms.uLevel.value = l * pulse;
      plume.uniforms.uTime.value = t;
    },
  };
}

export function createShipMaterials() {
  return {
    nozzle: new MeshPhysicalMaterial({ color: '#8e95a3', metalness: 1, roughness: 0.28, anisotropy: 0.9, anisotropyRotation: Math.PI / 2, side: DoubleSide }),
    gun: new MeshStandardMaterial({ color: '#3a3f4a', metalness: 0.9, roughness: 0.34 }),
    heatRing: new MeshPhysicalMaterial({ color: '#3b3346', metalness: 1, roughness: 0.2, iridescence: 1, iridescenceIOR: 1.8, iridescenceThicknessRange: [220, 780] }),
    glass: new MeshPhysicalMaterial({
      color: new Color('#0e1626'),
      metalness: 0,
      roughness: 0.04,
      roughnessMap: dirtMap(),
      transparent: true,
      opacity: 0.42,
      envMapIntensity: 1.6,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      specularIntensity: 1,
      depthWrite: false,
      side: DoubleSide,
    }),
    frame: new MeshStandardMaterial({ color: '#15171d', metalness: 0.85, roughness: 0.38 }),
    pilot: new MeshStandardMaterial({ color: '#1b1d24', metalness: 0.2, roughness: 0.55, emissive: new Color(HEX.ignition), emissiveIntensity: 0.05 }),
    greeble: new MeshStandardMaterial({ color: '#2a2e37', metalness: 0.85, roughness: 0.46 }),
    navRed: new MeshStandardMaterial({ color: '#000', emissive: hdr('danger', 1), emissiveIntensity: 5, toneMapped: false }),
    navGreen: new MeshStandardMaterial({ color: '#000', emissive: hdr('ok', 1), emissiveIntensity: 5, toneMapped: false }),
    navWhite: new MeshStandardMaterial({ color: '#000', emissive: new Color('#ffffff'), emissiveIntensity: 6, toneMapped: false }),
    repulsor: new MeshStandardMaterial({ color: '#000', emissive: hdr('hot', 1), emissiveIntensity: 2.2, toneMapped: false }),
    trimEmissive: new MeshStandardMaterial({ color: '#000', emissive: hdr('nebula', 1), emissiveIntensity: 3.5, toneMapped: false }),
  };
}

export type ShipMaterials = ReturnType<typeof createShipMaterials>;
