// Where the flown ship's guns, wing tips and engines are (from its ShipSpec),
// in the conventions the mission uses. Ship models are built nose +z; in the
// mission the model is turned PI about y inside the player attitude group
// (nose -z). Rail space: x right, y up, forward +.
//   ship (hx, hy, hz) -> attitude group (-hx, hy, -hz) -> rail (-hx, hy, hz)
import type { ShipSpec } from '../../ships/types';
import { PLAYER } from '../../data/mission';

export type Vec3 = readonly [number, number, number];

/** The twin cannon muzzles (rail-space offsets, [left, right]) the sim fires from: the outermost
 *  off-centre cannon pair of the spec; a single off-centre cannon is mirrored; a ship with only
 *  centre-line guns falls back to the default pair. */
export function cannonMuzzles(spec: ShipSpec): [Vec3, Vec3] {
  let best: [number, number, number] | null = null;
  for (const h of spec.hardpoints) {
    if (h.kind !== 'cannon' || Math.abs(h.pos[0]) < 0.2) continue;
    if (!best || Math.abs(h.pos[0]) > Math.abs(best[0])) best = h.pos;
  }
  if (!best) return [PLAYER.muzzles[0], PLAYER.muzzles[1]];
  const x = Math.abs(best[0]);
  return [
    [-x, best[1], best[2]],
    [x, best[1], best[2]],
  ];
}

/** Trailing edge of the widest wing's tip, ship space ([starboard, port]). */
export function wingTips(spec: ShipSpec): [Vec3, Vec3] {
  let w = spec.wings[0];
  for (const c of spec.wings) if (!c.vertical && Math.abs(c.tip[0]) > Math.abs(w.tip[0])) w = c;
  const x = Math.abs(w.tip[0]), y = w.tip[1], z = w.tip[2] - w.tipChord * 0.5;
  return [
    [x, y, z],
    [-x, y, z],
  ];
}

/** Engine nozzle centres (ship space), for boost puffs. */
export function engineMounts(spec: ShipSpec): Vec3[] {
  const out: Vec3[] = [];
  for (const h of spec.hardpoints) if (h.kind === 'engine') out.push(h.pos);
  return out;
}
