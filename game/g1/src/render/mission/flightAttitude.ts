// Flight data geometry (Planet 1 §1.3 FLIGHT DATA): heading / pitch / bank in the PLANET frame (not the
// path frame the mission scene runs in), and pitch-ladder rungs placed on screen by exact projection
// through the live camera. Heading: 0 = north = world -Z, 90 = east = world +X. Frames: scene (mission
// local) = B^T world, with missionSpace.r = B^T as rows. Pure, allocation-free; unit-tested.
import { dirToScreen, type P2, type V3 } from './reticleMath';

export type Quat = { x: number; y: number; z: number; w: number };
const DEG = Math.PI / 180;

/** local (scene) direction -> world: w = B l (r = B^T as rows, so B's columns are r's rows) */
export function localToWorldDir(r: ArrayLike<number>, l: V3, out: V3): V3 {
  const x = r[0] * l.x + r[3] * l.y + r[6] * l.z;
  const y = r[1] * l.x + r[4] * l.y + r[7] * l.z;
  const z = r[2] * l.x + r[5] * l.y + r[8] * l.z;
  out.x = x;
  out.y = y;
  out.z = z;
  return out;
}

/** world direction -> local (scene): l = B^T w */
export function worldToLocalDir(r: ArrayLike<number>, w: V3, out: V3): V3 {
  const x = r[0] * w.x + r[1] * w.y + r[2] * w.z;
  const y = r[3] * w.x + r[4] * w.y + r[5] * w.z;
  const z = r[6] * w.x + r[7] * w.y + r[8] * w.z;
  out.x = x;
  out.y = y;
  out.z = z;
  return out;
}

/** rotate v by quaternion q (or its inverse) */
export function rotate(q: Quat, v: V3, inverse: boolean, out: V3): V3 {
  const qx = inverse ? -q.x : q.x, qy = inverse ? -q.y : q.y, qz = inverse ? -q.z : q.z, qw = q.w;
  // t = 2 (q.xyz x v); v' = v + w t + q.xyz x t
  const tx = 2 * (qy * v.z - qz * v.y), ty = 2 * (qz * v.x - qx * v.z), tz = 2 * (qx * v.y - qy * v.x);
  const x = v.x + qw * tx + (qy * tz - qz * ty);
  const y = v.y + qw * ty + (qz * tx - qx * tz);
  const z = v.z + qw * tz + (qx * ty - qy * tx);
  out.x = x;
  out.y = y;
  out.z = z;
  return out;
}

/** compass heading of a world direction (deg 0..360, 0 = north = -Z, 90 = east = +X) */
export function heading(w: V3): number {
  const h = Math.atan2(w.x, -w.z) / DEG;
  return h < 0 ? h + 360 : h;
}

/** elevation of a world direction above the horizon (deg) */
export function elevation(w: V3): number {
  return Math.asin(Math.max(-1, Math.min(1, w.y))) / DEG;
}

/**
 * bank of a body (deg, + = right wing down, i.e. rolled right) from its world forward and world right:
 * the angle of the right wing below the horizon, measured in the plane across the nose
 */
export function bankAngle(fw: V3, rt: V3): number {
  // up' = right x forward (the body's up); bank = atan2(-right.y, up'.y)
  const uy = rt.z * fw.x - rt.x * fw.z;
  return Math.atan2(-rt.y, uy) / DEG;
}

const _h: V3 = { x: 0, y: 0, z: 0 }, _d: V3 = { x: 0, y: 0, z: 0 }, _l: V3 = { x: 0, y: 0, z: 0 }, _c: V3 = { x: 0, y: 0, z: 0 };
const _q: P2 = { x: 0, y: 0, on: false };

/**
 * One pitch-ladder rung: the screen point of the direction at elevation `deg` on the camera's heading,
 * and the rung's screen angle (the horizon's direction there, rad, canvas convention). `camFwW` = the
 * camera's forward in WORLD axes, `r` = missionSpace.r, `camQ` = the camera's scene quaternion. Returns
 * false when the rung is behind the camera.
 */
export function rungOnScreen(deg: number, camFwW: V3, r: ArrayLike<number>, camQ: Quat, w: number, h: number, fov: number, out: { x: number; y: number; angle: number }): boolean {
  // horizontal heading of the camera (world)
  let hx = camFwW.x, hz = camFwW.z;
  const n = Math.hypot(hx, hz);
  if (n < 1e-6) return false;
  hx /= n;
  hz /= n;
  const e = deg * DEG, ce = Math.cos(e), se = Math.sin(e);
  // the rung's centre
  _h.x = ce * hx;
  _h.y = se;
  _h.z = ce * hz;
  rotate(camQ, worldToLocalDir(r, _h, _l), true, _c);
  dirToScreen(_c, w, h, fov, _q);
  if (!_q.on) return false;
  const x0 = _q.x, y0 = _q.y;
  // a point a little along the horizon to the right (world right of the heading = (-hz, 0, hx))
  const a = 2 * DEG, ca = Math.cos(a), sa = Math.sin(a);
  _d.x = ce * (ca * hx - sa * hz);
  _d.y = se;
  _d.z = ce * (ca * hz + sa * hx);
  rotate(camQ, worldToLocalDir(r, _d, _l), true, _c);
  dirToScreen(_c, w, h, fov, _q);
  out.x = x0;
  out.y = y0;
  out.angle = Math.atan2(_q.y - y0, _q.x - x0);
  return true;
}
