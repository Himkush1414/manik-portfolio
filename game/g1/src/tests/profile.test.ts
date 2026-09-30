import { describe, expect, it } from 'vitest';
import { applyUpgradePurchase, applyShipPurchase } from '../state/profileRules';
import { DEFAULT_PROFILE, type ProfileData } from '../state/schema';
import { unlockState } from '../data/unlocks';
import { TIER_COSTS, EMPTY_TIERS } from '../data/upgrades';

const base = (patch: Partial<ProfileData> = {}): ProfileData => ({ ...DEFAULT_PROFILE, upgrades: { ...EMPTY_TIERS }, ...patch });

describe('atomic upgrade purchase', () => {
  it('charges the next tier cost and raises exactly one tier', () => {
    const r = applyUpgradePurchase(base({ credits: 1000 }), 'hull');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.cost).toBe(TIER_COSTS[0]);
    expect(r.next.credits).toBe(1000 - TIER_COSTS[0]);
    expect(r.next.upgrades!.hull).toBe(1);
    expect(r.next.upgrades!.cannons).toBe(0);
  });
  it('rejects without mutating when credits are short', () => {
    const p = base({ credits: 399 });
    const r = applyUpgradePurchase(p, 'hull');
    expect(r).toEqual({ ok: false, reason: 'insufficient-credits' });
    expect(p.credits).toBe(399);
  });
  it('rejects a maxed track', () => {
    const r = applyUpgradePurchase(base({ credits: 1e6, upgrades: { ...EMPTY_TIERS, shield: 5 } }), 'shield');
    expect(r).toEqual({ ok: false, reason: 'maxed' });
  });
  it('tier costs follow the table in order', () => {
    let p = base({ credits: 1e6 });
    const paid: number[] = [];
    for (let i = 0; i < 5; i++) {
      const r = applyUpgradePurchase(p, 'cannons');
      if (!r.ok) throw new Error('unexpected');
      paid.push(r.cost);
      p = { ...p, ...r.next };
    }
    expect(paid).toEqual([...TIER_COSTS]);
    expect(p.upgrades.cannons).toBe(5);
  });
});

describe('ship unlocks (level AND credits)', () => {
  it('starter is unlocked and not purchasable', () => {
    expect(unlockState('halcyon', base()).unlocked).toBe(true);
    expect(applyShipPurchase(base(), 'halcyon')).toEqual({ ok: false, reason: 'not-purchasable' });
  });
  it('requires the level even with enough credits', () => {
    const p = base({ credits: 1e6, highestLevelCleared: 9 });
    expect(unlockState('vesper', p).canPurchase).toBe(false);
    expect(applyShipPurchase(p, 'vesper')).toEqual({ ok: false, reason: 'locked-level' });
  });
  it('requires the credits even with the level cleared', () => {
    const p = base({ credits: 5999, highestLevelCleared: 10 });
    expect(applyShipPurchase(p, 'vesper')).toEqual({ ok: false, reason: 'insufficient-credits' });
  });
  it('purchases atomically when both are met', () => {
    const p = base({ credits: 7000, highestLevelCleared: 12 });
    const r = applyShipPurchase(p, 'vesper');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.next.credits).toBe(1000);
    expect(r.next.unlockedShips).toEqual(['halcyon', 'vesper']);
    expect(applyShipPurchase({ ...p, ...r.next }, 'vesper')).toEqual({ ok: false, reason: 'already-owned' });
  });
  it('reports clamped progress for the mini progress lines', () => {
    const st = unlockState('basilisk', base({ credits: 1200, highestLevelCleared: 3 }));
    expect(st.level).toEqual({ need: 20, have: 3 });
    expect(st.credits).toEqual({ need: 15000, have: 1200 });
  });
});
