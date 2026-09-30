// Upgrade tracks + combat rating (brief §14). Numbers are PROVISIONAL —
// Phase 2 tunes them and binds recommendedRating to real boss scaling.
import type { ShipId, StatKey } from './ships';
import { SHIPS } from './ships';

export const TRACK_IDS = ['cannons', 'capacitor', 'hull', 'shield', 'thrusters'] as const;
export type TrackId = (typeof TRACK_IDS)[number];
export const MAX_TIER = 5;
export const TIER_COSTS = [400, 840, 1760, 3700, 7800] as const; // cost of tier 1..5

export type TrackInfo = {
  id: TrackId;
  name: string;
  effect: string; // per-tier effect, human readable
  perTier: number; // fractional bonus per tier
  stat: StatKey; // which displayed stat it boosts
  hardpoint: 'cannon' | 'engine' | 'shield' | 'thruster' | 'hull';
};

export const TRACKS: Record<TrackId, TrackInfo> = {
  cannons: { id: 'cannons', name: 'PULSE CANNONS', effect: 'Damage +8% per tier', perTier: 0.08, stat: 'fir', hardpoint: 'cannon' },
  capacitor: { id: 'capacitor', name: 'CAPACITOR CORE', effect: 'Fire rate +7% per tier', perTier: 0.07, stat: 'fir', hardpoint: 'engine' },
  hull: { id: 'hull', name: 'HULL PLATING', effect: 'Max hull +10% per tier', perTier: 0.1, stat: 'arm', hardpoint: 'hull' },
  shield: { id: 'shield', name: 'SHIELD MATRIX', effect: 'Shield +12%, regen delay −5% per tier', perTier: 0.12, stat: 'shd', hardpoint: 'shield' },
  thrusters: { id: 'thrusters', name: 'VECTOR THRUSTERS', effect: 'Lateral speed & agility +6% per tier', perTier: 0.06, stat: 'agi', hardpoint: 'thruster' },
};

export type UpgradeTiers = Record<TrackId, number>;
export const EMPTY_TIERS: UpgradeTiers = { cannons: 0, capacitor: 0, hull: 0, shield: 0, thrusters: 0 };

export function nextTierCost(currentTier: number): number | null {
  return currentTier >= MAX_TIER ? null : TIER_COSTS[currentTier];
}

/** Effective 0..10+ stat values including upgrade bonuses (display + rating). */
export function effectiveStats(ship: ShipId, tiers: UpgradeTiers): Record<StatKey, number> {
  const base = SHIPS[ship].stats;
  const out = { ...base };
  for (const id of TRACK_IDS) {
    const t = TRACKS[id];
    out[t.stat] += base[t.stat] * t.perTier * tiers[id];
  }
  return out;
}

/** Combat rating: weighted stat sum scaled to ~100 for a stock HALCYON. */
export function computeCombatRating(profile: { upgrades: UpgradeTiers }, ship: ShipId): number {
  const s = effectiveStats(ship, profile.upgrades);
  const weighted = s.spd * 0.8 + s.agi * 0.9 + s.arm * 1.1 + s.shd * 1.0 + s.fir * 1.3;
  return Math.round(weighted * (100 / 30.6));
}

export const BOSS_LEVELS = [10, 20, 30, 40, 50] as const;

/** Recommended rating for the boss at (or after) `level`. */
export function recommendedRating(level: number): number {
  const boss = BOSS_LEVELS.find(b => b >= level) ?? 50;
  return Math.round(100 + (boss / 10 - 1) * 42 + (boss === 50 ? 20 : 0));
}

export type Verdict = 'UNDER-POWERED' | 'READY' | 'OVERPOWERED';
export function verdict(rating: number, recommended: number): Verdict {
  if (rating < recommended * 0.92) return 'UNDER-POWERED';
  if (rating > recommended * 1.25) return 'OVERPOWERED';
  return 'READY';
}
