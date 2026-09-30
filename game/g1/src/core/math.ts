// Small scalar helpers. Hot paths use these instead of allocating.

export const clamp = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v);
export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const invLerp = (a: number, b: number, v: number) => (b === a ? 0 : (v - a) / (b - a));
export const remap = (v: number, a0: number, a1: number, b0: number, b1: number) =>
  lerp(b0, b1, clamp01(invLerp(a0, a1, v)));
export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp01(invLerp(a, b, v));
  return t * t * (3 - 2 * t);
};
export const DEG = Math.PI / 180;

/** Frame-rate independent exponential smoothing factor. */
export const damp = (lambda: number, dt: number) => 1 - Math.exp(-lambda * dt);

/** Super-ellipse radius at angle theta (|x/a|^n + |y/b|^n = 1). */
export function superEllipse(theta: number, a: number, b: number, n: number): [number, number] {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const e = 2 / n;
  const x = a * Math.sign(c) * Math.pow(Math.abs(c), e);
  const y = b * Math.sign(s) * Math.pow(Math.abs(s), e);
  return [x, y];
}
