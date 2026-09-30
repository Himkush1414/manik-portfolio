// 02 VESPER — Interceptor. A needle: longest nose ratio of the six, narrow
// hard-swept wings with trailing-edge cut-outs, ONE oversized central engine
// with a long exhaust ring (the tail is the heaviest part), wing pylons, the
// lowest profile. Reads "fast and fragile".
import type { ShipSpec, ZoneFn } from '../types';

const hull: ZoneFn = ({ x, y, z }) => {
  if (y > 0.28 && Math.abs(x) < 0.07 && z > -6 && z < 0.4) return 2; // accent pinstripe
  if (y < -0.1) return 1;
  if (z > 6.4) return 3; // nose cone
  return 0;
};
const wing: ZoneFn = ({ y, u, v }) => (y < -0.06 ? 1 : v > 0.8 ? 2 : u < 0.05 ? 3 : 0);

export const VESPER: ShipSpec = {
  id: 'vesper',
  length: 15.4,
  hull: {
    rings: [
      { z: -7.2, w: 0.62, top: 0.46, bot: 0.44, n: 2.4 },
      { z: -6.2, w: 0.94, top: 0.6, bot: 0.52, n: 2.7 },
      { z: -4.6, w: 0.98, top: 0.54, bot: 0.46, n: 3.0, ridge: 0.14, ridgeW: 0.12 },
      { z: -2.6, w: 0.84, top: 0.46, bot: 0.38, n: 3.2, ridge: 0.12, ridgeW: 0.12 },
      { z: -0.6, w: 0.66, top: 0.42, bot: 0.32, n: 3.0 },
      { z: 1.2, w: 0.55, top: 0.44, bot: 0.3, n: 2.8 },
      { z: 2.8, w: 0.42, top: 0.36, bot: 0.26, n: 2.6 },
      { z: 4.2, w: 0.3, top: 0.24, bot: 0.2, n: 2.4 },
      { z: 5.6, w: 0.2, top: 0.16, bot: 0.14, n: 2.2 },
      { z: 6.8, w: 0.12, top: 0.1, bot: 0.09, n: 2.1 },
      { z: 7.6, w: 0.06, top: 0.05, bot: 0.05, n: 2.0 },
      { z: 8.2, w: 0.015, top: 0.015, bot: 0.015, n: 2.0 },
    ],
    stations: 130,
    radial: 60,
    grooves: [6.4, 3.4, 0.9, -1.8, -4.2],
    seams: [0.5, Math.PI - 0.5],
    zone: hull,
  },
  wings: [
    { root: [0.52, -0.06, -0.6], tip: [4.7, -0.14, -5.7], rootChord: 4.8, tipChord: 0.95, thickness: 0.04, stations: 12, mirror: true, cutout: { from: 0.32, to: 0.62, depth: 0.32 }, flapLine: 0.82, zone: wing },
    { root: [0.46, 0.34, -4.7], tip: [0.98, 1.55, -6.5], rootChord: 1.9, tipChord: 0.6, thickness: 0.05, stations: 6, mirror: true, vertical: true, zone: wing },
  ],
  engines: [{ pos: [0, 0.03, -7.95], radius: 0.8, length: 3.2, core: 'annular' }],
  pods: [
    { kind: 'pod', pos: [2.55, -0.3, -3.9], length: 2.3, radius: 0.15, mirror: true, zone: 3 },
    { kind: 'cannon', pos: [0.74, -0.1, -0.1], length: 2.0, radius: 0.08, mirror: true },
    { kind: 'dome', pos: [0, -0.32, -1.2], length: 0.2, radius: 0.16, zone: 3 },
  ],
  canopy: { z0: 0.35, z1: 2.7, w: 0.38, h: 0.38, y: 0.3, frames: 1 },
  greebles: [
    { seed: 71, count: 5, region: { z: [-5.8, -2.0], side: 'top' } },
    { seed: 72, count: 4, region: { z: [-5.8, -1.0], side: 'side' } },
  ],
  navLights: [
    { pos: [-4.75, -0.12, -6.2], color: 'red' },
    { pos: [4.75, -0.12, -6.2], color: 'green' },
    { pos: [1.0, 1.58, -6.9], color: 'white' },
    { pos: [-1.0, 1.58, -6.9], color: 'white' },
  ],
  repulsors: [[0, -0.34, 1.9], [0.5, -0.46, -4.4], [-0.5, -0.46, -4.4]],
  hardpoints: [
    { id: 'root-cannons', kind: 'cannon', pos: [0.74, -0.1, 1.9] },
    { id: 'engine', kind: 'engine', pos: [0, 0.03, -7.95] },
    { id: 'shield', kind: 'shield', pos: [0, -0.32, -1.2] },
    { id: 'rcs', kind: 'thruster', pos: [0.4, 0.2, 4.0] },
    { id: 'hull', kind: 'hull', pos: [0, 0.5, -2.0] },
  ],
  hoverHeight: 1.9,
};
