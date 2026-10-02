// Projectile visuals (brief §7 FIRE, §11 FAIRNESS, §18 colour-independent
// cues): player pulse bolts = ELONGATED HDR tracers (white-hot core,
// Ignition body); enemy bolts = ROUND Danger-violet orbs with white cores.
// One instanced draw each. Per frame the live projectiles of the sim's SoA
// pools are written into instance attributes (interpolated: pos - vel *
// (1 - alpha) * STEP) and uploaded partially (live range only). Render z =
// -(s - playerS) in the mission frame.
import { AdditiveBlending, Color, DynamicDrawUsage, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, PlaneGeometry, ShaderMaterial, Sphere, Vector3 } from 'three';
import { CAPS, PLAYER } from '../../../data/mission';
import { ORB, TRACER } from '../../../data/vfx';
import { HEX } from '../../palette';
import { STEP } from '../../../game/core/step';
import type { ProjectilePool } from '../../../game/core/pool';
import { queueRange, range } from './gpu';
import { missionSpace } from '../../world/missionSpace';

const _l = new Vector3(), _d = new Vector3();

function instanced(cap: number, attrs: Record<string, number>): { geo: InstancedBufferGeometry; a: Record<string, InstancedBufferAttribute> } {
  const base = new PlaneGeometry(1, 1);
  const geo = new InstancedBufferGeometry();
  geo.index = base.index;
  geo.setAttribute('position', base.getAttribute('position'));
  const a: Record<string, InstancedBufferAttribute> = {};
  for (const k in attrs) {
    a[k] = new InstancedBufferAttribute(new Float32Array(cap * attrs[k]), attrs[k]).setUsage(DynamicDrawUsage);
    geo.setAttribute(k, a[k]);
  }
  geo.instanceCount = 0;
  geo.boundingSphere = new Sphere(new Vector3(), 400);
  return { geo, a };
}

export class Bolts {
  readonly tracers: Mesh;
  readonly orbs: Mesh;
  private tGeo: InstancedBufferGeometry;
  private oGeo: InstancedBufferGeometry;
  private tHead: InstancedBufferAttribute;
  private tDir: InstancedBufferAttribute;
  private oPos: InstancedBufferAttribute;
  private r = [range(), range(), range()];

  constructor() {
    const t = instanced(CAPS.playerBullets, { aHead: 4, aDir: 4 });
    this.tGeo = t.geo;
    this.tHead = t.a.aHead;
    this.tDir = t.a.aDir;
    const ign = new Color(HEX.ignition).multiplyScalar(TRACER.bodyHdr);
    const core = new Color(HEX.core).multiplyScalar(TRACER.coreHdr);
    const tracerMat = new ShaderMaterial({
      uniforms: { uBody: { value: ign }, uCore: { value: core } },
      vertexShader: /* glsl */ `
        attribute vec4 aHead; // x, y, z (mission-local), length
        attribute vec4 aDir;  // unit direction (mission-local), alpha
        varying vec2 vQ;      // x across -1..1, y along 0 head .. 1 tail
        varying float vA;
        void main() {
          float along = 0.5 - position.y;                  // 0 at the head
          vec3 p = aHead.xyz - aDir.xyz * along * aHead.w;
          vec3 w = (modelMatrix * vec4(p, 1.0)).xyz;
          vec3 side = cross(aDir.xyz, normalize(cameraPosition - w));
          float sl = length(side);
          side = sl > 1e-4 ? side / sl : vec3(1.0, 0.0, 0.0);
          w += side * position.x * ${TRACER.width.toFixed(3)} * 2.0;
          vQ = vec2(position.x * 2.0, along);
          vA = aDir.w;
          gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uBody, uCore;
        varying vec2 vQ;
        varying float vA;
        void main() {
          float x2 = vQ.x * vQ.x;
          float body = exp(-x2 * ${TRACER.bodyFalloff.toFixed(2)});
          float core = exp(-x2 * ${TRACER.coreFalloff.toFixed(2)});
          float tail = pow(clamp(1.0 - vQ.y, 0.0, 1.0), 1.6) * smoothstep(0.0, 0.035, vQ.y + 0.01); // pow(<0) = NaN on ANGLE/D3D
          vec3 c = (uBody * body + uCore * core * (1.0 - vQ.y * 0.7)) * tail * vA;
          gl_FragColor = vec4(c, 1.0);
        }`,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      fog: false,
      toneMapped: false,
    });
    tracerMat.name = 'player-tracers';
    this.tracers = new Mesh(this.tGeo, tracerMat);
    this.tracers.frustumCulled = false;
    this.tracers.renderOrder = 9;
    this.tracers.name = 'player-tracers';

    const o = instanced(CAPS.enemyBullets, { aOrb: 4 });
    this.oGeo = o.geo;
    this.oPos = o.a.aOrb;
    const orbMat = new ShaderMaterial({
      uniforms: {
        uRimA: { value: new Color(HEX.nebula).multiplyScalar(ORB.rimHdr) },
        uRimB: { value: new Color(HEX.danger).multiplyScalar(ORB.rimHdr) },
        uCore: { value: new Color(HEX.frost).multiplyScalar(ORB.coreHdr) },
        uTime: { value: 0 },
      },
      vertexShader: /* glsl */ `
        attribute vec4 aOrb; // x, y, z (mission-local), phase
        uniform float uTime;
        varying vec2 vUv;
        varying float vPulse;
        void main() {
          vPulse = 0.5 + 0.5 * sin(uTime * ${(ORB.pulseHz * Math.PI * 2).toFixed(3)} + aOrb.w * 6.2831);
          vec4 mv = modelViewMatrix * vec4(aOrb.xyz, 1.0);
          mv.xy += position.xy * ${ORB.size.toFixed(2)} * (1.0 + 0.08 * vPulse);
          vUv = position.xy * 2.0;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uRimA, uRimB, uCore;
        varying vec2 vUv;
        varying float vPulse;
        void main() {
          float r = length(vUv);
          if (r > 1.0) discard;
          float core = exp(-r * r * 22.0);
          float q = (r - 0.52) / 0.2;
          float ring = exp(-q * q); // never pow() on a negative base (NaN on ANGLE/D3D)
          float halo = (1.0 - smoothstep(0.3, 1.0, r)) * 0.35;
          vec3 rim = mix(uRimA, uRimB, 0.35 + 0.4 * vPulse);
          gl_FragColor = vec4(uCore * core + rim * (ring + halo), 1.0);
        }`,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      fog: false,
      toneMapped: false,
    });
    orbMat.name = 'enemy-orbs';
    this.orbs = new Mesh(this.oGeo, orbMat);
    this.orbs.frustumCulled = false;
    this.orbs.renderOrder = 9;
    this.orbs.name = 'enemy-orbs';
  }

  /** Per frame: write the live projectiles (interpolated by alpha) relative to the player's rail position. */
  update(player: ProjectilePool, enemy: ProjectilePool, alpha: number, playerS: number, time: number): void {
    const back = (1 - alpha) * STEP;
    // player tracers: head at the interpolated position; length grows from 0 at the muzzle
    const h = this.tHead.array as Float32Array, d = this.tDir.array as Float32Array;
    const maxLife = PLAYER.bullet.range / PLAYER.bullet.speed;
    let n = 0;
    for (let i = 0; i < player.count; i++) {
      const vs = player.vs[i], vx = player.vx[i], vy = player.vy[i];
      const sp = Math.hypot(vs, vx, vy) || 1;
      const x = player.x[i] - vx * back, y = player.y[i] - vy * back, s = player.s[i] - vs * back;
      const age = Math.max(0, maxLife - player.life[i] - back);
      const dist = s - playerS;
      const j = n * 4;
      // rail -> mission-local through the bending path
      missionSpace.railToLocal(s, x, y, _l);
      h[j] = _l.x;
      h[j + 1] = _l.y;
      h[j + 2] = _l.z;
      // the tail never reaches back behind the muzzle: it grows at the bolt's speed RELATIVE to the ship
      h[j + 3] = Math.min(TRACER.length, PLAYER.bullet.speed * age * 0.9 + 0.6);
      missionSpace.railDirToLocal(s, vx / sp, vy / sp, vs / sp, _d).normalize();
      d[j] = _d.x;
      d[j + 1] = _d.y;
      d[j + 2] = _d.z;
      d[j + 3] = dist > TRACER.fadeFrom ? Math.max(0, 1 - (dist - TRACER.fadeFrom) / (TRACER.fadeTo - TRACER.fadeFrom)) : 1;
      n++;
    }
    this.tGeo.instanceCount = n;
    if (n > 0) {
      queueRange(this.tHead, this.r[0], 0, n * 4);
      queueRange(this.tDir, this.r[1], 0, n * 4);
    }
    // enemy orbs
    const o = this.oPos.array as Float32Array;
    let m = 0;
    for (let i = 0; i < enemy.count; i++) {
      const j = m * 4;
      missionSpace.railToLocal(enemy.s[i] - enemy.vs[i] * back, enemy.x[i] - enemy.vx[i] * back, enemy.y[i] - enemy.vy[i] * back, _l);
      o[j] = _l.x;
      o[j + 1] = _l.y;
      o[j + 2] = _l.z;
      o[j + 3] = (enemy.serial[i] % 97) / 97;
      m++;
    }
    this.oGeo.instanceCount = m;
    if (m > 0) queueRange(this.oPos, this.r[2], 0, m * 4);
    (this.orbs.material as ShaderMaterial).uniforms.uTime.value = time;
  }

  get tracerCount(): number {
    return this.tGeo.instanceCount;
  }
  get orbCount(): number {
    return this.oGeo.instanceCount;
  }
  /** QA: the first tracer's head (mission-local) + length and direction */
  debugFirst(): number[] | null {
    if (this.tGeo.instanceCount === 0) return null;
    const h = this.tHead.array as Float32Array, d = this.tDir.array as Float32Array;
    return [h[0], h[1], h[2], h[3], d[0], d[1], d[2], d[3]].map(v => Math.round(v * 100) / 100);
  }

  /** Draw nothing until the next update (retry / scene swap). */
  clear(): void {
    this.tGeo.instanceCount = 0;
    this.oGeo.instanceCount = 0;
  }

  dispose(): void {
    this.tGeo.dispose();
    this.oGeo.dispose();
    (this.tracers.material as ShaderMaterial).dispose();
    (this.orbs.material as ShaderMaterial).dispose();
  }
}
