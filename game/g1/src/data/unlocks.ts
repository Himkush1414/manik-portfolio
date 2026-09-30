// Ship unlock rules (brief §10: BOTH level cleared AND credits required).
import { SHIPS, type ShipId } from './ships';

export type UnlockState = {
  unlocked: boolean;
  levelMet: boolean;
  creditsMet: boolean;
  canPurchase: boolean;
  level: { need: number; have: number } | null;
  credits: { need: number; have: number } | null;
};

export function unlockState(
  ship: ShipId,
  profile: { unlockedShips: readonly ShipId[]; highestLevelCleared: number; credits: number },
): UnlockState {
  const req = SHIPS[ship].unlock;
  const unlocked = req === null || profile.unlockedShips.includes(ship);
  if (!req) {
    return { unlocked: true, levelMet: true, creditsMet: true, canPurchase: false, level: null, credits: null };
  }
  const levelMet = profile.highestLevelCleared >= req.level;
  const creditsMet = profile.credits >= req.credits;
  return {
    unlocked,
    levelMet,
    creditsMet,
    canPurchase: !unlocked && levelMet && creditsMet,
    level: { need: req.level, have: Math.min(profile.highestLevelCleared, req.level) },
    credits: { need: req.credits, have: Math.min(profile.credits, req.credits) },
  };
}
