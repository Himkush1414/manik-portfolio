// Speed streaks (brief §6): thin additive lines rushing past the camera.
// GPU-only: one InstancedMesh; each instance has a fixed (angle, radius,
// phase, seed) attribute; the vertex shader places it from a rail-locked
// scroll uniform (CPU mod in double) and stretches it with speed. The CPU
// never touches an instance after build. Count is set per preset (no
// rebuild: drawing fewer instances costs nothing extra).
import { AdditiveBlending, Color, DoubleSide, InstancedBufferAttribute, InstancedMesh, PlaneGeometry, ShaderMaterial, Sphere, Vector3 } from 'three';
import { SPEED_FX } from '../../../data/speedfx';
import type { Preset } from '../../quality';
import { Rng } from '../../../game/core/rng';

export class SpeedStreaks {
  readonly mesh: InstancedMesh;
  readonly material: ShaderMaterial;
  private max: number;

  constructor(seed: number) {
    this.max = SPEED_FX.streaks.ultra;
    const geo = new PlaneGeometry(1, 1);
    const a = new Float32Array(this.max * 4);
    const r = new Rng(seed);
    for (let i = 0; i < this.max; i++) {
      a[i * 4] = r.range(0, Math.PI * 2);
      // bias toward the walls: more streaks at a larger radius
      a[i * 4 + 1] = SPEED_FX.streakRMin + (SPEED_FX.streakRMax - SPEED_FX.streakRMin) * Math.sqrt(r.next());
      a[i * 4 + 2] = r.next();
      a[i * 4 + 3] = r.next();
    }
    this.material = new ShaderMaterial({
      uniforms: { uScroll: { value: 0 }, uSpeed: { value: 0 }, uAmount: { value: 1 }, uColor: { value: new Color('#7FD1FF') }, uCamZ: { value: 12 } },
      vertexShader: /* glsl */ `
        attribute vec4 aStreak; // angle, radius, phase, seed
        uniform float uScroll, uSpeed, uCamZ;
        varying float vA;
        varying float vT;
        void main() {
          const float STREAK_W = ${SPEED_FX.streakWidth.toFixed(3)};
        float span = ${SPEED_FX.streakSpan.toFixed(1)};
          // rail-locked: a streak sits at a fixed rail position; it wraps behind the camera
          float d = mod(aStreak.z * span - uScroll, span);   // distance ahead, 0..span
          float z = -d + uCamZ;                               // mission-local z (camera ~ +uCamZ)
          float len = ${SPEED_FX.streakLen.toFixed(1)} * (0.4 + uSpeed) * (0.6 + aStreak.w * 0.8);
          float ang = aStreak.x;
          vec3 axis = vec3(cos(ang), sin(ang), 0.0) * aStreak.y;
          // quad: x across (thin), y along the rail (long)
          vec3 p = axis + vec3(-sin(ang), cos(ang), 0.0) * position.x * STREAK_W + vec3(0.0, 0.0, z + position.y * len);
          vT = position.y + 0.5;
          // fade in from the far end, out as it passes the camera
          vA = (1.0 - smoothstep(span * 0.55, span, d)) * smoothstep(0.0, 25.0, d); // never smoothstep(hi, lo): undefined in GLSL (0 on ANGLE)
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uSpeed, uAmount;
        uniform vec3 uColor;
        varying float vA;
        varying float vT;
        void main() {
          float a = vA * vT * vT * clamp(uSpeed - 0.25, 0.0, 1.5) * uAmount;
          gl_FragColor = vec4(uColor * ${SPEED_FX.streakGlow.toFixed(2)} * a, 1.0);
        }`,
      // the quads face radially outward and the camera sits on the axis (back faces)
      side: DoubleSide,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      fog: false,
      toneMapped: false,
    });
    this.material.name = 'speed-streaks';
    this.mesh = new InstancedMesh(geo, this.material, this.max);
    geo.setAttribute('aStreak', new InstancedBufferAttribute(a, 4));
    this.mesh.frustumCulled = false;
    this.mesh.boundingSphere = new Sphere(new Vector3(), SPEED_FX.streakSpan);
    this.mesh.renderOrder = 8;
    this.mesh.name = 'speed-streaks';
  }

  setTier(p: Preset): void {
    this.mesh.count = SPEED_FX.streaks[p];
  }

  /** per frame: rail position (double), speed 0..1.5, user intensity 0..1, filament colour */
  update(playerS: number, speed01: number, amount: number, color: Color, camZ: number): void {
    const u = this.material.uniforms;
    u.uScroll.value = playerS % SPEED_FX.streakSpan;
    u.uSpeed.value = speed01;
    u.uAmount.value = amount;
    u.uColor.value.copy(color);
    u.uCamZ.value = camZ;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh.dispose();
  }
}
