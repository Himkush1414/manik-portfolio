// World registry (Phase 2R §3 / §20): the twelve worlds in order, the
// level -> world mapping (world = ceil(level * 12 / 50)), lookups.
import type { WorldDef } from './types';
import { ARDEN } from './arden';
import { KHARAN } from './kharan';
import { STORMWARD } from './stormward';
import { AURELIA, CINDER, GLASSFIELD, HALDERN, HOLLOW_CROWN, MAW, OSSUARY, SPOREFALL, VANTA } from './designed';

export const WORLDS: readonly WorldDef[] = [ARDEN, CINDER, KHARAN, HALDERN, SPOREFALL, STORMWARD, OSSUARY, AURELIA, GLASSFIELD, VANTA, MAW, HOLLOW_CROWN];

/** world number (1..12) for a level (1..50) */
export function worldNumberForLevel(level: number): number {
  return Math.min(12, Math.max(1, Math.ceil((level * 12) / 50)));
}

export function worldForLevel(level: number): WorldDef {
  return WORLDS[worldNumberForLevel(level) - 1];
}

export function worldById(id: string): WorldDef | null {
  return WORLDS.find(w => w.id === id) ?? null;
}

/** "ARDEN - MARROW VALLEY" (the arrival banner) */
export function worldTitle(w: WorldDef): string {
  return `${w.name} - ${w.region}`;
}
