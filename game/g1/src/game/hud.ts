// HudBus (brief §3): a plain object the sim refreshes at 20 Hz. The DOM HUD
// and the cockpit MFD canvases read it (they mutate text/transforms via refs;
// never React state per frame). Fixed shape, allocated once.
import { CAPS } from '../data/mission';

export type HudThreat = { active: boolean; angle: number; kind: number; urgency: number };

export type HudState = {
  /** increments on every refresh (consumers skip unchanged frames) */
  seq: number;
  hull: number;
  maxHull: number;
  shield: number;
  maxShield: number;
  energy: number;
  boostLocked: boolean;
  speed: number;
  /** 0..1 roll cooldown remaining */
  rollCd: number;
  score: number;
  combo: number;
  /** 0..1 combo window remaining */
  comboT: number;
  credits: number;
  /** 0..1 along the level */
  progress: number;
  /** targeted / last damaged enemy (slot or -1) */
  targetSlot: number;
  targetType: number;
  targetHp: number;
  threats: HudThreat[];
  alive: boolean;
};

export function createHud(): HudState {
  const threats: HudThreat[] = [];
  for (let i = 0; i < CAPS.threats; i++) threats.push({ active: false, angle: 0, kind: 0, urgency: 0 });
  return { seq: 0, hull: 0, maxHull: 1, shield: 0, maxShield: 1, energy: 0, boostLocked: false, speed: 0, rollCd: 0, score: 0, combo: 1, comboT: 0, credits: 0, progress: 0, targetSlot: -1, targetType: 0, targetHp: 0, threats, alive: true };
}
