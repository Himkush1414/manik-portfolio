// Cumulus banks (Phase 2R §6 CLOUDS): ONE instanced draw of soft procedural
// puffs (camera-facing quads, fbm-eroded discs, lit toward the sun, darker
// flattened bases), grouped into banks placed deterministically in WORLD
// space along the path (hash of the bank index: lateral offset, altitude,
// size) and recycled through a fixed slot ring as the player flies — the
// geometry / instance count never change. Puff centres are turned into
// mission space on the CPU each frame (a few hundred mults); distance haze
// comes from the shared aerial-perspective chunk, so far banks melt into the
// sky like the ridges do. Cloud shadows on the ground are drawn by the
// terrain material from the same coverage + wind (cloudShadowUniforms).
import { Color, DynamicDrawUsage, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, PlaneGeometry, ShaderMaterial, Vector2, Vector3 } from 'three';
import type { CloudLayerDef, WorldDef } from '../../data/worlds/types';
import type { FlightPath } from '../../game/world/path';
import { createFrame } from '../../game/world/path';
import { missionSpace } from './missionSpace';
import { AP_GLSL, AP_UNIFORMS } from './atmosphere';
import { MISSION_ORIGIN } from '../../scenes/sceneBridge';
import type { Preset } from '../quality';

/** banks (slots) per preset and puffs per bank */
export const CLOUD_BANKS: Record<Preset, number> = { low: 10, medium: 14, high: 18, ultra: 22 };
const PUFFS = 9;
/** bank window along the path (u): behind / ahead of the viewer */
const BEHIND = 1600, AHEAD = 5600;

/** shared with the terrain material: moving cloud shadows (same coverage + wind as the banks) */
export const CLOUD_SHADOW_UNIFORMS = {
  uCloudShadow: { value: 0 },
  uCloudCover: { value: 0 },
  uCloudAlt: { value: 1400 },
  uCloudWind: { value: new Vector2() },
};

export const CLOUD_SHADOW_GLSL = /* glsl */ `
uniform float uCloudShadow, uCloudCover, uCloudAlt;
uniform vec2 uCloudWind;
// 0 = full shadow .. 1 = sunlit; the ground point is projected along the sun onto the cloud layer
float cloudShade(vec3 worldP, vec3 sunW, float floorY) {
  if (uCloudShadow <= 0.0) return 1.0;
  vec2 p = worldP.xz + sunW.xz / max(sunW.y, 0.12) * max(floorY + uCloudAlt - worldP.y, 0.0);
  p = (p + uCloudWind) / 1100.0;
  float n = tFbm(p) * 0.75 + tNoise(p * 3.1 + 5.3) * 0.25;
  float c = smoothstep(1.0 - uCloudCover * 0.95, 1.0 - uCloudCover * 0.95 + 0.16, n);
  return 1.0 - c * uCloudShadow;
}
`;

const h = (k: number, salt: number) => {
  let x = Math.imul(k ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(salt + 0x27d4eb2f, 0xc2b2ae35);
  x ^= x >>> 15;
  x = Math.imul(x, 0x2c1b3c6d);
  x ^= x >>> 12;
  return (x >>> 0) / 4294967296;
};

export class CloudBanks {
  readonly mesh: Mesh;
  readonly material: ShaderMaterial;
  private readonly geo: InstancedBufferGeometry;
  private readonly centre: InstancedBufferAttribute;
  private readonly shape: InstancedBufferAttribute;
  private readonly slots: number;
  /** bank index held by each slot (-1 = none) and the world positions of its puffs */
  private readonly slotBank: Int32Array;
  private readonly world: Float64Array;
  private readonly radius: Float32Array;
  private layer: CloudLayerDef | null = null;
  private spacing = 400;
  private path: FlightPath | null = null;
  private readonly f = createFrame();
  private readonly v = new Vector3();

  constructor(preset: Preset) {
    this.slots = CLOUD_BANKS[preset];
    const n = this.slots * PUFFS;
    const quad = new PlaneGeometry(1, 1);
    this.geo = new InstancedBufferGeometry();
    this.geo.index = quad.index;
    this.geo.setAttribute('position', quad.getAttribute('position'));
    this.geo.instanceCount = n;
    this.centre = new InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(DynamicDrawUsage);
    this.shape = new InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(DynamicDrawUsage);
    this.geo.setAttribute('cCentre', this.centre);
    this.geo.setAttribute('cShape', this.shape);
    this.slotBank = new Int32Array(this.slots).fill(-1);
    this.world = new Float64Array(n * 3);
    this.radius = new Float32Array(n);
    this.material = new ShaderMaterial({
      name: 'clouds',
      transparent: true,
      depthWrite: false,
      fog: false,
      uniforms: {
        ...AP_UNIFORMS,
        uPathP0: missionSpace.uniforms.uPathP0,
        uPathB: missionSpace.uniforms.uPathB,
        uMissionO: { value: new Vector3(...MISSION_ORIGIN) },
        uSunL: { value: new Vector3(0, 1, 0) },
        uLit: { value: new Color() },
        uShade: { value: new Color() },
        uTime: { value: 0 },
      },
      vertexShader: /* glsl */ `
        attribute vec4 cCentre; // xyz mission-local centre, w = radius (0 = hidden)
        attribute vec4 cShape;  // x seed, y height in its bank (0 base .. 1 top), z aspect, w opacity
        uniform vec3 uPathP0, uMissionO, uSunL;
        uniform mat3 uPathB;
        varying vec2 vUv;
        varying vec4 vShape;
        varying vec3 vWorldP;
        varying vec2 vSun;
        varying float vFade;
        void main() {
          vec4 c = modelMatrix * vec4(cCentre.xyz, 1.0);
          vec4 mv = viewMatrix * c;
          vec2 corner = position.xy;
          mv.xy += corner * vec2(cCentre.w * cShape.z, cCentre.w) * 2.0;
          gl_Position = projectionMatrix * mv;
          vUv = corner + 0.5;
          vShape = cShape;
          vWorldP = uPathP0 + transpose(uPathB) * (c.xyz - uMissionO);
          // the sun's direction across the screen (lit side of each puff)
          vec3 sv = (viewMatrix * vec4(uSunL, 0.0)).xyz;
          vSun = normalize(sv.xy + vec2(0.0, 0.3));
          // fade in from the far end of the window and out when very close
          float d = -mv.z;
          vFade = smoothstep(5600.0, 4300.0, d) * smoothstep(120.0, 420.0, d) * step(0.001, cCentre.w);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uLit, uShade;
        uniform float uTime;
        varying vec2 vUv;
        varying vec4 vShape;
        varying vec3 vWorldP;
        varying vec2 vSun;
        varying float vFade;
        ${AP_GLSL}
        float ch(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float cn(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(ch(i), ch(i + vec2(1, 0)), u.x), mix(ch(i + vec2(0, 1)), ch(i + vec2(1, 1)), u.x), u.y);
        }
        float cf(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * cn(p); p = p * 2.07 + 11.3; a *= 0.5; } return s; }
        void main() {
          vec2 q = vUv - 0.5;
          float seed = vShape.x * 97.0;
          float n = cf(q * 3.2 + seed + uTime * 0.01);
          float d = length(q * vec2(1.0, 1.15)) * 2.0;
          float a = smoothstep(1.0, 0.42, d + (n - 0.5) * 0.85);
          // flattened, darker bases (only for the low puffs of a bank)
          float base = mix(0.0, 0.32, 1.0 - vShape.y);
          a *= smoothstep(base - 0.02, base + 0.16, vUv.y + (n - 0.5) * 0.12);
          if (a < 0.004) discard;
          // light: toward the sun across the puff, brighter tops, self-shadowed bases + interior
          float side = dot(normalize(q + 1e-4), vSun) * smoothstep(0.0, 0.5, length(q) * 2.0);
          float lit = clamp(0.5 + 0.38 * side + 0.32 * (vUv.y - 0.5) + 0.25 * vShape.y + (n - 0.5) * 0.4, 0.0, 1.0);
          vec3 col = mix(uShade, uLit, lit);
          vec4 ap = aerial(vWorldP);
          col = mix(col, ap.rgb, ap.a * 0.9);
          gl_FragColor = vec4(col, a * vShape.w * vFade);
        }`,
    });
    this.mesh = new Mesh(this.geo, this.material);
    this.mesh.name = 'clouds';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -500; // after the sky, before other transparents (they are nearer)
  }

  setWorld(w: WorldDef, path: FlightPath): void {
    this.path = path;
    this.layer = w.sky.clouds.find(c => c.kind === 'cumulus' || c.kind === 'storm') ?? null;
    const L = this.layer;
    const u = this.material.uniforms;
    if (L) {
      u.uLit.value.set(L.color).multiplyScalar(1.25);
      // shaded side: the cloud colour taken toward the sky's zenith blue, darker
      u.uShade.value.set(L.color).lerp(new Color(w.sky.zenith), 0.45).multiplyScalar(0.5);
      // denser with coverage, but never more banks in the window than slots (LOW)
      this.spacing = Math.max(260 / Math.max(0.1, L.coverage), (BEHIND + AHEAD) / (this.slots - 1));
      CLOUD_SHADOW_UNIFORMS.uCloudShadow.value = L.shadow;
      CLOUD_SHADOW_UNIFORMS.uCloudCover.value = L.coverage;
      CLOUD_SHADOW_UNIFORMS.uCloudAlt.value = L.altitude;
    } else CLOUD_SHADOW_UNIFORMS.uCloudShadow.value = 0;
    this.slotBank.fill(-1);
    this.mesh.visible = !!L;
  }

  /** world positions of bank k's puffs into slot `slot` */
  private build(slot: number, k: number): void {
    const L = this.layer!, path = this.path!, f = this.f;
    const s = Math.min(path.length - 1, Math.max(0, k * this.spacing + (h(k, 1) - 0.5) * this.spacing * 0.8));
    path.frameAt(s, f);
    // lateral: anywhere over the valley and the ranges either side; sometimes right overhead
    const side = h(k, 2) < 0.5 ? -1 : 1;
    const u = h(k, 3) < 0.25 ? (h(k, 4) - 0.5) * 500 : side * (250 + h(k, 4) * 2600);
    const alt = path.floorAt(s) + L.altitude + (h(k, 5) - 0.5) * 360;
    const R = 220 + h(k, 6) * 360;
    const cx = f.px + f.rx * u, cz = f.pz + f.rz * u;
    const big = h(k, 7) > 0.35; // some banks are small scattered puffs
    for (let p = 0; p < PUFFS; p++) {
      const i = slot * PUFFS + p;
      const a = h(k * 31 + p, 8) * Math.PI * 2, rr = Math.sqrt(h(k * 31 + p, 9)) * R * (big ? 1 : 0.6);
      const up = h(k * 31 + p, 10);
      this.world[i * 3] = cx + Math.cos(a) * rr;
      this.world[i * 3 + 1] = alt + up * R * 0.4;
      this.world[i * 3 + 2] = cz + Math.sin(a) * rr * 0.7;
      this.radius[i] = R * (0.38 + h(k * 31 + p, 11) * 0.3) * (1 - 0.35 * rr / R) * (big ? 1 : 0.7);
      this.shape.setXYZW(i, h(k * 31 + p, 12), up, 1.25 + h(k * 31 + p, 13) * 0.6, 0.55 + h(k * 31 + p, 14) * 0.4);
    }
    this.slotBank[slot] = k;
    this.shape.needsUpdate = true;
  }

  /** per frame, after missionSpace.update(viewS) */
  update(viewS: number, sunLocal: Vector3, time: number): void {
    if (!this.layer || !this.path) return;
    this.material.uniforms.uSunL.value.copy(sunLocal);
    this.material.uniforms.uTime.value = time;
    const k0 = Math.floor((viewS - BEHIND) / this.spacing), k1 = Math.floor((viewS + AHEAD) / this.spacing);
    // slot = k mod slots: a bank keeps its slot for its whole life in the window
    for (let k = Math.max(0, k0); k <= k1; k++) {
      const slot = k % this.slots;
      if (this.slotBank[slot] !== k) this.build(slot, k);
    }
    const v = this.v;
    for (let slot = 0; slot < this.slots; slot++) {
      const k = this.slotBank[slot];
      const live = k >= k0 && k <= k1 && k >= 0;
      for (let p = 0; p < PUFFS; p++) {
        const i = slot * PUFFS + p;
        if (!live) {
          this.centre.setW(i, 0);
          continue;
        }
        missionSpace.worldToLocal(this.world[i * 3], this.world[i * 3 + 1], this.world[i * 3 + 2], v);
        this.centre.setXYZW(i, v.x, v.y, v.z, this.radius[i]);
      }
    }
    this.centre.needsUpdate = true;
    // wind drift of the shadows (and the banks' noise)
    CLOUD_SHADOW_UNIFORMS.uCloudWind.value.set(time * 6, time * 2.5);
  }

  dispose(): void {
    this.geo.dispose();
    this.material.dispose();
  }
}
