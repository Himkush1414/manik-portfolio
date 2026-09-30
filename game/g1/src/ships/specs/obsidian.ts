// 06 OBSIDIAN CROWN — Dark flagship (Dark Edition exclusive). Black obsidian-
// glass spear fuselage with molten Ignition fissures; a crown of five swept
// spikes (two wings, two canted tail spikes, one dorsal spike) radiating from
// the centre; shard fragments orbiting slowly; ember motes.
import type { ShipSpec, ZoneFn } from '../types';

const hull: ZoneFn = ({ y, z }) => (z > 7.4 ? 2 : y < -0.12 ? 1 : 0);
const spike: ZoneFn = ({ u, v }) => (v > 0.9 ? 2 : u < 0.04 ? 3 : 0);

export const OBSIDIAN: ShipSpec = {
  id: 'obsidian',
  length: 16.6,
  hull: {
    rings: [
      { z: -7.6, w: 0.5, top: 0.44, bot: 0.4, n: 2.2 },
      { z: -6.6, w: 0.86, top: 0.66, bot: 0.56, n: 2.6 },
      { z: -4.8, w: 1.02, top: 0.76, bot: 0.62, n: 2.9, ridge: 0.3, ridgeW: 0.1 },
      { z: -2.6, w: 1.06, top: 0.78, bot: 0.62, n: 3.0, ridge: 0.34, ridgeW: 0.1 },
      { z: -0.4, w: 0.96, top: 0.74, bot: 0.56, n: 2.9, ridge: 0.26, ridgeW: 0.1 },
      { z: 1.6, w: 0.78, top: 0.62, bot: 0.46, n: 2.7 },
      { z: 3.4, w: 0.58, top: 0.46, bot: 0.36, n: 2.5 },
      { z: 5.0, w: 0.4, top: 0.32, bot: 0.26, n: 2.3 },
      { z: 6.4, w: 0.24, top: 0.2, bot: 0.16, n: 2.2 },
      { z: 7.6, w: 0.12, top: 0.1, bot: 0.08, n: 2.1 },
      { z: 8.5, w: 0.05, top: 0.04, bot: 0.04, n: 2.0 },
      { z: 9.0, w: 0.01, top: 0.01, bot: 0.01, n: 2.0 },
    ],
    stations: 130,
    radial: 60,
    grooves: [5.6, 2.4, -0.9, -3.8],
    seams: [0.7, Math.PI - 0.7],
    zone: hull,
  },
  wings: [
    // crown spikes 1+2: long swept wing spikes
    { root: [0.7, 0.0, 1.2], tip: [7.4, 0.55, -6.2], rootChord: 3.8, tipChord: 0.22, thickness: 0.05, stations: 10, mirror: true, zone: spike },
    // spikes 3+4: canted tail spikes
    { root: [0.5, 0.42, -2.8], tip: [3.6, 4.3, -7.6], rootChord: 3.0, tipChord: 0.2, thickness: 0.05, stations: 8, mirror: true, vertical: true, zone: spike },
    // spike 5: dorsal crown spike
    { root: [0.0, 0.7, -1.2], tip: [0.0, 5.0, -6.9], rootChord: 3.2, tipChord: 0.2, thickness: 0.05, stations: 8, vertical: true, zone: spike },
  ],
  engines: [
    { pos: [0, 0.02, -8.05], radius: 0.6, length: 2.4, core: 'ion' },
    { pos: [0.95, -0.18, -7.1], radius: 0.34, length: 1.6, core: 'annular' },
    { pos: [-0.95, -0.18, -7.1], radius: 0.34, length: 1.6, core: 'annular' },
  ],
  pods: [{ kind: 'cannon', pos: [0.42, -0.24, 5.2], length: 2.4, radius: 0.1, mirror: true }],
  canopy: { z0: 2.3, z1: 4.8, w: 0.4, h: 0.36, y: 0.32, frames: 1 },
  greebles: [],
  navLights: [
    { pos: [-7.45, 0.55, -6.4], color: 'red' },
    { pos: [7.45, 0.55, -6.4], color: 'green' },
    { pos: [0, 5.05, -7.1], color: 'white' },
  ],
  repulsors: [[0.42, -0.5, 1.8], [-0.42, -0.5, 1.8], [0.6, -0.64, -4.6], [-0.6, -0.64, -4.6]],
  hardpoints: [
    { id: 'spear-cannons', kind: 'cannon', pos: [0.42, -0.24, 7.6] },
    { id: 'drive', kind: 'engine', pos: [0, 0.02, -8.05] },
    { id: 'shield', kind: 'shield', pos: [0, 0.9, -1.2] },
    { id: 'rcs', kind: 'thruster', pos: [0.4, 0.2, 5.8] },
    { id: 'hull', kind: 'hull', pos: [0, 0.8, -2.6] },
  ],
  emissiveTrim: 'ember-fissures',
  shards: { count: 9, radius: 4.8, seed: 66, y: 0.8 },
  hoverHeight: 2.4,
};
