// Balance harness entry (brief §15; Node tooling, outside src/game): bundled by tools/balance.mjs and run on
// Node. Runs a level N times per skill tier with seeded bots and prints a
// JSON summary (win rate, hull left, time, accuracy, kills).
//   node tools/balance.mjs --level test --skills novice,mid,expert --runs 20 [--ship halcyon] [--tier 0]
import { runLevel, type RunResult } from '../game/bot/run';
import { levelById, LEVELS } from '../levels/registry';
import { isBotSkill, type BotSkillId } from '../data/bot';
import { EMPTY_TIERS, TRACK_IDS, type UpgradeTiers } from '../data/upgrades';
import { isShipId } from '../data/ships';

declare const process: { argv: string[]; exitCode?: number };

const argv = process.argv.slice(2);
const opt = (k: string, d: string) => {
  const i = argv.indexOf('--' + k);
  return i >= 0 ? argv[i + 1] : d;
};
const level = levelById(opt('level', 'test'));
const ship = opt('ship', 'halcyon');
const runs = Math.max(1, Number(opt('runs', '20')));
const tier = Math.max(0, Math.min(5, Number(opt('tier', '0'))));
const skills = opt('skills', 'novice,mid,expert').split(',').filter(isBotSkill) as BotSkillId[];

if (!level || !isShipId(ship)) {
  console.log(JSON.stringify({ error: 'unknown level or ship', levels: Object.keys(LEVELS) }));
  process.exitCode = 1;
} else {
  const tiers: UpgradeTiers = { ...EMPTY_TIERS };
  for (const t of TRACK_IDS) tiers[t] = tier;
  const out: Record<string, unknown> = { level: level.id, ship, tier, runs };
  const t0 = Date.now();
  for (const skill of skills) {
    const rs: RunResult[] = [];
    for (let i = 0; i < runs; i++) rs.push(runLevel({ level, ship, tiers, skill, seed: level.seed + i * 7919 }));
    const won = rs.filter(r => r.won);
    const mean = (f: (r: RunResult) => number, list = rs) => (list.length ? list.reduce((a, r) => a + f(r), 0) / list.length : 0);
    out[skill] = {
      winRate: +(won.length / rs.length).toFixed(3),
      hullLeft: +mean(r => r.hullLeft, won).toFixed(3),
      time: +mean(r => r.time).toFixed(1),
      accuracy: +mean(r => r.accuracy).toFixed(3),
      kills: +mean(r => r.kills).toFixed(1),
      score: Math.round(mean(r => r.score)),
    };
  }
  out.ms = Date.now() - t0;
  console.log(JSON.stringify(out, null, 1));
}
