// Livery definitions (brief §10). Colours are sRGB hex; finish selects the
// paint-shader branch. Zone order: primary, secondary, accent, trim.
import type { ShipId } from './ships';

export type Finish = 'matte' | 'satin' | 'pearl' | 'flake' | 'metal';

export type Livery = {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  trim: string;
  finish: Finish;
};

export const LIVERIES: readonly Livery[] = [
  { id: 'ignition', name: 'IGNITION', primary: '#46526E', secondary: '#1B2233', accent: '#FF5A1F', trim: '#B9C2D8', finish: 'satin' },
  { id: 'ghost', name: 'GHOST', primary: '#C9CED8', secondary: '#7D8594', accent: '#7FD1FF', trim: '#EEF1F6', finish: 'matte' },
  { id: 'void', name: 'VOID', primary: '#0F1016', secondary: '#1F1A33', accent: '#7B5BFF', trim: '#4B2A9E', finish: 'pearl' },
  { id: 'crimson', name: 'CRIMSON ACE', primary: '#6E0E17', secondary: '#E6DCC8', accent: '#FF8A3D', trim: '#2A0B0F', finish: 'flake' },
  { id: 'solar', name: 'SOLAR GOLD', primary: '#B89A63', secondary: '#101012', accent: '#FFE1C2', trim: '#3A2E1C', finish: 'pearl' },
];

/** OBSIDIAN CROWN exclusive 6th livery. */
export const EMBER_FORGE: Livery = {
  id: 'emberforge',
  name: 'EMBER FORGE',
  primary: '#0B0A0C',
  secondary: '#1A1216',
  accent: '#FF5A1F',
  trim: '#FFE1C2',
  finish: 'metal',
};

const NOCTURNE_ORDER: readonly Livery[] = [LIVERIES[2], LIVERIES[0], LIVERIES[1], LIVERIES[3], LIVERIES[4]];

export function liveriesFor(ship: ShipId): readonly Livery[] {
  // OBSIDIAN CROWN leads with its exclusive EMBER FORGE (its default look)
  // NOCTURNE leads with VOID (a stealth skin by default)
  if (ship === 'obsidian') return [EMBER_FORGE, ...LIVERIES];
  if (ship === 'nocturne') return NOCTURNE_ORDER;
  return LIVERIES;
}

export function clampLivery(ship: ShipId, index: number): number {
  const n = liveriesFor(ship).length;
  return Number.isInteger(index) && index >= 0 && index < n ? index : 0;
}
