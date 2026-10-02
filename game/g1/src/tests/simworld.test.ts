import { describe, expect, it } from 'vitest';
import { Sim } from '../game/sim';
import { FlightPath, validatePath } from '../game/world/path';
import { HeightGrid, TerrainField } from '../game/world/terrain';
import { TEST_LEVEL } from '../levels/testLevel';
import { LEVEL_01 } from '../levels/level01';
import { worldById } from '../data/worlds/registry';
import { emptyInput } from '../game/input';
import { GROUND } from '../data/mission';
import { Ev } from '../game/core/events';
import { EMPTY_TIERS } from '../data/upgrades';

function worldFor(level = TEST_LEVEL) {
  const def = worldById(level.worldId)!;
  const path = new FlightPath(level.path);
  const field = new TerrainField(def.terrain, path, { seed: level.terrainSeed, widthKeys: level.widthKeys });
  return { path, field, grid: new HeightGrid(field) };
}
const mk = (w: ReturnType<typeof worldFor>, god = false) => new Sim({ level: TEST_LEVEL, ship: 'halcyon', tiers: { ...EMPTY_TIERS }, seed: 7, god, world: { path: w.path, ground: w.grid } });

describe('sim on a world (Phase 2R §5 INTERACTION)', () => {
  it('level paths are valid against their terrain', () => {
    for (const level of [TEST_LEVEL, LEVEL_01]) {
      const w = worldFor(level);
      expect(validatePath(w.path, (s, u) => w.field.height(s, u)), level.id).toEqual([]);
    }
  });

  it('flying straight down into the valley floor: pushed up, scraped (damage, never through, never dead)', () => {
    const w = worldFor();
    const sim = mk(w);
    const input = emptyInput();
    input.moveY = -1;
    let scrapes = 0, minClear = Infinity;
    const reader = sim.events.reader();
    for (let i = 0; i < 60 * 8; i++) {
      sim.step(input);
      const p = sim.player;
      minClear = Math.min(minClear, w.path.yAt(p.s) + p.y - w.grid.height(p.s, p.x));
      reader.drain(slot => void (sim.events.type[slot] === Ev.GroundScrape && scrapes++));
    }
    expect(minClear).toBeGreaterThan(GROUND.scrapeAt - 0.5);
    expect(sim.player.alive).toBe(true);
    // pushing into the floor with the whole envelope available: the soft floor + envelope hold the
    // ship off; if it does reach the scrape band it takes damage (never through, never dead)
    if (scrapes > 0) expect(sim.player.hull + sim.player.shield).toBeLessThan(sim.stats.maxHull + sim.stats.maxShield);
  });

  it('bolts aimed at the ground burst on it (terrain sparks)', () => {
    const w = worldFor();
    const sim = mk(w);
    const input = emptyInput();
    input.fire = true;
    input.aimPitch = -0.24;
    let sparks = 0;
    const reader = sim.events.reader();
    for (let i = 0; i < 60 * 3; i++) {
      sim.step(input);
      reader.drain(slot => {
        if (sim.events.type[slot] === Ev.Spark && sim.events.b[slot] === 1) sparks++;
      });
    }
    expect(sparks).toBeGreaterThan(3);
  });

  it('is deterministic with terrain (two runs, same inputs -> same state)', () => {
    const run = () => {
      const w = worldFor();
      const sim = mk(w);
      const input = emptyInput();
      for (let i = 0; i < 60 * 6; i++) {
        input.moveX = Math.sin(i * 0.05);
        input.moveY = Math.cos(i * 0.031) - 0.4;
        input.fire = i % 40 < 20;
        sim.step(input);
      }
      const p = sim.player;
      return [p.s, p.x, p.y, p.hull, p.shield, sim.tick].map(v => v.toFixed(6)).join(',');
    };
    expect(run()).toBe(run());
  });
});
