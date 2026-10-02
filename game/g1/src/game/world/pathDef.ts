// PathDef (Phase 2R §4): the authored flight path through a world. Pure data
// + structural checks; the spline (centripetal Catmull-Rom -> 1 u arc-length
// LUT -> parallel-transport frame) and the curvature / clearance validators
// live in path.ts (W1). Rail space is unchanged: s = arc length along this
// path, x along R(s), y along U(s).

export type PathWaypoint = {
  /** world position on the ground plane (u) */
  x: number;
  z: number;
  /** altitude above the local ground (u): normal 25-80, SKIM 8-15 over water, passes 150-250 */
  clearance: number;
  /** flight envelope half-extents at this waypoint (lateral a, vertical b) */
  envA: number;
  envB: number;
  /** extra visual bank (deg), added to the curvature bank */
  bank: number;
  /** valley-floor altitude here (u); default PathDef.datum. The path flies at floor + clearance and
   *  the terrain builds its valley floor to the same profile. */
  floor?: number;
};

export type PathDef = {
  waypoints: readonly PathWaypoint[];
  /** cruise datum: ground reference altitude of the valley floor at s = 0 (u) */
  datum: number;
};

export const PATH_RULES = {
  /** min curvature radius = this x the terrain ribbon half-width at that s */
  curvatureFactor: 1.25,
  ribbonHalfWidth: 900,
  maxPitchDeg: 20,
  minClearance: 8,
  maxClearance: 260,
  /** envelope corners never within this of terrain */
  envelopeMargin: 3,
  minWaypointSpacing: 60,
} as const;

/** Structural checks that need no spline: count, spacing, clearance and envelope ranges. */
export function checkPathDef(p: PathDef): string[] {
  const e: string[] = [];
  const w = p.waypoints;
  if (w.length < 4) e.push('path: need >= 4 waypoints (Catmull-Rom end conditions)');
  for (let i = 0; i < w.length; i++) {
    const q = w[i];
    if (q.clearance < PATH_RULES.minClearance || q.clearance > PATH_RULES.maxClearance) e.push(`path[${i}]: clearance ${q.clearance} outside ${PATH_RULES.minClearance}-${PATH_RULES.maxClearance}`);
    if (q.envA <= 0 || q.envB <= 0) e.push(`path[${i}]: envelope must be positive`);
    if (i > 0) {
      const d = Math.hypot(q.x - w[i - 1].x, q.z - w[i - 1].z);
      if (d < PATH_RULES.minWaypointSpacing) e.push(`path[${i}]: ${d.toFixed(1)} u from the previous waypoint (< ${PATH_RULES.minWaypointSpacing})`);
    }
  }
  return e;
}
