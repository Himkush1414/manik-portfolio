// THE VEIL GATE (brief §6 set piece a): a giant rotating ring structure with
// a spiral vortex disc, beyond the launch bay mouth. The catapult flies the
// ship into it; the breach (flash + FOV punch + chromatic burst) hides the
// cut into the wormhole. Lit materials are standard PBR (the cockpit rig's
// lights); the vortex samples the tunnel's baked noise (no per-pixel fbm).
import { AdditiveBlending, BoxGeometry, CircleGeometry, Color, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, ShaderMaterial, TorusGeometry, type Texture } from 'three';
import { LAUNCH } from '../../../data/mission';
import { hdr } from '../../palette';

const FINS = 16;
const LAMPS = 32;

export class VeilGate {
  readonly group = new Group();
  private ring: Group;
  private inner: Mesh;
  private vortex: ShaderMaterial;
  private dispose_: (() => void)[] = [];

  constructor(noise: Texture, mood: { near: Color; mid: Color; far: Color; core: Color; fil: Color }) {
    const R = LAUNCH.gateRadius;
    this.group.name = 'veil-gate';
    this.ring = new Group();
    const metal = new MeshStandardMaterial({ color: '#2a303d', metalness: 0.85, roughness: 0.38, envMapIntensity: 0.6 });
    const torusGeo = new TorusGeometry(R + 4, 3.4, 14, 128);
    const outer = new Mesh(torusGeo, metal);
    const finGeo = new BoxGeometry(2.4, 13, 5);
    const fins = new InstancedMesh(finGeo, metal, FINS);
    const lampGeo = new BoxGeometry(1.2, 2.6, 1.2);
    const lampMat = new MeshBasicMaterial({ color: hdr('ignition', 3.2), toneMapped: false });
    const lamps = new InstancedMesh(lampGeo, lampMat, LAMPS);
    const m = new Matrix4();
    for (let i = 0; i < FINS; i++) {
      const a = (i / FINS) * Math.PI * 2;
      m.makeRotationZ(a - Math.PI / 2).setPosition(Math.cos(a) * (R + 10), Math.sin(a) * (R + 10), 0);
      fins.setMatrixAt(i, m);
    }
    for (let i = 0; i < LAMPS; i++) {
      const a = ((i + 0.5) / LAMPS) * Math.PI * 2;
      m.makeRotationZ(a).setPosition(Math.cos(a) * (R + 4), Math.sin(a) * (R + 4), 3.6);
      lamps.setMatrixAt(i, m);
    }
    this.ring.add(outer, fins, lamps);
    // inner emitter ring (counter-rotating, Ice)
    const innerGeo = new TorusGeometry(R, 0.55, 8, 160);
    const innerMat = new MeshBasicMaterial({ color: hdr('ice', 2.6), toneMapped: false });
    this.inner = new Mesh(innerGeo, innerMat);
    // vortex disc: log-spiral arms over the baked noise, HDR core
    const discGeo = new CircleGeometry(R, 128);
    this.vortex = new ShaderMaterial({
      uniforms: { tNoise: { value: noise }, uTime: { value: 0 }, uNear: { value: mood.near }, uMid: { value: mood.mid }, uFar: { value: mood.far }, uCore: { value: mood.core }, uFil: { value: mood.fil } },
      vertexShader: /* glsl */ `varying vec2 vP; void main(){ vP = position.xy / ${R.toFixed(1)}; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D tNoise;
        uniform float uTime;
        uniform vec3 uNear, uMid, uFar, uCore, uFil;
        varying vec2 vP;
        float thread(float n, float w) { float l = clamp(1.0 - abs(n - 0.5) * w, 0.0, 1.0); return l * l * l; }
        void main() {
          float r = max(length(vP), 1e-3);
          float a = atan(vP.y, vP.x);
          // log-spiral: arms wind inward and drift toward the centre over time
          vec2 uv = vec2(a / 6.2831853 * 3.0 + log(r) * 0.55, log(r) * 0.9 - uTime * 0.35);
          vec4 n = texture2D(tNoise, uv);
          float arms = smoothstep(0.3, 0.8, n.r);
          vec3 col = mix(uNear, uMid, arms) * (0.6 + arms);
          col = mix(col, uFar * 1.6, (1.0 - smoothstep(0.2, 0.75, r)) * 0.8);
          col += uFil * thread(n.g, 18.0) * 1.8 * (1.0 - smoothstep(0.85, 1.0, r) * 0.5);
          // event horizon rim + HDR core
          col += uFil * (1.0 - smoothstep(0.0, 0.06, abs(r - 0.97))) * 2.2;
          col += uCore * exp(-r * r * 22.0) * 7.0;
          gl_FragColor = vec4(col, 1.0);
        }`,
      fog: false,
      toneMapped: false,
    });
    this.vortex.name = 'veil-vortex';
    const disc = new Mesh(discGeo, this.vortex);
    disc.position.z = -1.5;
    // a soft additive halo around the ring
    const haloGeo = new CircleGeometry(R * 1.55, 96);
    const haloMat = new ShaderMaterial({
      uniforms: { uCol: { value: mood.mid } },
      vertexShader: /* glsl */ `varying vec2 vP; void main(){ vP = position.xy / ${(R * 1.55).toFixed(1)}; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `uniform vec3 uCol; varying vec2 vP; void main(){ float r = length(vP); float h = (1.0 - smoothstep(0.62, 1.0, r)) * smoothstep(0.55, 0.66, r); gl_FragColor = vec4(uCol * h * 1.4, 1.0); }`,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      fog: false,
      toneMapped: false,
    });
    const halo = new Mesh(haloGeo, haloMat);
    halo.position.z = -2;
    this.group.add(this.ring, this.inner, disc, halo);
    this.group.position.set(0, 0, LAUNCH.gateZ);
    this.group.visible = false;
    this.dispose_.push(() => {
      [torusGeo, finGeo, lampGeo, innerGeo, discGeo, haloGeo].forEach(g => g.dispose());
      [metal, lampMat, innerMat, this.vortex, haloMat].forEach(x => x.dispose());
      fins.dispose();
      lamps.dispose();
    });
  }

  update(t: number): void {
    this.ring.rotation.z = t * 0.12;
    this.inner.rotation.z = -t * 0.3;
    this.vortex.uniforms.uTime.value = t;
  }

  dispose(): void {
    this.dispose_.forEach(f => f());
    this.dispose_ = [];
  }
}
