// Profile store: credits, unlocks, upgrades, selection. Every purchase is ONE
// atomic transaction: validate -> mutate -> emit (persistence follows via
// save.ts). Pure validators live in profileRules.ts (unit-tested).
import { create } from 'zustand';
import { DEFAULT_PROFILE, type ProfileData, type PilotId } from './schema';
import { EMPTY_TIERS, type TrackId } from '../data/upgrades';
import { SHIP_IDS, type ShipId } from '../data/ships';
import { clampLivery } from '../data/liveries';
import { bus } from '../core/bus';
import { applyShipPurchase, applyUpgradePurchase, type TxResult } from './profileRules';

type ProfileActions = {
  selectShip(id: ShipId): void;
  setLivery(ship: ShipId, index: number): void;
  setPilot(p: PilotId): void;
  purchaseUpgrade(track: TrackId): TxResult;
  purchaseShip(ship: ShipId): TxResult;
  grantCredits(n: number): void;
  unlockAll(): void;
  setLevelCleared(level: number): void;
  reset(): void;
  replace(data: ProfileData): void;
};

export type ProfileState = ProfileData & ProfileActions;

export const useProfile = create<ProfileState>()((set, get) => ({
  ...DEFAULT_PROFILE,
  selectShip: id => set({ selectedShip: id }),
  setLivery: (ship, index) => set(s => ({ liveryByShip: { ...s.liveryByShip, [ship]: clampLivery(ship, index) } })),
  setPilot: pilot => set({ pilot }),
  purchaseUpgrade: track => {
    const res = applyUpgradePurchase(get(), track);
    if (res.ok) {
      set(res.next);
      bus.emit('profile:purchase', { kind: 'upgrade', id: track, cost: res.cost });
    }
    return res;
  },
  purchaseShip: ship => {
    const res = applyShipPurchase(get(), ship);
    if (res.ok) {
      set(res.next);
      bus.emit('profile:purchase', { kind: 'ship', id: ship, cost: res.cost });
      bus.emit('profile:unlock', { shipId: ship });
    }
    return res;
  },
  grantCredits: n => set(s => ({ credits: Math.max(0, Math.round(s.credits + n)) })),
  unlockAll: () => set({ unlockedShips: [...SHIP_IDS] }),
  setLevelCleared: level => set({ highestLevelCleared: Math.max(0, Math.min(50, Math.round(level))) }),
  reset: () => set({ ...DEFAULT_PROFILE, upgrades: { ...EMPTY_TIERS }, liveryByShip: {}, unlockedShips: ['halcyon'], bossesDefeated: [] }),
  replace: data => set({ ...data }),
}));

export function profileSnapshot(): ProfileData {
  const p = useProfile.getState();
  return {
    credits: p.credits,
    highestLevelCleared: p.highestLevelCleared,
    bossesDefeated: p.bossesDefeated,
    unlockedShips: p.unlockedShips,
    upgrades: p.upgrades,
    selectedShip: p.selectedShip,
    liveryByShip: p.liveryByShip,
    pilot: p.pilot,
  };
}
