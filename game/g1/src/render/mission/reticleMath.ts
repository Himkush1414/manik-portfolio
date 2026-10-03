// Tactical reticle geometry (Planet 1 §1.3): screen px <-> camera-space directions for a perspective
// camera, so the reticle's degree scale TRULY measures angle at any FOV / aspect / screen position. A
// point at `deg` off a direction d is d rotated by deg toward bearing phi, projected exactly (no
// small-angle or centre-of-screen approximation). Pure, allocation-free (callers pass the outputs);
// unit-tested.

export type V3 = { x: number; y: number; z: number };
export type P2 = { x: number; y: number; on: boolean };

const DEG = Math.PI / 180;

/** view frustum half-extents (tan of the half angles) for a vertical FOV in degrees */
export function halfTan(fovYDeg: number, aspect: number, out: { ty: number; tx: number }): { ty: number; tx: number } {
  out.ty = Math.tan((fovYDeg * DEG) / 2);
  out.tx = out.ty * aspect;
  return out;
}

/** CSS px (top-left origin) -> unit direction in camera space (-z forward, +y up) */
export function screenToDir(x: number, y: number, w: number, h: number, fovYDeg: number, out: V3): V3 {
  const ty = Math.tan((fovYDeg * DEG) / 2), tx = (ty * w) / h;
  const dx = ((2 * x) / w - 1) * tx, dy = (1 - (2 * y) / h) * ty;
  const n = 1 / Math.hypot(dx, dy, 1);
  out.x = dx * n;
  out.y = dy * n;
  out.z = -n;
  return out;
}

/** camera-space direction -> CSS px; on = in front of the camera */
export function dirToScreen(d: V3, w: number, h: number, fovYDeg: number, out: P2): P2 {
  const ty = Math.tan((fovYDeg * DEG) / 2), tx = (ty * w) / h;
  out.on = d.z < -1e-4;
  const iz = out.on ? -1 / d.z : 1e4;
  out.x = (d.x * iz / tx + 1) * 0.5 * w;
  out.y = (1 - (d.y * iz) / ty) * 0.5 * h;
  return out;
}

const _u: V3 = { x: 0, y: 0, z: 0 }, _v: V3 = { x: 0, y: 0, z: 0 }, _p: V3 = { x: 0, y: 0, z: 0 };

/**
 * The screen point `deg` degrees off the direction `d`, toward bearing `phi` (0 = screen right, pi/2 =
 * screen up): d rotated about the axis perpendicular to both, then projected.
 */
export function offsetPoint(d: V3, deg: number, phi: number, w: number, h: number, fovYDeg: number, out: P2): P2 {
  // basis on the view sphere at d: u = "screen right" (camera x made perpendicular to d), v = d x u ("up")
  let ux = 1 - d.x * d.x, uy = -d.x * d.y, uz = -d.x * d.z;
  const n = 1 / Math.hypot(ux, uy, uz);
  ux *= n;
  uy *= n;
  uz *= n;
  _u.x = ux;
  _u.y = uy;
  _u.z = uz;
  // v = u x d gives "up" for a -z forward camera (right x forward = up)
  _v.x = uy * d.z - uz * d.y;
  _v.y = uz * d.x - ux * d.z;
  _v.z = ux * d.y - uy * d.x;
  const a = deg * DEG, c = Math.cos(a), s = Math.sin(a), cp = Math.cos(phi), sp = Math.sin(phi);
  _p.x = c * d.x + s * (cp * _u.x + sp * _v.x);
  _p.y = c * d.y + s * (cp * _u.y + sp * _v.y);
  _p.z = c * d.z + s * (cp * _u.z + sp * _v.z);
  return dirToScreen(_p, w, h, fovYDeg, out);
}

/** angle between two unit directions (deg) */
export function angleBetween(a: V3, b: V3): number {
  return Math.acos(Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z))) / DEG;
}

/** azimuth / elevation of `a` relative to `b` in the camera's axes (deg; + = right / up) */
export function azEl(a: V3, b: V3, out: { az: number; el: number }): { az: number; el: number } {
  out.az = (Math.atan2(a.x, -a.z) - Math.atan2(b.x, -b.z)) / DEG;
  out.el = (Math.atan2(a.y, Math.hypot(a.x, a.z)) - Math.atan2(b.y, Math.hypot(b.x, b.z))) / DEG;
  return out;
}
