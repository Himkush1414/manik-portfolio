// Muzzle flashes (brief §7 FIRE, §10 juice): one camera-facing star quad per
// cannon, parented to the player attitude group at the ship's real cannon
// hardpoints so it banks / rolls with the ship. Triggered by PlayerFire
// events (a = cannon index); intensity decays in ~60 ms. The star rotates
// randomly per shot (vfx stream) so rapid fire never looks stamped. The quads
// stay visible at intensity 0 (sliced compile only visits visible objects).
import { AdditiveBlending, Color, Group, Mesh, PlaneGeometry, ShaderMaterial } from 'three';
import { MUZZLE } from '../../../data/vfx';
import { HEX } from '../../palette';
import { vfxRng } from './gpu';

export class MuzzleFlash {
  readonly group = new Group();
  private meshes: Mesh[] = [];
  private mats: ShaderMaterial[] = [];
  private level = [0, 0];
  private geo = new PlaneGeometry(1, 1);
  /** cockpit view: smaller flashes (seen from right next to the guns) */
  scale = 1;

  constructor() {
    this.group.name = 'muzzle-flashes';
    for (let i = 0; i < 2; i++) {
      const mat = new ShaderMaterial({
        uniforms: { uI: { value: 0 }, uRot: { value: 0 }, uSize: { value: MUZZLE.size }, uCol: { value: new Color(HEX.core).multiplyScalar(MUZZLE.hdr) }, uHot: { value: new Color(HEX.hot).multiplyScalar(MUZZLE.hdr * 0.5) } },
        vertexShader: /* glsl */ `
          uniform float uSize;
          varying vec2 vUv;
          void main() {
            vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
            mv.xy += position.xy * uSize;
            vUv = position.xy * 2.0;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          uniform float uI, uRot;
          uniform vec3 uCol, uHot;
          varying vec2 vUv;
          void main() {
            float r = length(vUv);
            float a = (r > 1e-4 ? atan(vUv.y, vUv.x) : 0.0) + uRot; // atan(0, 0) is undefined
            float star = pow(abs(cos(a * 2.0)), 28.0) * max(0.0, 1.0 - r) + pow(abs(cos(a * 3.0 + 0.5)), 40.0) * max(0.0, 1.0 - r * 1.6) * 0.6;
            float glow = exp(-r * r * 9.0);
            vec3 c = uCol * (glow + star) + uHot * exp(-r * r * 3.0) * 0.5;
            gl_FragColor = vec4(c * uI, 1.0);
          }`,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        fog: false,
        toneMapped: false,
      });
      mat.name = 'muzzle-flash';
      const m = new Mesh(this.geo, mat);
      m.frustumCulled = false;
      m.renderOrder = 11;
      m.name = `muzzle-${i}`;
      this.meshes.push(m);
      this.mats.push(mat);
      this.group.add(m);
    }
  }

  /** muzzle positions in the player attitude group's space (x right, y up, -z forward) */
  setMuzzles(m: readonly (readonly [number, number, number])[]): void {
    for (let i = 0; i < 2; i++) {
      const p = m[Math.min(i, m.length - 1)];
      this.meshes[i].position.set(p[0], p[1], -p[2]);
    }
  }

  fire(cannon: number): void {
    const i = cannon & 1;
    this.level[i] = 1;
    this.mats[i].uniforms.uRot.value = vfxRng.next() * Math.PI;
  }

  update(dt: number): void {
    const k = Math.exp(-dt / MUZZLE.decay);
    for (let i = 0; i < 2; i++) {
      this.level[i] *= k;
      if (this.level[i] < 0.01) this.level[i] = 0;
      const u = this.mats[i].uniforms;
      u.uI.value = this.level[i];
      u.uSize.value = MUZZLE.size * this.scale * (0.75 + 0.25 * this.level[i]);
    }
  }

  clear(): void {
    this.level[0] = this.level[1] = 0;
    this.update(1);
  }

  dispose(): void {
    this.geo.dispose();
    this.mats.forEach(m => m.dispose());
  }
}
