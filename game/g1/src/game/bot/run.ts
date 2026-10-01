// Headless run of one level by a bot (brief §15 balance harness): no
// renderer, no clock — the sim steps as fast as the CPU allows.
import { Sim } from '../sim';
import { Bot } from './bot';
import { emptyInput } from '../input';
import { STEP } from '../core/step';
import type { LevelDef } from '../../levels/types';
import type { ShipId } from '../../data/ships';
import type { UpgradeTiers } from '../../data/upgrades';
import type { BotSkillId } from '../../data/bot';

export type RunOptions = { level: LevelDef; ship: ShipId; tiers: UpgradeTiers; skill: BotSkillId; seed: number; maxTime?: number };

export type RunResult = {
  seed: number;
  won: boolean;
  time: number;
  hullLeft: number;
  kills: number;
  score: number;
  accuracy: number;
  damageTaken: number;
  dodges: number;
};

export function runLevel(o: RunOptions): RunResult {
  const sim = new Sim({ level: o.level, ship: o.ship, tiers: o.tiers, seed: o.seed });
  const bot = new Bot(o.skill, o.seed);
  const inp = emptyInput();
  const maxSteps = Math.ceil((o.maxTime ?? (o.level.lengthM / Math.max(1, o.level.cruiseSpeed)) * 2.5) / STEP);
  for (let i = 0; i < maxSteps && !sim.done && sim.player.alive; i++) sim.step(bot.think(sim, inp));
  const p = sim.player;
  return {
    seed: o.seed,
    won: sim.done && p.alive,
    time: sim.time,
    hullLeft: p.hull / sim.stats.maxHull,
    kills: sim.kills,
    score: sim.score,
    accuracy: p.shotsFired ? p.shotsHit / p.shotsFired : 0,
    damageTaken: p.damageTaken,
    dodges: bot.stats.dodges,
  };
}
