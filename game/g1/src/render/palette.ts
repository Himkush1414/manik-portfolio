// Renderer-side mirror of ui/tokens.css (art bible §3). Colours are sRGB hex;
// THREE.Color converts them to linear working space on construction.
import { Color } from 'three';

export const HEX = {
  void: '#04050A',
  abyss: '#080B18',
  navy: '#0D1330',
  indigo: '#1A1F5C',
  violet: '#4B2A9E',
  nebula: '#7B5BFF',
  steel: '#8C9AC0',
  frost: '#E8ECFF',
  ignition: '#FF5A1F',
  hot: '#FF8A3D',
  core: '#FFE1C2',
  ice: '#7FD1FF',
  danger: '#FF2D55',
  ok: '#4DFFB0',
} as const;

export type PaletteKey = keyof typeof HEX;

/** Fresh THREE.Color for a palette key (callers own/mutate it freely). */
export function col(key: PaletteKey): Color {
  return new Color(HEX[key]);
}

/**
 * HDR emissive colour: palette colour scaled above 1.0 so only it crosses the
 * bloom luminance threshold (~1). Use with toneMapped=false materials.
 */
export function hdr(key: PaletteKey, intensity: number): Color {
  return new Color(HEX[key]).multiplyScalar(intensity);
}

/** Colour language (locked for all phases). */
export const ROLE = {
  friendly: 'ignition',
  friendlyCore: 'core',
  hostile: 'nebula',
  hostileHot: 'danger',
  hologram: 'ice',
  locked: 'ice',
} as const satisfies Record<string, PaletteKey>;
