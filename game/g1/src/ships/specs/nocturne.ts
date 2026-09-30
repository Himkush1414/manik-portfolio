// 04 NOCTURNE — Stealth striker. A faceted flying wing: every surface planar,
// no curvature; buried slit engines; weapon-bay seams; Nebula-violet emissive
// edge strips tracing the facets. Silhouette: a flattened diamond / bat.
import type { ShipSpec, ZoneFn } from '../types';

const hull: ZoneFn = ({ y, z }) => (y < -0.05 ? 1 : z > 4.2 ? 3 : 0);
const wing: ZoneFn = ({ y, u }) => (y < -0.02 ? 1 : u < 0.04 ? 3 : 0);

export const NOCTURNE: ShipSpec = {
  id: 'nocturne',
  length: 11.2,
  hull: {
    rings: [
      { z: -5.4, w: 1.05, top: 0.36, bot: 0.3, n: 1.4 },
      { z: -4.6, w: 1.45, top: 0.5, bot: 0.38, n: 1.4 },
      { z: -3.4, w: 1.62, top: 0.62, bot: 0.44, n: 1.4 },
      { z: -2.0, w: 1.6, top: 0.72, bot: 0.46, n: 1.4 },
      { z: -0.6, w: 1.48, top: 0.76, bot: 0.44, n: 1.4 },
      { z: 0.8, w: 1.28, top: 0.74, bot: 0.4, n: 1.4 },
      { z: 2.0, w: 1.04, top: 0.64, bot: 0.34, n: 1.4 },
      { z: 3.0, w: 0.8, top: 0.5, bot: 0.28, n: 1.4 },
      { z: 3.9, w: 0.56, top: 0.34, bot: 0.22, n: 1.4 },
      { z: 4.6, w: 0.34, top: 0.2, bot: 0.14, n: 1.4 },
      { z: 5.2, w: 0.14, top: 0.08, bot: 0.06, n: 1.4 },
      { z: 5.6, w: 0.02, top: 0.02, bot: 0.02, n: 1.4 },
    ],
    stations: 24,
    radial: 8,
    grooves: [2.6, 0.2, -2.4],
    faceted: true,
    zone: hull,
  },
  wings: [
    { root: [0.9, -0.05, 3.9], tip: [7.6, -0.28, -4.2], rootChord: 9.3, tipChord: 1.1, thickness: 0.05, stations: 5, mirror: true, zone: wing },
    { root: [0.95, 0.35, -3.3], tip: [2.6, 1.4, -5.2], rootChord: 1.9, tipChord: 0.7, thickness: 0.05, stations: 3, mirror: true, vertical: true, zone: wing },
  ],
  engines: [
    { pos: [1.15, 0.08, -5.45], radius: 0.42, length: 1.6, core: 'slit', scale: [2.2, 0.32] },
    { pos: [-1.15, 0.08, -5.45], radius: 0.42, length: 1.6, core: 'slit', scale: [2.2, 0.32] },
  ],
  pods: [{ kind: 'dome', pos: [0, -0.46, -0.8], length: 0.2, radius: 0.2, zone: 3 }],
  canopy: { z0: 1.0, z1: 3.3, w: 0.46, h: 0.3, y: 0.44, frames: 1 },
  greebles: [],
  navLights: [
    { pos: [-7.65, -0.28, -4.9], color: 'red' },
    { pos: [7.65, -0.28, -4.9], color: 'green' },
  ],
  repulsors: [[1.1, -0.44, 1.6], [-1.1, -0.44, 1.6], [2.4, -0.4, -2.8], [-2.4, -0.4, -2.8]],
  hardpoints: [
    { id: 'bay-cannons', kind: 'cannon', pos: [0.6, -0.4, 2.0] },
    { id: 'engines', kind: 'engine', pos: [0, 0.08, -5.45] },
    { id: 'shield', kind: 'shield', pos: [0, -0.46, -0.8] },
    { id: 'rcs', kind: 'thruster', pos: [4.0, -0.1, -1.5] },
    { id: 'hull', kind: 'hull', pos: [0, 0.8, -1.0] },
  ],
  emissiveTrim: 'nebula-edges',
  wear: 0.35,
  hoverHeight: 1.8,
};
