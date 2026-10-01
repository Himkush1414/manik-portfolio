// GPU particle system (brief §4 rule 6, §13): the CPU only appends spawn
// records into a fixed ring (x, y, s, t0 | velocity, life | size, ramp, drag,
// stretch); the vertex shader integrates position (exponential drag) and
// fades by age. No per-particle CPU simulation. One draw call for every
// spark / puff in the mission. Ring size per preset (data/vfx.ts); a full
// ring overwrites the oldest record. Uploads are partial (only the records
// written this frame).
//
// Rail space: x right, y up, s forward (absolute). Render z = -(s - playerS),
// so a spark stays where it was born on the rail and the player flies past it.
import { AdditiveBlending, Color, DynamicDrawUsage, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, PlaneGeometry, ShaderMaterial, Sphere, Vector3 } from 'three';
import { PARTICLE_CAP, RAMP_COLORS, SPARK_STRETCH } from '../../../data/vfx';
import type { Preset } from '../../quality';
import { queueRange, range, type UploadRange } from './gpu';

const MAX = PARTICLE_CAP.ultra;

export class Particles {
  readonly mesh: Mesh;
  readonly material: ShaderMaterial;
  private geo: InstancedBufferGeometry;
  private a0: InstancedBufferAttribute;
  private a1: InstancedBufferAttribute;
  private a2: InstancedBufferAttribute;
  private cap = PARTICLE_CAP.high;
  private head = 0;
  /** first record written this frame + how many */
  private from = -1;
  private written = 0;
  private ranges: UploadRange[] = [];
  /** presentation clock the shader ages particles by */
  time = 0;
  /** preset multiplier for burst counts */
  density = 1;
  /** spawn records written so far (QA) */
  spawned = 0;

  constructor() {
    const base = new PlaneGeometry(1, 1);
    this.geo = new InstancedBufferGeometry();
    this.geo.index = base.index;
    this.geo.setAttribute('position', base.getAttribute('position'));
    this.a0 = new InstancedBufferAttribute(new Float32Array(MAX * 4), 4).setUsage(DynamicDrawUsage);
    this.a1 = new InstancedBufferAttribute(new Float32Array(MAX * 4), 4).setUsage(DynamicDrawUsage);
    this.a2 = new InstancedBufferAttribute(new Float32Array(MAX * 4), 4).setUsage(DynamicDrawUsage);
    // every record starts dead (t0 far in the future would also work; life 0 is explicit)
    this.geo.setAttribute('aP', this.a0);
    this.geo.setAttribute('aV', this.a1);
    this.geo.setAttribute('aK', this.a2);
    this.geo.instanceCount = this.cap;
    for (let i = 0; i < 6; i++) this.ranges.push(range());
    const rampA: Vector3[] = [], rampB: Vector3[] = [];
    const c = new Color();
    for (const [ca, ha, cb, hb] of RAMP_COLORS) {
      c.set(ca).multiplyScalar(ha);
      rampA.push(new Vector3(c.r, c.g, c.b));
      c.set(cb).multiplyScalar(hb);
      rampB.push(new Vector3(c.r, c.g, c.b));
    }
    this.material = new ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPlayerS: { value: 0 }, uRampA: { value: rampA }, uRampB: { value: rampB } },
      vertexShader: /* glsl */ `
        attribute vec4 aP; // x, y, s, t0
        attribute vec4 aV; // vx, vy, vs, life
        attribute vec4 aK; // size, ramp, drag, stretch (0 round / 1 spark)
        uniform float uTime, uPlayerS;
        uniform vec3 uRampA[${RAMP_COLORS.length}];
        uniform vec3 uRampB[${RAMP_COLORS.length}];
        varying vec2 vUv;
        varying vec3 vCol;
        varying float vT;
        varying float vStretch;
        void main() {
          float age = uTime - aP.w;
          float life = aV.w;
          if (age < 0.0 || age >= life) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); vCol = vec3(0.0); return; }
          float k = aK.z;
          float decay = exp(-k * age);
          float f = k > 0.0 ? (1.0 - decay) / k : age;
          vec3 rail = aP.xyz + aV.xyz * f;
          vec3 local = vec3(rail.x, rail.y, -(rail.z - uPlayerS));
          vec4 mv = modelViewMatrix * vec4(local, 1.0);
          float t = age / life;
          float size = aK.x * (1.0 - 0.55 * t);
          vStretch = aK.w;
          if (aK.w > 0.5) {
            // spark: a streak along the current (view-space) velocity
            vec3 vel = vec3(aV.x, aV.y, -aV.z) * decay;
            vec3 vv = (modelViewMatrix * vec4(vel, 0.0)).xyz;
            vec2 dir = vv.xy;
            float l = length(dir);
            dir = l > 1e-4 ? dir / l : vec2(0.0, 1.0);
            float len = size * ${SPARK_STRETCH.min.toFixed(2)} + length(vv) * ${SPARK_STRETCH.k.toFixed(4)};
            mv.xy += vec2(-dir.y, dir.x) * position.x * size + dir * position.y * len;
          } else {
            mv.xy += position.xy * size;
          }
          int r = int(aK.y + 0.5);
          vCol = mix(uRampA[r], uRampB[r], t);
          vT = t;
          vUv = position.xy * 2.0;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vCol;
        varying float vT;
        varying float vStretch;
        void main() {
          float a;
          if (vStretch > 0.5) a = exp(-vUv.x * vUv.x * 5.0) * (1.0 - smoothstep(0.55, 1.0, abs(vUv.y)));
          else a = exp(-dot(vUv, vUv) * 3.2);
          float fade = 1.0 - vT;
          gl_FragColor = vec4(vCol * a * fade * fade, 1.0);
        }`,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      fog: false,
      toneMapped: false,
    });
    this.material.name = 'mission-particles';
    this.mesh = new Mesh(this.geo, this.material);
    this.mesh.frustumCulled = false;
    this.geo.boundingSphere = new Sphere(new Vector3(), 400);
    this.mesh.renderOrder = 10;
    this.mesh.name = 'mission-particles';
  }

  setTier(p: Preset, multiplier: number): void {
    this.cap = PARTICLE_CAP[p];
    this.geo.instanceCount = this.cap;
    this.density = multiplier;
    if (this.head >= this.cap) this.head = 0;
  }

  /** Append one spawn record (rail space). */
  emit(x: number, y: number, s: number, vx: number, vy: number, vs: number, life: number, size: number, ramp: number, drag: number, stretch: boolean): void {
    const i = this.head;
    const j = i * 4;
    const p = this.a0.array as Float32Array, v = this.a1.array as Float32Array, k = this.a2.array as Float32Array;
    p[j] = x;
    p[j + 1] = y;
    p[j + 2] = s;
    p[j + 3] = this.time;
    v[j] = vx;
    v[j + 1] = vy;
    v[j + 2] = vs;
    v[j + 3] = life;
    k[j] = size;
    k[j + 1] = ramp;
    k[j + 2] = drag;
    k[j + 3] = stretch ? 1 : 0;
    if (this.from < 0) this.from = i;
    this.written++;
    this.spawned++;
    this.head = i + 1 >= this.cap ? 0 : i + 1;
  }

  /** Per frame, after this frame's emits: clock + player position + partial uploads. */
  update(time: number, playerS: number): void {
    const u = this.material.uniforms;
    u.uTime.value = time;
    u.uPlayerS.value = playerS;
    if (this.written === 0) return;
    const attrs = [this.a0, this.a1, this.a2];
    if (this.written >= this.cap) {
      for (let a = 0; a < 3; a++) queueRange(attrs[a], this.ranges[a * 2], 0, this.cap * 4);
    } else {
      const end = this.from + this.written;
      for (let a = 0; a < 3; a++) {
        if (end <= this.cap) queueRange(attrs[a], this.ranges[a * 2], this.from * 4, this.written * 4);
        else {
          queueRange(attrs[a], this.ranges[a * 2], this.from * 4, (this.cap - this.from) * 4);
          queueRange(attrs[a], this.ranges[a * 2 + 1], 0, (end - this.cap) * 4);
        }
      }
    }
    this.from = -1;
    this.written = 0;
  }

  /** Kill every live particle (retry / mission start): records age out instantly. */
  clear(): void {
    const v = this.a1.array as Float32Array;
    for (let i = 0; i < MAX; i++) v[i * 4 + 3] = 0;
    this.a1.needsUpdate = true;
    this.a1.clearUpdateRanges();
    this.from = -1;
    this.written = 0;
    this.head = 0;
  }

  dispose(): void {
    this.geo.dispose();
    this.material.dispose();
  }
}
