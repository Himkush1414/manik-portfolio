// ShipSpec: a ship's shape, stats hook and hardpoints live ONLY here (brief §10).
// Units: 1 = 1 m. Ship frame: +z = nose (forward), +y = up, +x = starboard.

/** Hull cross-section key ring. Rings are Catmull-Rom interpolated along z. */
export type Ring = {
  z: number;
  w: number; // half-width
  top: number; // height above centre
  bot: number; // depth below centre
  n: number; // super-ellipse exponent (2 = ellipse, 4+ = boxy/hard)
  y?: number; // centre offset
  ridge?: number; // dorsal ridge height added along the centreline
  ridgeW?: number; // ridge half-width
  keel?: number; // ventral keel depth added along the centreline
};

/** Paint zones (brief §10): 0 primary, 1 secondary, 2 accent, 3 trim. */
export type Zone = 0 | 1 | 2 | 3;
export type ZoneFn = (p: { x: number; y: number; z: number; u: number; v: number }) => Zone;

export type HullSpec = {
  rings: Ring[];
  stations: number; // interpolated stations along the length
  radial: number; // points around each ring
  grooves?: number[]; // z positions of circumferential panel grooves
  seams?: number[]; // angles (rad, 0 = +x, PI/2 = top) of longitudinal seams
  zone: ZoneFn;
};

/** Faceted wing / fin / canard: root and tip leading-edge points + chords. */
export type WingSpec = {
  root: [number, number, number]; // leading-edge point at the root
  tip: [number, number, number];
  rootChord: number;
  tipChord: number;
  thickness: number; // max thickness as a fraction of chord
  stations?: number;
  mirror?: boolean; // add the mirrored (port) copy
  vertical?: boolean; // span runs up (fins): profile thickness along x
  foldLines?: number[]; // span fractions with a chordwise groove ("petal" panels)
  flapLine?: number; // chord fraction of the control-surface split (0 = none)
  cutout?: { from: number; to: number; depth: number }; // span-range notch in the trailing edge
  zone: ZoneFn;
};

export type EngineSpec = {
  pos: [number, number, number]; // nozzle exit centre
  radius: number;
  length: number;
  core: 'annular' | 'slit' | 'ion';
  scale?: [number, number]; // x/y squash (slit engines)
};

export type PodSpec = {
  // small lofted bodies: cannon pods, chin pods, weapon pods, domes
  kind: 'cannon' | 'pod' | 'dome' | 'turret' | 'intake';
  pos: [number, number, number];
  length: number;
  radius: number;
  mirror?: boolean;
  zone?: Zone;
};

export type CanopySpec = {
  z0: number; // rear
  z1: number; // front
  w: number;
  h: number;
  y: number; // base height
  frames: number; // cross bars
};

export type Hardpoint = { id: string; kind: 'cannon' | 'engine' | 'shield' | 'thruster' | 'hull'; pos: [number, number, number] };

export type ShipSpec = {
  id: string;
  length: number;
  hull: HullSpec;
  wings: WingSpec[];
  engines: EngineSpec[];
  pods: PodSpec[];
  canopy: CanopySpec;
  greebles: { seed: number; count: number; region: { z: [number, number]; side: 'top' | 'side' | 'bottom' } }[];
  navLights: { pos: [number, number, number]; color: 'red' | 'green' | 'white' }[];
  repulsors: [number, number, number][];
  hardpoints: Hardpoint[];
  /** extra emissive trim (e.g. NOCTURNE violet facet edges, OBSIDIAN fissures) */
  emissiveTrim?: 'none' | 'nebula-edges' | 'ember-fissures';
  hoverHeight: number;
};
