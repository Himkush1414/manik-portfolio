// Ship roster (brief §10 table). Shape/hardpoints live in ships/specs/*.ts;
// this file is the gameplay-facing data: stats, class, unlock requirements.

export const SHIP_IDS = ['halcyon', 'vesper', 'basilisk', 'nocturne', 'tempest', 'obsidian'] as const;
export type ShipId = (typeof SHIP_IDS)[number];

export type StatKey = 'spd' | 'agi' | 'arm' | 'shd' | 'fir';
export const STAT_KEYS: readonly StatKey[] = ['spd', 'agi', 'arm', 'shd', 'fir'];
export const STAT_LABEL: Record<StatKey, string> = { spd: 'SPD', agi: 'AGI', arm: 'ARM', shd: 'SHD', fir: 'FIR' };
export const STAT_NAME: Record<StatKey, string> = {
  spd: 'Speed',
  agi: 'Agility',
  arm: 'Armour',
  shd: 'Shields',
  fir: 'Firepower',
};

export type ShipInfo = {
  id: ShipId;
  index: number; // 01..06
  name: string;
  shortName: string;
  cls: string;
  tagline: string;
  stats: Record<StatKey, number>; // 0..10
  unlock: { level: number; credits: number } | null; // null = starter
  cockpit: 'light' | 'medium' | 'heavy';
};

export const SHIPS: Record<ShipId, ShipInfo> = {
  halcyon: {
    id: 'halcyon',
    index: 1,
    name: 'HALCYON',
    shortName: 'HALCYON',
    cls: 'Multirole',
    tagline: 'The wing’s namesake. Balanced, forgiving, lethal in steady hands.',
    stats: { spd: 6, agi: 6, arm: 6, shd: 5, fir: 6 },
    unlock: null,
    cockpit: 'medium',
  },
  vesper: {
    id: 'vesper',
    index: 2,
    name: 'VESPER',
    shortName: 'VESPER',
    cls: 'Interceptor',
    tagline: 'A needle with an engine. First in, first out, never still.',
    stats: { spd: 8, agi: 10, arm: 3, shd: 3, fir: 5 },
    unlock: { level: 10, credits: 6000 },
    cockpit: 'light',
  },
  basilisk: {
    id: 'basilisk',
    index: 3,
    name: 'BASILISK',
    shortName: 'BASILISK',
    cls: 'Heavy gunship',
    tagline: 'Armour first, questions never. It does not dodge; it endures.',
    stats: { spd: 3, agi: 3, arm: 10, shd: 8, fir: 9 },
    unlock: { level: 20, credits: 15000 },
    cockpit: 'heavy',
  },
  nocturne: {
    id: 'nocturne',
    index: 4,
    name: 'NOCTURNE',
    shortName: 'NOCTURNE',
    cls: 'Stealth striker',
    tagline: 'All facets, no signature. The Umbra never sees the first shot.',
    stats: { spd: 7, agi: 8, arm: 4, shd: 7, fir: 8 },
    unlock: { level: 30, credits: 28000 },
    cockpit: 'light',
  },
  tempest: {
    id: 'tempest',
    index: 5,
    name: 'TEMPEST',
    shortName: 'TEMPEST',
    cls: 'Strike racer',
    tagline: 'One ion drive with a pilot strapped to it. Built to outrun collapse.',
    stats: { spd: 10, agi: 7, arm: 5, shd: 4, fir: 6 },
    unlock: { level: 40, credits: 45000 },
    cockpit: 'medium',
  },
  obsidian: {
    id: 'obsidian',
    index: 6,
    name: 'OBSIDIAN CROWN',
    shortName: 'OBSIDIAN',
    cls: 'Dark flagship',
    tagline: 'Forged from the Veil itself. The dark, turned against the dark.',
    stats: { spd: 8, agi: 8, arm: 8, shd: 8, fir: 9 },
    unlock: { level: 50, credits: 80000 },
    cockpit: 'heavy',
  },
};

export const SHIP_LIST: readonly ShipInfo[] = SHIP_IDS.map(id => SHIPS[id]);

export function isShipId(v: unknown): v is ShipId {
  return typeof v === 'string' && (SHIP_IDS as readonly string[]).includes(v);
}
