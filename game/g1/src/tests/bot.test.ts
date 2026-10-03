import { describe, expect, it } from 'vitest';
import { Sim, Shot } from '../game/sim';
import { Bot } from '../game/bot/bot';
import { runLevel } from '../game/bot/run';
import { emptyInput } from '../game/input';
import { Rng } from '../game/core/rng';
import { TEST_LEVEL } from '../levels/testLevel';
import { EMPTY_TIERS } from '../data/upgrades';
import type { BotSkillId } from '../data/bot';
import { wingContactSpan } from '../scenes/mission/shipMounts';
import { SPECS } from '../ships/specs';

/** drone gallery: a drone appears every 1.2 s at a random lane, holding 120-220 u ahead */
function gallery(skill: BotSkillId, seed: number, seconds = 40) {
  const sim = new Sim({ level: TEST_LEVEL, ship: 'halcyon', tiers: { ...EMPTY_TIERS }, seed });
  const bot = new Bot(skill, seed);
  const r = new Rng(seed * 7 + 1);
  const inp = emptyInput();
  let t = 0;
  // drones strafe sideways (static ones saturate every tier's accuracy)
  const baseX = new Float64Array(sim.enemies.cap), phase = new Float64Array(sim.enemies.cap);
  for (let i = 0; i < seconds * 60; i++) {
    t -= 1 / 60;
    if (t <= 0 && sim.enemies.aliveCount < 5) {
      t = 1.2;
      const hold = r.range(120, 220);
      const e = sim.spawnEnemy(1, sim.player.s + hold, r.range(-12, 12), r.range(-8, 8), 40, 2, 100, hold);
      if (e) {
        baseX[e.slot] = e.x;
        phase[e.slot] = r.range(0, 6.28);
      }
    }
    for (let k = 0; k < sim.enemies.aliveCount; k++) {
      const e = sim.enemies.items[sim.enemies.alive[k]];
      e.x = baseX[e.slot] + 7 * Math.sin(sim.time * 1.4 + phase[e.slot]);
    }
    sim.step(bot.think(sim, inp));
  }
  return { kills: sim.kills, acc: sim.player.shotsFired ? sim.player.shotsHit / sim.player.shotsFired : 0 };
}

describe('bot (brief §15)', () => {
  it('is deterministic per seed', () => {
    expect(gallery('mid', 3)).toEqual(gallery('mid', 3));
    expect(runLevel({ level: TEST_LEVEL, ship: 'halcyon', tiers: { ...EMPTY_TIERS }, skill: 'novice', seed: 5 })).toEqual(
      runLevel({ level: TEST_LEVEL, ship: 'halcyon', tiers: { ...EMPTY_TIERS }, skill: 'novice', seed: 5 }),
    );
  });
  it('skill tiers order by accuracy / kills over several seeds', () => {
    const avg = (s: BotSkillId) => {
      let k = 0, a = 0;
      for (const seed of [1, 2, 3, 4]) {
        const g = gallery(s, seed);
        k += g.kills;
        a += g.acc;
      }
      return { kills: k / 4, acc: a / 4 };
    };
    const n = avg('novice'), m = avg('mid'), e = avg('expert');
    console.log('bot tiers (strafing gallery):', JSON.stringify({ n, m, e }));
    expect(e.acc).toBeGreaterThan(m.acc);
    expect(m.acc).toBeGreaterThan(n.acc);
    expect(e.kills).toBeGreaterThanOrEqual(m.kills);
    expect(m.kills).toBeGreaterThan(n.kills * 0.95);
  });
  it('dodges an orb aimed straight at it (expert)', () => {
    let hits = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const sim = new Sim({ level: TEST_LEVEL, ship: 'halcyon', tiers: { ...EMPTY_TIERS }, seed });
      const bot = new Bot('expert', seed);
      const inp = emptyInput();
      for (let i = 0; i < 30; i++) sim.step(bot.think(sim, inp));
      const p = sim.player;
      // orb 140 u ahead, closing at 90 u/s relative, aimed at the player's current spot
      sim.enemyShots.spawn(p.s + 140, p.x, p.y, p.speed - 90, 0, 0, 5, 10, 0.6, Shot.EnemyOrb);
      for (let i = 0; i < 150; i++) {
        // the orb collision (2D) is not in the sim yet: test proximity directly
        const k = 0;
        if (sim.enemyShots.count && Math.abs(sim.enemyShots.s[k] - sim.player.s) < 1.5 && Math.hypot(sim.enemyShots.x[k] - sim.player.x, sim.enemyShots.y[k] - sim.player.y) < 2.2) {
          hits++;
          break;
        }
        sim.step(bot.think(sim, inp));
      }
    }
    expect(hits).toBeLessThanOrEqual(1);
  });
});

// F1 soak in the unit suite: a wall-hugging bot flies the whole test level on its real terrain
describe('hugger soak (Control / Camera / Boundary addendum)', () => {
  it('rides walls + floor for a full level: real contact, wall runs, never an invisible limit, survives', () => {
    const r = runLevel({ level: TEST_LEVEL, ship: 'halcyon', tiers: { ...EMPTY_TIERS }, skill: 'expert', seed: 11, style: 'hugger', wingHalfSpan: wingContactSpan(SPECS.halcyon) });
    expect(r.won).toBe(true);
    expect(r.clampEvents).toBe(0);
    expect(r.scrapes + r.impacts).toBeGreaterThan(10);
    expect(r.wallRun).toBeGreaterThan(0.5);
    expect(r.skim).toBeGreaterThan(2);
    expect(r.closeCalls).toBeGreaterThan(3);
  });
});
