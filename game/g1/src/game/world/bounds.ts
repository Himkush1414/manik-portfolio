// The boundary validator (Control / Camera / Boundary addendum; Creative Bible AC2.11): every chapter
// of a level must be bounded by REAL terrain — no invisible limit means the land itself has to frame
// the flight. Probes at >= `probesPerSecond` samples per second of flight (at the level's cruise
// speed), each casting lateral rays from the path line at three heights (path line, +b/2, -b/2 of the
// design envelope) out to `maxEscape` u. Fails when a ray escapes > maxEscape u with no wall (there is
// no lateral diegetic cap), or when the path centre is within `centreClear` u of terrain. Vertical
// escapes are always capped diegetically (the cloud deck / a canyon rim: sim ceiling), so only the
// lateral rays can fail. Pure; the level validator + tests + tools call it.
import { createFrame, type FlightPath } from './path';

export type BoundsOptions = { cruise: number; probesPerSecond?: number; maxEscape?: number; centreClear?: number; step?: number };
export type BoundsReport = {
  samples: number;
  /** stretches where a lateral ray escaped (s ranges, merged), worst escape side */
  escapes: { from: number; to: number; side: 'L' | 'R' | 'LR' }[];
  /** share of samples with BOTH walls within maxEscape (1 = fully framed) */
  framed: number;
  /** widest free half-width found (u, capped at maxEscape + 1 = open) and where */
  widest: { s: number; u: number };
  /** the path line's smallest clearance above terrain (u) and where */
  centre: { s: number; clear: number };
  ok: boolean;
};

export const BOUNDS_DEFAULTS = { probesPerSecond: 40, maxEscape: 160, centreClear: 6, step: 4 } as const;

export function validateBounds(p: FlightPath, ground: (s: number, u: number) => number, o: BoundsOptions): BoundsReport {
  const pps = o.probesPerSecond ?? BOUNDS_DEFAULTS.probesPerSecond, max = o.maxEscape ?? BOUNDS_DEFAULTS.maxEscape;
  const cc = o.centreClear ?? BOUNDS_DEFAULTS.centreClear, du = o.step ?? BOUNDS_DEFAULTS.step;
  const ds = Math.max(0.25, o.cruise / pps);
  const f = createFrame(), env = { a: 0, b: 0 };
  const escapes: BoundsReport['escapes'] = [];
  let samples = 0, framed = 0, widest = { s: 0, u: 0 }, centre = { s: 0, clear: Infinity };
  for (let s = 0; s < p.length; s += ds) {
    samples++;
    p.frameAt(s, f);
    p.envelopeAt(s, env);
    const above = (u: number, v: number) => f.py + f.ry * u + f.uy * v - ground(s, u);
    const c = above(0, 0);
    if (c < centre.clear) centre = { s, clear: c };
    // nearest wall each side at three heights; the side's free distance is the nearest of them
    const side = (dir: -1 | 1) => {
      let best = max + 1;
      for (const v of [0, env.b * 0.5, -env.b * 0.5]) {
        for (let u = du; u <= max; u += du) {
          if (above(dir * u, v) <= 0) {
            if (u < best) best = u;
            break;
          }
        }
      }
      return best;
    };
    const l = side(-1), r = side(1);
    const wide = Math.max(l, r);
    if (wide > widest.u) widest = { s, u: wide };
    if (l <= max && r <= max) framed++;
    else {
      const tag = l > max && r > max ? 'LR' : l > max ? 'L' : 'R';
      const last = escapes[escapes.length - 1];
      if (last && s - last.to <= ds * 1.5) {
        last.to = s;
        if (last.side !== tag) last.side = 'LR';
      } else escapes.push({ from: s, to: s, side: tag });
    }
  }
  return { samples, escapes, framed: framed / Math.max(1, samples), widest, centre, ok: escapes.length === 0 && centre.clear >= cc };
}
