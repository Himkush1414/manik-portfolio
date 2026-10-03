// Rail frame (brief §5): entities live in rail space — s (absolute distance
// along the tunnel axis, double), x (right), y (up). The renderer places them
// at z = -(s - playerS). Curvature is cosmetic only (render side); gameplay is
// straight. The player's lateral envelope is a soft BOX (Creative Bible AC2.1: the ship reaches the
// screen corners too — an ellipse capped a corner at 71 % of each axis).

/** Piecewise-linear curve lookup over [atM, value] keys (sorted by atM). */
export function curveAt(keys: readonly (readonly [number, number])[], atM: number): number {
  if (keys.length === 0) return 0;
  if (atM <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const k1 = keys[i];
    if (atM <= k1[0]) {
      const k0 = keys[i - 1];
      const t = (atM - k0[0]) / Math.max(1e-9, k1[0] - k0[0]);
      return k0[1] + (k1[1] - k0[1]) * t;
    }
  }
  return keys[keys.length - 1][1];
}

/** Normalised ellipse radius: 1 on the envelope boundary. */
export function ellipseR(x: number, y: number, a: number, b: number): number {
  return Math.sqrt((x * x) / (a * a) + (y * y) / (b * b));
}

/** Normalised box radius: 1 on the envelope boundary (max of |x| / a, |y| / b). */
export function envelopeR(x: number, y: number, a: number, b: number): number {
  return Math.max(Math.abs(x) / a, Math.abs(y) / b);
}

/** Envelope (a, b) at a rail position: piecewise segments [atM, a, b] (sorted). */
export function envelopeAt(segs: readonly (readonly [number, number, number])[], atM: number, out: { a: number; b: number }): { a: number; b: number } {
  let a = segs.length ? segs[0][1] : 18, b = segs.length ? segs[0][2] : 10.5;
  for (let i = 0; i < segs.length; i++) {
    if (segs[i][0] > atM) break;
    a = segs[i][1];
    b = segs[i][2];
  }
  out.a = a;
  out.b = b;
  return out;
}
