// 03 BASILISK — Heavy gunship. A wide, flat armoured wedge; blunt prow with a
// heavy brow ridge over the canopy; thick straight wings with big weapon pods;
// 2x2 engine cluster; dorsal turret; hazard-striped armour plates. Reads heavy
// from any angle: widest, least swept.
import type { ShipSpec, ZoneFn } from '../types';

const hull: ZoneFn = ({ x, y, z }) => {
  // shoulder armour plates: dark plate with an accent leading band
  if (Math.abs(x) > 1.5 && y > 0.45 && z > -4.2 && z < -0.6) return z > -1.3 ? 2 : 1;
  if (y < -0.2) return 1;
  if (z > 5.6) return 1; // armoured prow cap
  return 0;
};
const wing: ZoneFn = ({ y, u, v }) => (y < -0.05 ? 1 : v > 0.86 ? 2 : u < 0.06 ? 3 : 0);

export const BASILISK: ShipSpec = {
  id: 'basilisk',
  length: 12.6,
  hull: {
    rings: [
      { z: -6.3, w: 2.1, top: 0.95, bot: 0.8, n: 6 },
      { z: -5.5, w: 2.5, top: 1.1, bot: 0.9, n: 7 },
      { z: -3.6, w: 2.62, top: 1.2, bot: 0.95, n: 7.5, ridge: 0.22, ridgeW: 0.5 },
      { z: -1.6, w: 2.58, top: 1.25, bot: 0.95, n: 7.5, ridge: 0.28, ridgeW: 0.5 },
      { z: 0.4, w: 2.38, top: 1.3, bot: 0.9, n: 7 },
      { z: 1.9, w: 2.08, top: 1.38, bot: 0.86, n: 6.5 },
      { z: 3.1, w: 1.84, top: 1.02, bot: 0.8, n: 6 },
      { z: 4.1, w: 1.62, top: 0.88, bot: 0.76, n: 5.5 },
      { z: 4.9, w: 1.48, top: 0.72, bot: 0.7, n: 5 },
      { z: 5.5, w: 1.32, top: 0.52, bot: 0.56, n: 4.5 },
      { z: 5.95, w: 1.02, top: 0.32, bot: 0.38, n: 4 },
      { z: 6.15, w: 0.6, top: 0.14, bot: 0.2, n: 3 },
    ],
    stations: 90,
    radial: 72,
    grooves: [4.5, 2.6, 0.9, -0.8, -2.5, -4.3],
    seams: [0.25, Math.PI - 0.25, Math.PI * 1.5, Math.PI / 2],
    zone: hull,
  },
  wings: [
    { root: [2.35, -0.05, 1.3], tip: [5.7, -0.1, 0.55], rootChord: 4.5, tipChord: 3.5, thickness: 0.085, stations: 6, mirror: true, flapLine: 0.8, zone: wing },
    { root: [1.55, 0.95, -4.4], tip: [1.95, 2.2, -5.5], rootChord: 2.0, tipChord: 0.95, thickness: 0.07, stations: 4, mirror: true, vertical: true, zone: wing },
  ],
  engines: [
    { pos: [0.72, 0.42, -6.8], radius: 0.46, length: 2.1, core: 'annular' },
    { pos: [-0.72, 0.42, -6.8], radius: 0.46, length: 2.1, core: 'annular' },
    { pos: [0.72, -0.34, -6.8], radius: 0.46, length: 2.1, core: 'annular' },
    { pos: [-0.72, -0.34, -6.8], radius: 0.46, length: 2.1, core: 'annular' },
  ],
  pods: [
    { kind: 'pod', pos: [5.75, -0.15, -0.9], length: 5.0, radius: 0.62, mirror: true, zone: 1 },
    { kind: 'cannon', pos: [5.75, -0.15, 1.5], length: 2.1, radius: 0.2, mirror: true },
    { kind: 'turret', pos: [0, 1.5, -1.9], length: 2.4, radius: 0.78, zone: 1 },
    { kind: 'cannon', pos: [0.7, -0.62, 5.6], length: 1.2, radius: 0.14, mirror: true },
  ],
  canopy: { z0: 2.2, z1: 4.4, w: 0.66, h: 0.46, y: 0.86, frames: 2 },
  greebles: [
    { seed: 81, count: 12, region: { z: [-5.6, 1.5], side: 'top' } },
    { seed: 82, count: 8, region: { z: [-5.8, 0.0], side: 'side' } },
    { seed: 83, count: 6, region: { z: [-4.0, 3.0], side: 'bottom' } },
  ],
  navLights: [
    { pos: [-5.75, 0.35, -3.1], color: 'red' },
    { pos: [5.75, 0.35, -3.1], color: 'green' },
    { pos: [1.98, 2.25, -5.9], color: 'white' },
    { pos: [-1.98, 2.25, -5.9], color: 'white' },
  ],
  repulsors: [[1.6, -0.92, 2.6], [-1.6, -0.92, 2.6], [1.9, -0.96, -4.2], [-1.9, -0.96, -4.2]],
  hardpoints: [
    { id: 'pod-cannon-r', kind: 'cannon', pos: [5.75, -0.15, 3.1] },
    { id: 'pod-cannon-l', kind: 'cannon', pos: [-5.75, -0.15, 3.1] },
    { id: 'turret', kind: 'cannon', pos: [0, 1.5, -1.9] },
    { id: 'engine-cluster', kind: 'engine', pos: [0, 0.04, -6.8] },
    { id: 'shield', kind: 'shield', pos: [0, 1.4, -3.6] },
    { id: 'rcs', kind: 'thruster', pos: [2.2, 0.6, 3.4] },
    { id: 'hull', kind: 'hull', pos: [2.3, 1.1, -2.2] },
  ],
  hoverHeight: 2.4,
};
