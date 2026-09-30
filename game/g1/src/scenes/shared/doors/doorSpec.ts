// Blast-door dimensions (brief §9). 1 unit = 1 m. Panel local space: x runs
// from the seam (0) to the outer edge (+W), y from floor (0) up, z centred.
export const DOOR = {
  W: 9, // panel width
  H: 12,
  D: 0.9, // extrude depth (+ bevel => ~1.0-1.1 total)
  bevel: 0.05,
  seamGap: 0.015, // half of the 3 cm seam
  toothPitch: 1.2,
  toothDepth: 0.44,
  travel: 8.4,
  plates: { cols: 3, rows: 4, x0: 1.9, x1: 8.55, y0: 0.65, y1: 11.35, gap: 0.09, depth: 0.08, bevel: 0.04 },
  hazard: { x0: 0.5, x1: 1.72 },
  rivet: { radius: 0.034, inset: 0.1, spacing: 0.17 },
  frame: { outerX: 21, bottom: -2.2, top: 16.5, holeX: 9.05, holeTop: 13.7, depth: 2.4 },
  pistonY: [12.55, 13.2] as const,
} as const;
