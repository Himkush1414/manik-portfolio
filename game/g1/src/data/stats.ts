// Player combat stats (brief §7): ShipSpec stats (1-10, data/ships.ts) +
// upgrade tiers (0-5, data/upgrades.ts) -> flight / weapon numbers the sim
// uses. Start values; the balance harness tunes them (DEV_NOTES P2 balance).
import { SHIPS, type ShipId } from './ships';
import type { UpgradeTiers } from './upgrades';
import { PLAYER } from './mission';

export const STAT_FORMULA = {
  hull: { base: 60, perArm: 8, perTier: 0.1 },
  shield: { base: 40, perShd: 8, perTier: 0.12 },
  lateral: { base: 18, perAgi: 1.6, perTier: 0.06 },
  damage: { base: 10, k0: 0.8, perFir: 0.05, perTier: 0.08 },
  fireRate: { base: 4.5, perFir: 0.35, perTier: 0.07 },
} as const;

export type PlayerStats = {
  maxHull: number;
  maxShield: number;
  shieldRegen: number;
  shieldDelay: number;
  lateralSpeed: number;
  accel: number;
  decel: number;
  damage: number;
  fireRate: number;
  boostMult: number;
};

export function playerStats(ship: ShipId, tiers: UpgradeTiers): PlayerStats {
  const s = SHIPS[ship].stats;
  const F = STAT_FORMULA;
  const lateralSpeed = (F.lateral.base + F.lateral.perAgi * s.agi) * (1 + F.lateral.perTier * tiers.thrusters);
  return {
    maxHull: (F.hull.base + F.hull.perArm * s.arm) * (1 + F.hull.perTier * tiers.hull),
    maxShield: (F.shield.base + F.shield.perShd * s.shd) * (1 + F.shield.perTier * tiers.shield),
    shieldRegen: PLAYER.shield.regen,
    shieldDelay: PLAYER.shield.delay * (1 - PLAYER.shield.delayPerTier * tiers.shield),
    lateralSpeed,
    accel: PLAYER.accel,
    decel: Math.max(PLAYER.accel, lateralSpeed / PLAYER.stopTime),
    damage: F.damage.base * (F.damage.k0 + F.damage.perFir * s.fir) * (1 + F.damage.perTier * tiers.cannons),
    fireRate: (F.fireRate.base + F.fireRate.perFir * s.fir) * (1 + F.fireRate.perTier * tiers.capacitor),
    boostMult: PLAYER.boost.base + PLAYER.boost.perSpd * s.spd,
  };
}
