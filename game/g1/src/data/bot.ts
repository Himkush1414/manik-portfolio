// Bot skill tiers (brief §15): the scripted pilot that drives the balance
// harness (headless) and ?bot=<skill> in the real game (soak + screenshots).
// Degrees for aim error; seconds for reaction. Tuned so the tiers bracket
// real players (DEV_NOTES P2 balance report records how they were set).

export type BotSkill = {
  /** perception delay: new targets / threats are acted on this long after they appear */
  reaction: number;
  /** aim error standard deviation (deg), re-rolled per target */
  aimErrorDeg: number;
  /** probability of reacting to a projectile threat at all */
  dodge: number;
  /** probability per threat of rolling (i-frames) instead of strafing, when close */
  rollUse: number;
  /** fraction of calm time spent boosting */
  boostUse: number;
  /** probability per second of drifting off-target (human sloppiness) */
  wander: number;
  /** aim correction: the error shrinks with this time constant (s) while on target ... */
  correct: number;
  /** ... toward this residual fraction, and is re-rolled every `reroll` s */
  residual: number;
  reroll: number;
};

export const BOT_SKILLS = {
  novice: { reaction: 0.45, aimErrorDeg: 3.5, dodge: 0.35, rollUse: 0.1, boostUse: 0.05, wander: 0.25, correct: 1.4, residual: 0.35, reroll: 2.2 },
  mid: { reaction: 0.28, aimErrorDeg: 2.0, dodge: 0.62, rollUse: 0.35, boostUse: 0.15, wander: 0.12, correct: 0.8, residual: 0.25, reroll: 2.6 },
  expert: { reaction: 0.16, aimErrorDeg: 0.8, dodge: 0.88, rollUse: 0.7, boostUse: 0.25, wander: 0.04, correct: 0.4, residual: 0.15, reroll: 3 },
} as const satisfies Record<string, BotSkill>;

export type BotSkillId = keyof typeof BOT_SKILLS;
export const isBotSkill = (v: unknown): v is BotSkillId => v === 'novice' || v === 'mid' || v === 'expert';

/** Bot geometry: how far ahead threats are scanned (s) and the lanes it prefers. */
export const BOT = {
  threatHorizon: 1.2,
  /** keep this far inside the envelope (fraction) */
  margin: 0.82,
  /** aim lead uses this fraction of the true lead (humans under-lead) */
  leadSkill: { novice: 0.4, mid: 0.75, expert: 1 },
} as const;
