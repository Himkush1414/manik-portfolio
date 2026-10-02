// Mission space (Phase 2R §4): the mission root's axes are the PATH FRAME at
// the player (R right, U up, -T forward), its origin the player's path point
// (floating origin). Everything that lives in rail space (player, bolts,
// particles, trails, enemies) maps through the bending path; everything that
// lives in world space (terrain, sky, water, vegetation) is rotated into that
// frame each frame. So the player, the camera rigs and the ship attitude code
// keep working in a local frame while the world turns and climbs around them.
//
//   local = B^T (world - P)        world = P + B local       B = [R | U | -T]
//
// CPU users call `railToLocal` / `worldToLocal` / `placeWorld`; GPU users
// (particles, ribbons) include PATH_GLSL and read a static path texture
// (world P, R, U per metre, uploaded once per mission) + per-frame uniforms.
import { DataTexture, FloatType, Matrix3, NearestFilter, Quaternion, RGBAFormat, Vector3, Matrix4, type Object3D } from 'three';
import { createFrame, type FlightPath } from '../../game/world/path';

const TEX_W = 1024;
const _f = createFrame();
const _m4 = new Matrix4();

export const missionSpace = {
  path: null as FlightPath | null,
  /** player path point (world, doubles) */
  px: 0, py: 0, pz: 0,
  /** world -> local rotation (B^T) as rows, doubles */
  r: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  /** world -> local rotation as a quaternion (for world objects) */
  qInv: new Quaternion(),
  /** shader uniforms (shared objects: every material that includes PATH_GLSL references these) */
  uniforms: {
    uPathTex: { value: null as DataTexture | null },
    uPathP0: { value: new Vector3() },
    uPathB: { value: new Matrix3() },
    uPathLen: { value: 1 },
  },

  /** Bind a path (prepare): builds the static path texture once. */
  bind(path: FlightPath): void {
    this.path = path;
    const n = path.x.length;
    const rows = Math.ceil((n * 3) / TEX_W);
    const data = new Float32Array(TEX_W * rows * 4);
    for (let k = 0; k < n; k++) {
      path.frameAt(k, _f);
      const o = k * 12;
      data[o] = _f.px; data[o + 1] = _f.py; data[o + 2] = _f.pz;
      data[o + 4] = _f.rx; data[o + 5] = _f.ry; data[o + 6] = _f.rz;
      data[o + 8] = _f.ux; data[o + 9] = _f.uy; data[o + 10] = _f.uz;
    }
    const old = this.uniforms.uPathTex.value;
    const tex = new DataTexture(data, TEX_W, rows, RGBAFormat, FloatType);
    tex.minFilter = tex.magFilter = NearestFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    this.uniforms.uPathTex.value = tex;
    this.uniforms.uPathLen.value = path.length;
    old?.dispose();
    this.update(0);
  },

  /** Per frame (before anything is placed): the frame at the player's interpolated rail position. */
  update(s: number): void {
    const p = this.path;
    if (!p) return;
    p.frameAt(s, _f);
    this.px = _f.px; this.py = _f.py; this.pz = _f.pz;
    // rows of B^T = columns of B: R, U, -T
    const r = this.r;
    r[0] = _f.rx; r[1] = _f.ry; r[2] = _f.rz;
    r[3] = _f.ux; r[4] = _f.uy; r[5] = _f.uz;
    r[6] = -_f.tx; r[7] = -_f.ty; r[8] = -_f.tz;
    // Matrix3.set takes row-major: this IS B^T
    this.uniforms.uPathB.value.set(r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8]);
    this.uniforms.uPathP0.value.set(this.px, this.py, this.pz);
    _m4.set(r[0], r[1], r[2], 0, r[3], r[4], r[5], 0, r[6], r[7], r[8], 0, 0, 0, 0, 1);
    this.qInv.setFromRotationMatrix(_m4);
  },

  /** world point -> mission-local */
  worldToLocal(x: number, y: number, z: number, out: Vector3): Vector3 {
    const dx = x - this.px, dy = y - this.py, dz = z - this.pz, r = this.r;
    return out.set(r[0] * dx + r[1] * dy + r[2] * dz, r[3] * dx + r[4] * dy + r[5] * dz, r[6] * dx + r[7] * dy + r[8] * dz);
  },

  /** world direction -> mission-local */
  dirToLocal(x: number, y: number, z: number, out: Vector3): Vector3 {
    const r = this.r;
    return out.set(r[0] * x + r[1] * y + r[2] * z, r[3] * x + r[4] * y + r[5] * z, r[6] * x + r[7] * y + r[8] * z);
  },

  /** rail space (s, x right, y up) -> mission-local (exact, through the path) */
  railToLocal(s: number, x: number, y: number, out: Vector3): Vector3 {
    const p = this.path;
    if (!p) return out.set(x, y, 0);
    p.frameAt(s, _f);
    return this.worldToLocal(_f.px + _f.rx * x + _f.ux * y, _f.py + _f.ry * x + _f.uy * y, _f.pz + _f.rz * x + _f.uz * y, out);
  },

  /** rail-space velocity (vx, vy, vs) at s -> mission-local direction (not normalised) */
  railDirToLocal(s: number, vx: number, vy: number, vs: number, out: Vector3): Vector3 {
    const p = this.path;
    if (!p) return out.set(vx, vy, -vs);
    p.frameAt(s, _f);
    return this.dirToLocal(_f.rx * vx + _f.ux * vy + _f.tx * vs, _f.ry * vx + _f.uy * vy + _f.ty * vs, _f.rz * vx + _f.uz * vy + _f.tz * vs, out);
  },

  /** place an object whose geometry is in world units relative to the world point (x, y, z) */
  placeWorld(o: Object3D, x: number, y: number, z: number): void {
    this.worldToLocal(x, y, z, o.position);
    o.quaternion.copy(this.qInv);
  },
};

/** GLSL: rail (x, y, s) -> mission-local through the static path texture + per-frame uniforms */
export const PATH_GLSL = /* glsl */ `
uniform sampler2D uPathTex;
uniform vec3 uPathP0;
uniform mat3 uPathB;
uniform float uPathLen;
vec3 pathTexel(int k) {
  int w = textureSize(uPathTex, 0).x;
  return texelFetch(uPathTex, ivec2(k % w, k / w), 0).xyz;
}
vec3 railToLocal(vec3 r) {
  float s = clamp(r.z, 0.0, uPathLen - 1.001);
  float fi = floor(s);
  int i = int(fi) * 3;
  float f = s - fi;
  vec3 P = mix(pathTexel(i), pathTexel(i + 3), f);
  vec3 R = mix(pathTexel(i + 1), pathTexel(i + 4), f);
  vec3 U = mix(pathTexel(i + 2), pathTexel(i + 5), f);
  // uPathB is B^T; three uploads Matrix3 column-major, so in GLSL it IS B^T as written
  return uPathB * (P - uPathP0 + R * r.x + U * r.y);
}
`;
