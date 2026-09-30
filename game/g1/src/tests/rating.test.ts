import { describe, expect, it } from 'vitest';
import { computeCombatRating, recommendedRating, verdict, effectiveStats, EMPTY_TIERS } from '../data/upgrades';

describe('combat rating', () => {
  it('stock HALCYON rates ~100', () => {
    expect(computeCombatRating({ upgrades: EMPTY_TIERS }, 'halcyon')).toBeGreaterThanOrEqual(95);
    expect(computeCombatRating({ upgrades: EMPTY_TIERS }, 'halcyon')).toBeLessThanOrEqual(105);
  });
  it('upgrades strictly increase rating and effective stats', () => {
    const full = { cannons: 5, capacitor: 5, hull: 5, shield: 5, thrusters: 5 };
    expect(computeCombatRating({ upgrades: full }, 'halcyon')).toBeGreaterThan(computeCombatRating({ upgrades: EMPTY_TIERS }, 'halcyon'));
    expect(effectiveStats('halcyon', full).arm).toBeCloseTo(6 * 1.5);
  });
  it('recommended rating rises with each boss and verdicts bracket it', () => {
    const r = [10, 20, 30, 40, 50].map(recommendedRating);
    for (let i = 1; i < r.length; i++) expect(r[i]).toBeGreaterThan(r[i - 1]);
    expect(recommendedRating(1)).toBe(recommendedRating(10));
    expect(verdict(80, 100)).toBe('UNDER-POWERED');
    expect(verdict(100, 100)).toBe('READY');
    expect(verdict(140, 100)).toBe('OVERPOWERED');
  });
});
