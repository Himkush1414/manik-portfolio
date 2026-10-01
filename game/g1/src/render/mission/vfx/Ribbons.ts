// Engine ribbon trails from the two wing tips (brief §7 VISUALS). Each trail
// keeps a short history of wing-tip positions in RAIL space (x, y, s); the
// vertex shader turns them into a camera-facing strip with z = -(s -
// playerS), so the trail stays laid along the rail behind the ship while it
// banks, strafes and barrel-rolls. One draw for both trails; the CPU writes
// 2 x samples x 2 vertices per frame (no per-vertex maths on the CPU).
// Samples are taken on a fixed time spacing (frame-rate independent length);
// the head vertex always sits on the live wing tip.
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, DynamicDrawUsage, Mesh, ShaderMaterial, Sphere, Vector3, type Object3D } from 'three';
import { RIBBON } from '../../../data/vfx';
import { MISSION_ORIGIN } from '../../../scenes/sceneBridge';

const N = RIBBON.samples;
const _w = new Vector3();

export class Ribbons {
  readonly mesh: Mesh;
  private geo: BufferGeometry;
  private aP: BufferAttribute;
  private aN: BufferAttribute;
  /** history ring per trail: x, y, s (double precision on the CPU) */
  private hist = [new Float64Array(N * 3), new Float64Array(N * 3)];
  private head = 0;
  private acc = 0;
  private primed = false;
  private tips: (Object3D | null)[] = [null, null];
  private mat: ShaderMaterial;
  /** 0 cruise .. 1 boost (colour + brightness) */
  boost = 0;

  constructor() {
    const verts = 2 * N * 2;
    this.geo = new BufferGeometry();
    this.aP = new BufferAttribute(new Float32Array(verts * 3), 3).setUsage(DynamicDrawUsage);
    this.aN = new BufferAttribute(new Float32Array(verts * 3), 3).setUsage(DynamicDrawUsage);
    const side = new Float32Array(verts), along = new Float32Array(verts);
    const index: number[] = [];
    for (let t = 0; t < 2; t++) {
      for (let i = 0; i < N; i++) {
        const v = (t * N + i) * 2;
        side[v] = -1;
        side[v + 1] = 1;
        along[v] = along[v + 1] = i / (N - 1);
        if (i < N - 1) index.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
      }
    }
    this.geo.setAttribute('position', this.aP); // rail x, y, s
    this.geo.setAttribute('aNext', this.aN);
    this.geo.setAttribute('aSide', new BufferAttribute(side, 1));
    this.geo.setAttribute('aAlong', new BufferAttribute(along, 1));
    this.geo.setIndex(index);
    this.geo.boundingSphere = new Sphere(new Vector3(), 200);
    this.mat = new ShaderMaterial({
      uniforms: {
        uPlayerS: { value: 0 },
        uCol: { value: new Color(RIBBON.color) },
        uBoostCol: { value: new Color(RIBBON.boostColor) },
        uBoost: { value: 0 },
      },
      vertexShader: /* glsl */ `
        attribute vec3 aNext;
        attribute float aSide, aAlong;
        uniform float uPlayerS;
        varying float vAlong;
        varying float vSide;
        varying float vCam;
        vec3 toLocal(vec3 r) { return vec3(r.x, r.y, -(r.z - uPlayerS)); }
        void main() {
          vec3 p = toLocal(position);
          vec3 q = toLocal(aNext);
          vec3 w = (modelMatrix * vec4(p, 1.0)).xyz;
          vec3 dir = q - p;
          float dl = length(dir);
          dir = dl > 1e-4 ? dir / dl : vec3(0.0, 0.0, 1.0);
          vec3 side = cross(dir, normalize(cameraPosition - w));
          float sl = length(side);
          side = sl > 1e-4 ? side / sl : vec3(1.0, 0.0, 0.0);
          float width = ${RIBBON.width.toFixed(3)} * (1.0 - aAlong * 0.75);
          w += side * aSide * width;
          vCam = length(cameraPosition - w);
          vAlong = aAlong;
          vSide = aSide;
          gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uCol, uBoostCol;
        uniform float uBoost;
        varying float vAlong;
        varying float vSide;
        varying float vCam;
        void main() {
          float across = exp(-vSide * vSide * 2.5);
          float fade = pow(clamp(1.0 - vAlong, 0.0, 1.0), 1.8) * smoothstep(0.0, 0.06, vAlong + 0.02);
          vec3 c = mix(uCol * ${RIBBON.hdr.toFixed(2)}, uBoostCol * ${RIBBON.boostHdr.toFixed(2)}, uBoost);
          // never a bright band across the lens when a trail passes the camera
          float near = smoothstep(${RIBBON.camFade[0].toFixed(1)}, ${RIBBON.camFade[1].toFixed(1)}, vCam);
          gl_FragColor = vec4(c * across * fade * near, 1.0);
        }`,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      fog: false,
      toneMapped: false,
    });
    this.mat.name = 'engine-ribbons';
    this.mesh = new Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 8;
    this.mesh.name = 'engine-ribbons';
  }

  /** wing-tip markers (children of the ship model) */
  setTips(left: Object3D | null, right: Object3D | null): void {
    this.tips[0] = left;
    this.tips[1] = right;
    this.primed = false;
  }

  /** restart the trails at the current tips (mission start / retry) */
  reset(): void {
    this.primed = false;
  }

  /** Per frame, after the player attitude is final (matrices updated). */
  update(dt: number, playerS: number): void {
    const O = MISSION_ORIGIN;
    let push = false;
    this.acc += dt;
    if (this.acc >= RIBBON.every) {
      this.acc = Math.min(this.acc - RIBBON.every, RIBBON.every);
      push = true;
    }
    if (push) this.head = (this.head + 1) % N;
    for (let t = 0; t < 2; t++) {
      const tip = this.tips[t];
      if (!tip) continue;
      tip.getWorldPosition(_w);
      const x = _w.x - O[0], y = _w.y - O[1], s = playerS - (_w.z - O[2]);
      const h = this.hist[t];
      if (!this.primed) {
        // collapse the whole trail onto the tip (no smear from a previous run)
        for (let i = 0; i < N; i++) {
          h[i * 3] = x;
          h[i * 3 + 1] = y;
          h[i * 3 + 2] = s - i * 0.001;
        }
      } else {
        h[this.head * 3] = x;
        h[this.head * 3 + 1] = y;
        h[this.head * 3 + 2] = s;
      }
    }
    this.primed = true;
    // write the strip: vertex i of trail t = history sample (head - i)
    const P = this.aP.array as Float32Array, Q = this.aN.array as Float32Array;
    for (let t = 0; t < 2; t++) {
      const h = this.hist[t];
      for (let i = 0; i < N; i++) {
        const k = ((this.head - i + N) % N) * 3;
        const kn = i < N - 1 ? ((this.head - i - 1 + N) % N) * 3 : ((this.head - i + 1 + N) % N) * 3;
        const sign = i < N - 1 ? 1 : -1;
        const v = (t * N + i) * 2 * 3;
        for (let e = 0; e < 2; e++) {
          const o = v + e * 3;
          P[o] = h[k];
          P[o + 1] = h[k + 1];
          P[o + 2] = h[k + 2];
          // "next" = the older neighbour; for the last vertex mirror the previous direction
          Q[o] = sign > 0 ? h[kn] : 2 * h[k] - h[kn];
          Q[o + 1] = sign > 0 ? h[kn + 1] : 2 * h[k + 1] - h[kn + 1];
          Q[o + 2] = sign > 0 ? h[kn + 2] : 2 * h[k + 2] - h[kn + 2];
        }
      }
    }
    this.aP.needsUpdate = true;
    this.aN.needsUpdate = true;
    const u = this.mat.uniforms;
    u.uPlayerS.value = playerS;
    u.uBoost.value = this.boost;
  }

  dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
  }
}
