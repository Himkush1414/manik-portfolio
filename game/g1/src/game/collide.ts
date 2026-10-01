// Swept collision (brief §5): bullets travel up to 380 u/s (6.3 u per step),
// so every test is a segment (the relative motion over the step) against a
// primitive — never a point test. All functions are allocation-free and work
// in coordinates RELATIVE to the target (callers subtract the target centre,
// which also keeps the double-precision rail s small).

/**
 * First contact parameter t in [0, 1] of the segment p0 -> p0 + d against a
 * sphere of radius r at the origin, or -1. Starting inside counts as t = 0.
 */
export function segSphere(px: number, py: number, pz: number, dx: number, dy: number, dz: number, r: number): number {
  const c = px * px + py * py + pz * pz - r * r;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy + dz * dz;
  if (a < 1e-12) return -1;
  const b = px * dx + py * dy + pz * dz;
  if (b > 0) return -1; // moving away
  const disc = b * b - a * c;
  if (disc < 0) return -1;
  const t = (-b - Math.sqrt(disc)) / a;
  return t >= 0 && t <= 1 ? t : -1;
}

/**
 * Segment p0 -> p0 + d against a capsule (segment A -> B, radius r), all
 * relative to the same origin. Returns the parameter of the closest approach
 * on the moving segment when within r, else -1 (conservative closest-points
 * test; capsules are the long bodies / tentacles / beam lances).
 */
export function segCapsule(
  px: number, py: number, pz: number, dx: number, dy: number, dz: number,
  ax: number, ay: number, az: number, bx: number, by: number, bz: number, r: number,
): number {
  // closest points between segments P(s) = p + s*d and Q(t) = a + t*(b - a)
  const ex = bx - ax, ey = by - ay, ez = bz - az;
  const wx = px - ax, wy = py - ay, wz = pz - az;
  const A = dx * dx + dy * dy + dz * dz;
  const B = dx * ex + dy * ey + dz * ez;
  const C = ex * ex + ey * ey + ez * ez;
  const D = dx * wx + dy * wy + dz * wz;
  const E = ex * wx + ey * wy + ez * wz;
  const den = A * C - B * B;
  let s = 0, t = 0;
  if (A < 1e-12) {
    s = 0;
    t = C > 1e-12 ? clamp01(E / C) : 0;
  } else if (C < 1e-12) {
    t = 0;
    s = clamp01(-D / A);
  } else {
    s = den > 1e-12 ? clamp01((B * E - C * D) / den) : 0;
    t = (B * s + E) / C;
    if (t < 0) {
      t = 0;
      s = clamp01(-D / A);
    } else if (t > 1) {
      t = 1;
      s = clamp01((B - D) / A);
    }
  }
  const cx = px + dx * s - (ax + ex * t), cy = py + dy * s - (ay + ey * t), cz = pz + dz * s - (az + ez * t);
  return cx * cx + cy * cy + cz * cz <= r * r ? s : -1;
}

/**
 * Segment against an axis-aligned box (half extents hx, hy, hz) centred at
 * the origin, inflated by r (OBB-lite: boxes are authored in the entity's
 * rail-aligned frame). Slab test; returns entry t in [0, 1] or -1.
 */
export function segBox(px: number, py: number, pz: number, dx: number, dy: number, dz: number, hx: number, hy: number, hz: number, r: number): number {
  slabT0 = 0;
  slabT1 = 1;
  if (!slab(px, dx, hx + r) || !slab(py, dy, hy + r) || !slab(pz, dz, hz + r)) return -1;
  return slabT0;
}

// slab-test state (module scope: no per-call closure / allocation)
let slabT0 = 0, slabT1 = 1;
function slab(p: number, d: number, h: number): boolean {
  if (Math.abs(d) < 1e-12) return p >= -h && p <= h;
  let a = (-h - p) / d, b = (h - p) / d;
  if (a > b) {
    const tmp = a;
    a = b;
    b = tmp;
  }
  if (a > slabT0) slabT0 = a;
  if (b < slabT1) slabT1 = b;
  return slabT0 <= slabT1;
}

/** Sphere vs sphere overlap (hazards vs player, pickups). */
export function sphereSphere(dx: number, dy: number, dz: number, r: number): boolean {
  return dx * dx + dy * dy + dz * dz <= r * r;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
