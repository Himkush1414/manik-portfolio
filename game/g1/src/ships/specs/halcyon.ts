// 01 HALCYON — Multirole, the hero (brief §10). Design intent: DEV_NOTES §6.
// Wide arrowhead delta, shark nose + chin cannon pod, tall ridged dorsal spine
// with the Ignition stripe, forward-swept canards, twin canted rudders,
// wingtip cannons, twin annular engines, "petal" fold lines. ~14 u long,
// ~13 u span.
import type { ShipSpec, ZoneFn } from '../types';

const hullZone: ZoneFn = ({ x, y, z }) => {
  if (Math.abs(x) < 0.075 && y > 0.95 && z < 1.6 && z > -6.0) return 2; // Ignition spine stripe (crest of the ridge)
  if (y < -0.12) return 1; // underside
  if (Math.abs(y - 0.02) < 0.05) return 3; // chine trim line
  return 0;
};
const wingZone: ZoneFn = ({ y, u, v }) => {
  if (y < -0.02) return 1; // underside
  if (u < 0.045) return 3; // leading-edge trim
  if (v > 0.84 && u < 0.35) return 2; // tip accent chevron
  return 0;
};
const finZone: ZoneFn = ({ u, v }) => (v > 0.82 ? 2 : u < 0.05 ? 3 : 0);

export const HALCYON: ShipSpec = {
  id: 'halcyon',
  length: 14,
  hull: {
    rings: [
      // tail: tapers around the protruding nozzles
      { z: -6.7, w: 1.12, top: 0.52, bot: 0.5, n: 3.0, y: 0.08, ridge: 0.3, ridgeW: 0.18 },
      { z: -6.0, w: 1.5, top: 0.68, bot: 0.6, n: 3.8, y: 0.06, ridge: 0.62, ridgeW: 0.19 },
      { z: -4.8, w: 1.78, top: 0.76, bot: 0.66, n: 4.6, y: 0.05, ridge: 1.15, ridgeW: 0.15 },
      { z: -3.0, w: 1.9, top: 0.8, bot: 0.68, n: 5.0, y: 0.05, ridge: 1.35, ridgeW: 0.15 },
      { z: -1.0, w: 1.82, top: 0.86, bot: 0.66, n: 4.8, y: 0.05, ridge: 1.05, ridgeW: 0.15 },
      { z: 0.8, w: 1.55, top: 0.94, bot: 0.62, n: 4.2, y: 0.05, ridge: 0.38, ridgeW: 0.16 },
      { z: 2.4, w: 1.18, top: 0.9, bot: 0.58, n: 3.5, y: 0.05, ridge: 0.1, ridgeW: 0.2 },
      { z: 3.8, w: 0.9, top: 0.78, bot: 0.52, n: 3.0, y: 0.04 },
      { z: 5.0, w: 0.64, top: 0.52, bot: 0.42, n: 2.7, y: 0.02 },
      { z: 5.8, w: 0.46, top: 0.36, bot: 0.32, n: 2.4, y: 0.0 },
      { z: 6.45, w: 0.27, top: 0.21, bot: 0.2, n: 2.2, y: -0.02 },
      { z: 7.0, w: 0.03, top: 0.03, bot: 0.03, n: 2.0, y: -0.04 },
    ],
    stations: 120,
    radial: 76,
    grooves: [4.7, 3.3, 2.1, 0.2, -1.6, -3.4, -5.2],
    seams: [0.42, Math.PI - 0.42, Math.PI * 1.5],
    zone: hullZone,
  },
  wings: [
    // main arrowhead delta (starboard, mirrored)
    { root: [1.35, -0.02, 3.4], tip: [6.5, -0.1, -4.1], rootChord: 9.0, tipChord: 1.5, thickness: 0.045, stations: 14, mirror: true, foldLines: [0.3, 0.58], flapLine: 0.8, zone: wingZone },
    // forward-swept canards
    { root: [0.7, 0.22, 4.55], tip: [3.05, 0.3, 5.15], rootChord: 2.0, tipChord: 0.8, thickness: 0.06, stations: 6, mirror: true, zone: wingZone },
    // twin canted rudders
    { root: [1.05, 0.62, -3.1], tip: [2.25, 3.25, -5.6], rootChord: 3.2, tipChord: 1.2, thickness: 0.055, stations: 8, mirror: true, vertical: true, flapLine: 0.74, zone: finZone },
  ],
  engines: [
    { pos: [0.74, 0.1, -7.55], radius: 0.6, length: 2.6, core: 'annular' },
    { pos: [-0.74, 0.1, -7.55], radius: 0.6, length: 2.6, core: 'annular' },
  ],
  pods: [
    { kind: 'intake', pos: [1.02, -0.08, 1.9], length: 2.6, radius: 0.42, mirror: true, zone: 1 },
    { kind: 'pod', pos: [0, -0.52, 4.55], length: 1.9, radius: 0.24, zone: 1 },
    { kind: 'cannon', pos: [0, -0.56, 5.6], length: 1.1, radius: 0.12 },
    { kind: 'cannon', pos: [6.62, -0.1, -5.55], length: 3.2, radius: 0.15, mirror: true },
    { kind: 'dome', pos: [0, -0.64, 1.3], length: 0.3, radius: 0.24, zone: 3 },
  ],
  canopy: { z0: 2.25, z1: 4.6, w: 0.52, h: 0.5, y: 0.8, frames: 2 },
  greebles: [
    { seed: 11, count: 8, region: { z: [-5.4, 0.4], side: 'top' } },
    { seed: 23, count: 6, region: { z: [-5.6, -1.4], side: 'side' } },
    { seed: 37, count: 5, region: { z: [-4.0, 2.0], side: 'bottom' } },
  ],
  navLights: [
    { pos: [-6.55, 0.02, -5.5], color: 'red' },
    { pos: [6.55, 0.02, -5.5], color: 'green' },
    { pos: [2.22, 3.3, -6.45], color: 'white' },
    { pos: [-2.22, 3.3, -6.45], color: 'white' },
  ],
  repulsors: [
    [1.05, -0.7, 2.0],
    [-1.05, -0.7, 2.0],
    [1.3, -0.74, -4.0],
    [-1.3, -0.74, -4.0],
  ],
  hardpoints: [
    { id: 'chin-cannon', kind: 'cannon', pos: [0, -0.56, 6.7] },
    { id: 'wing-cannon-r', kind: 'cannon', pos: [6.62, -0.1, -2.35] },
    { id: 'wing-cannon-l', kind: 'cannon', pos: [-6.62, -0.1, -2.35] },
    { id: 'engine-r', kind: 'engine', pos: [0.74, 0.1, -7.55] },
    { id: 'engine-l', kind: 'engine', pos: [-0.74, 0.1, -7.55] },
    { id: 'shield', kind: 'shield', pos: [0, -0.64, 1.3] },
    { id: 'rcs', kind: 'thruster', pos: [0.8, 0.3, 4.2] },
    { id: 'hull', kind: 'hull', pos: [0, 1.2, -2.0] },
  ],
  hoverHeight: 2.1,
};
