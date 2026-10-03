// Headless run of one level by a bot (brief §15 balance harness): no
// renderer, no clock — the sim steps as fast as the CPU allows.
import { Sim } from '../sim';
import { FlightPath } from '../world/path';
import { HeightGrid, TerrainField } from '../world/terrain';
import { terrainOptions } from '../world/chapters';
import { worldById } from '../../data/worlds/registry';
import { Ev } from '../core/events';
import { Bot } from './bot';
import { emptyInput } from '../input';
import { STEP } from '../core/step';
import type { LevelDef } from '../../levels/types';
import type { ShipId } from '../../data/ships';
import type { UpgradeTiers } from '../../data/upgrades';
import type { BotSkillId, BotStyle } from '../../data/bot';

/** `world` (default true): fly the level's real terrain (path + height grid: contact, water, ceilings),
 *  as the mission does; false = the envelope-only sim (no terrain) */
export type RunOptions = { level: LevelDef; ship: ShipId; tiers: UpgradeTiers; skill: BotSkillId; seed: number; maxTime?: number; world?: boolean; wingHalfSpan?: number; style?: BotStyle };

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
  /** terrain (addendum §3): scrape ticks, head-on impacts, splashes, close calls, skim + wall-run seconds,
   *  invisible-limit events (must be 0) */
  scrapes: number;
  impacts: number;
  splashes: number;
  closeCalls: number;
  skim: number;
  wallRun: number;
  clampEvents: number;
};

export function runLevel(o: RunOptions): RunResult {
  const def = o.world !== false ? worldById(o.level.worldId) : undefined;
  let world: { path: FlightPath; ground: HeightGrid } | undefined;
  if (def) {
    const path = new FlightPath(o.level.path);
    const field = new TerrainField(def.terrain, path, terrainOptions(o.level));
    world = { path, ground: new HeightGrid(field) };
  }
  const sim = new Sim({ level: o.level, ship: o.ship, tiers: o.tiers, seed: o.seed, world, wingHalfSpan: o.wingHalfSpan });
  const ev = sim.events.reader();
  let scrapes = 0, impacts = 0, splashes = 0;
  const count = (slot: number) => {
    const t = sim.events.type[slot];
    if (t === Ev.GroundScrape) {
      if (sim.events.b[slot] === 1) impacts++;
      else scrapes++;
    } else if (t === Ev.Splash) splashes++;
  };
  const bot = new Bot(o.skill, o.seed, o.style);
  const inp = emptyInput();
  const maxSteps = Math.ceil((o.maxTime ?? (o.level.lengthM / Math.max(1, o.level.cruiseSpeed)) * 2.5) / STEP);
  for (let i = 0; i < maxSteps && !sim.done && sim.player.alive; i++) {
    sim.step(bot.think(sim, inp));
    ev.drain(count);
  }
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
    scrapes,
    impacts,
    splashes,
    closeCalls: p.closeCalls,
    skim: p.skimTime,
    wallRun: p.wallTime,
    clampEvents: p.clampEvents,
  };
}
