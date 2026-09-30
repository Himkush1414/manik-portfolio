// 05 TEMPEST — Strike racer. Pod-and-boom: compact cockpit pod forward, twin
// booms sweeping back to ONE huge rear annular ion drive, short forward-swept
// wings. The negative space between the booms is its signature.
import type { ShipSpec, ZoneFn, HullSpec } from '../types';

const pod: ZoneFn = ({ y, z }) => (y < -0.1 ? 1 : z > 5.6 ? 3 : 0);
const boomZone: ZoneFn = ({ y, x }) => (y > 0.28 && Math.abs(x) < 0.1 ? 2 : y < -0.1 ? 1 : 0);
const wing: ZoneFn = ({ y, u, v }) => (y < -0.04 ? 1 : v > 0.82 ? 2 : u < 0.05 ? 3 : 0);

const boom: HullSpec = {
  rings: [
    { z: -7.4, w: 0.3, top: 0.3, bot: 0.3, n: 2.6 },
    { z: -6.6, w: 0.44, top: 0.46, bot: 0.4, n: 2.8 },
    { z: -5.0, w: 0.46, top: 0.5, bot: 0.4, n: 3.0, ridge: 0.14, ridgeW: 0.08 },
    { z: -3.2, w: 0.44, top: 0.46, bot: 0.38, n: 3.0, ridge: 0.12, ridgeW: 0.08 },
    { z: -1.4, w: 0.4, top: 0.42, bot: 0.36, n: 2.8 },
    { z: 0.4, w: 0.34, top: 0.36, bot: 0.3, n: 2.6 },
    { z: 1.4, w: 0.24, top: 0.26, bot: 0.22, n: 2.4 },
    { z: 2.0, w: 0.08, top: 0.08, bot: 0.08, n: 2.0 },
  ],
  stations: 60,
  radial: 32,
  grooves: [-4.2, -1.0],
  zone: boomZone,
};

export const TEMPEST: ShipSpec = {
  id: 'tempest',
  length: 15.2,
  hull: {
    rings: [
      { z: -2.2, w: 0.46, top: 0.42, bot: 0.4, n: 2.4 },
      { z: -1.6, w: 0.72, top: 0.62, bot: 0.52, n: 2.8 },
      { z: -0.6, w: 0.86, top: 0.76, bot: 0.58, n: 3.0 },
      { z: 0.6, w: 0.9, top: 0.84, bot: 0.58, n: 3.0 },
      { z: 1.8, w: 0.86, top: 0.8, bot: 0.55, n: 2.9 },
      { z: 2.9, w: 0.76, top: 0.68, bot: 0.5, n: 2.8 },
      { z: 3.9, w: 0.62, top: 0.52, bot: 0.44, n: 2.6 },
      { z: 4.8, w: 0.46, top: 0.38, bot: 0.34, n: 2.4 },
      { z: 5.6, w: 0.3, top: 0.24, bot: 0.22, n: 2.2 },
      { z: 6.3, w: 0.16, top: 0.12, bot: 0.12, n: 2.1 },
      { z: 6.8, w: 0.06, top: 0.05, bot: 0.05, n: 2.0 },
      { z: 7.1, w: 0.012, top: 0.012, bot: 0.012, n: 2.0 },
    ],
    stations: 90,
    radial: 60,
    grooves: [4.4, 2.3, -0.2],
    seams: [0.6, Math.PI - 0.6],
    zone: pod,
  },
  bodies: [{ hull: boom, offset: [2.35, 0.05, -0.4], mirror: true }],
  wings: [
    // strakes: pod -> booms
    { root: [0.72, -0.08, 1.2], tip: [2.3, -0.02, 0.9], rootChord: 2.6, tipChord: 2.3, thickness: 0.05, stations: 4, mirror: true, zone: wing },
    // short forward-swept wings on the booms
    { root: [2.6, -0.02, -2.0], tip: [5.0, 0.12, -0.9], rootChord: 2.6, tipChord: 1.1, thickness: 0.05, stations: 6, mirror: true, flapLine: 0.8, zone: wing },
    // yoke carrying the ion drive between the booms
    { root: [0.0, 0.1, -6.3], tip: [2.25, 0.1, -6.3], rootChord: 1.7, tipChord: 1.7, thickness: 0.09, stations: 3, mirror: true, zone: wing },
    // boom tail fins
    { root: [2.35, 0.45, -5.9], tip: [2.55, 1.7, -7.1], rootChord: 1.6, tipChord: 0.6, thickness: 0.05, stations: 3, mirror: true, vertical: true, zone: wing },
  ],
  engines: [{ pos: [0, 0.12, -8.1], radius: 1.35, length: 2.8, core: 'ion' }],
  pods: [
    { kind: 'cannon', pos: [2.35, -0.14, 1.9], length: 1.6, radius: 0.12, mirror: true },
    { kind: 'dome', pos: [0, -0.56, 1.2], length: 0.2, radius: 0.2, zone: 3 },
  ],
  canopy: { z0: 0.6, z1: 3.7, w: 0.58, h: 0.56, y: 0.62, frames: 2 },
  greebles: [{ seed: 91, count: 6, region: { z: [-1.8, 2.4], side: 'side' } }],
  navLights: [
    { pos: [-5.05, 0.12, -1.3], color: 'red' },
    { pos: [5.05, 0.12, -1.3], color: 'green' },
    { pos: [2.57, 1.74, -7.4], color: 'white' },
    { pos: [-2.57, 1.74, -7.4], color: 'white' },
  ],
  repulsors: [[2.35, -0.4, 0.2], [-2.35, -0.4, 0.2], [2.35, -0.4, -5.0], [-2.35, -0.4, -5.0]],
  hardpoints: [
    { id: 'boom-cannon-r', kind: 'cannon', pos: [2.35, -0.14, 3.5] },
    { id: 'boom-cannon-l', kind: 'cannon', pos: [-2.35, -0.14, 3.5] },
    { id: 'ion-drive', kind: 'engine', pos: [0, 0.12, -8.1] },
    { id: 'shield', kind: 'shield', pos: [0, -0.56, 1.2] },
    { id: 'rcs', kind: 'thruster', pos: [0.6, 0.3, 4.5] },
    { id: 'hull', kind: 'hull', pos: [0, 0.9, 0.6] },
  ],
  hoverHeight: 2.0,
};
