// Pilot bust specs (brief §13). Full-visor helmets carry identity through
// silhouette: ONYX broad + angular crest + heavy rig; EMBER sleek + rear fin +
// antenna, narrower shoulders, Ignition-trimmed suit.
export type PilotSpec = {
  id: 'onyx' | 'ember';
  shoulder: number; // half-width of the shoulder line
  pauldron: number; // pauldron radius
  chest: [number, number, number]; // torso ellipsoid radii
  rig: 'heavy' | 'light';
  helmet: { scale: [number, number, number]; crest: 'angular' | 'fin'; cheek: number };
  colors: { suit: string; armour: string; helmet: string; trim: string; strap: string };
};

export const PILOT_SPECS: Record<'onyx' | 'ember', PilotSpec> = {
  onyx: {
    id: 'onyx',
    shoulder: 0.43,
    pauldron: 0.175,
    chest: [0.4, 0.36, 0.25],
    rig: 'heavy',
    helmet: { scale: [1.04, 1.02, 1.1], crest: 'angular', cheek: 0.07 },
    colors: { suit: '#1a1f2b', armour: '#2b313e', helmet: '#3a4252', trim: '#8c9ac0', strap: '#12151c' },
  },
  ember: {
    id: 'ember',
    shoulder: 0.36,
    pauldron: 0.135,
    chest: [0.33, 0.33, 0.22],
    rig: 'light',
    helmet: { scale: [0.96, 1.0, 1.08], crest: 'fin', cheek: 0.05 },
    colors: { suit: '#1b1d27', armour: '#d6dae3', helmet: '#e3e6ee', trim: '#ff5a1f', strap: '#15171e' },
  },
};
