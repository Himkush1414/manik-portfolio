// Pure transaction rules for the profile store (no React, no side effects).
import type { ProfileData } from './schema';
import { MAX_TIER, nextTierCost, type TrackId } from '../data/upgrades';
import { unlockState } from '../data/unlocks';
import { SHIPS, type ShipId } from '../data/ships';

export type TxFail = { ok: false; reason: 'insufficient-credits' | 'maxed' | 'locked-level' | 'already-owned' | 'not-purchasable' };
export type TxOk = { ok: true; cost: number; next: Partial<ProfileData> };
export type TxResult = TxOk | TxFail;

export function applyUpgradePurchase(p: ProfileData, track: TrackId): TxResult {
  const tier = p.upgrades[track];
  if (tier >= MAX_TIER) return { ok: false, reason: 'maxed' };
  const cost = nextTierCost(tier);
  if (cost === null) return { ok: false, reason: 'maxed' };
  if (p.credits < cost) return { ok: false, reason: 'insufficient-credits' };
  return {
    ok: true,
    cost,
    next: { credits: p.credits - cost, upgrades: { ...p.upgrades, [track]: tier + 1 } },
  };
}

export function applyShipPurchase(p: ProfileData, ship: ShipId): TxResult {
  const req = SHIPS[ship].unlock;
  if (!req) return { ok: false, reason: 'not-purchasable' };
  const st = unlockState(ship, p);
  if (st.unlocked) return { ok: false, reason: 'already-owned' };
  if (!st.levelMet) return { ok: false, reason: 'locked-level' };
  if (!st.creditsMet) return { ok: false, reason: 'insufficient-credits' };
  return {
    ok: true,
    cost: req.credits,
    next: { credits: p.credits - req.credits, unlockedShips: [...p.unlockedShips, ship] },
  };
}
