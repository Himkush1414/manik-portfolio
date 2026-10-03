import { describe, expect, it } from 'vitest';
import { Sim } from '../game/sim';
import { FlightPath, validatePath } from '../game/world/path';
import { HeightGrid, TerrainField, createSample } from '../game/world/terrain';
import { wingContactSpan } from '../scenes/mission/shipMounts';
import { SPECS } from '../ships/specs';
import { TEST_LEVEL } from '../levels/testLevel';
import { LEVEL_01 } from '../levels/level01';
import { worldById } from '../data/worlds/registry';
import { terrainOptions } from '../game/world/chapters';
import { emptyInput } from '../game/input';
import { CONTACT } from '../data/mission';
import { Ev } from '../game/core/events';
import { EMPTY_TIERS } from '../data/upgrades';

function worldFor(level = TEST_LEVEL) {
  const def = worldById(level.worldId)!;
  const path = new FlightPath(level.path);
  const field = new TerrainField(def.terrain, path, terrainOptions(level));
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

  it('flying straight down into the valley floor: real contact (slide / scrape), never through, never dead', () => {
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
    // the hull sphere never sinks into the floor (a little numerical slack), the ship lives, and it did
    // touch: the floor is the boundary, not a soft push 10 u above it
    expect(minClear).toBeGreaterThan(CONTACT.hullR - 0.6);
    expect(minClear).toBeLessThan(CONTACT.hullR + 1);
    expect(sim.player.alive).toBe(true);
    expect(scrapes).toBeGreaterThan(0);
    expect(sim.player.clampEvents).toBe(0);
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

describe('water + wings on a world (Control / Camera / Boundary addendum)', () => {
  it('the height grid knows the river: wet exactly where the terrain sample is wet', () => {
    const w = worldFor();
    const sm = createSample();
    let wet = 0, checked = 0, edge = 0;
    for (let s = 0; s < 3000; s += 37) {
      w.grid.fill(s - 10, s + 10);
      for (let u = -60; u <= 60; u += 3) {
        w.field.sample(Math.round(s / HeightGrid.CELL) * HeightGrid.CELL, u, sm);
        const g = w.grid.water(s, u);
        checked++;
        if (g === g && sm.waterY === sm.waterY) {
          wet++;
          expect(g).toBeCloseTo(sm.waterY, 6);
        } else if (g === g || sm.waterY === sm.waterY) edge++; // the grid's bilinear bank vs the exact one
      }
    }
    expect(edge).toBeLessThan(wet * 0.15);
    expect(checked).toBeGreaterThan(1000);
    expect(wet).toBeGreaterThan(50);
  });

  it('diving into the river: a splash and a bounce, the ship stays above the water', () => {
    const w = worldFor();
    const sim = new Sim({ level: TEST_LEVEL, ship: 'halcyon', tiers: { ...EMPTY_TIERS }, seed: 7, god: true, world: { path: w.path, ground: w.grid } });
    const input = emptyInput();
    input.moveY = -1;
    let splashes = 0, below = 0;
    const reader = sim.events.reader();
    for (let i = 0; i < 60 * 8; i++) {
      w.grid.fill(sim.player.s - 20, sim.player.s + 200);
      sim.step(input);
      const p = sim.player;
      const wy = w.grid.water(p.s, p.x);
      if (wy === wy && w.path.yAt(p.s) + p.y < wy - CONTACT.hullR) below++;
      reader.drain(slot => void (sim.events.type[slot] === Ev.Splash && splashes++));
    }
    expect(splashes).toBeGreaterThan(0);
    expect(below).toBe(0);
  });

  it('the wing tips touch first: a ship with wings is stopped further from a wall than the hull alone', () => {
    const tan = Math.tan((80 * Math.PI) / 180);
    const ground = { height: (_s: number, u: number) => (u < 20 ? -40 : -40 + (u - 20) * tan) };
    const path = { yAt: () => 0, envelopeAt: (_s: number, o: { a: number; b: number }) => ((o.a = 60), (o.b = 34), o) };
    const span = wingContactSpan(SPECS.halcyon);
    expect(span).toBeGreaterThan(4);
    const run = (wing: number) => {
      const sim = new Sim({ level: TEST_LEVEL, ship: 'halcyon', tiers: { ...EMPTY_TIERS }, seed: 7, god: true, wingHalfSpan: wing, world: { path, ground } });
      const input = emptyInput();
      input.moveX = 1;
      let maxX = -Infinity;
      for (let i = 0; i < 240; i++) {
        sim.step(input);
        maxX = Math.max(maxX, sim.player.x);
      }
      return maxX;
    };
    const hull = run(0), wings = run(span);
    expect(wings).toBeLessThan(hull - 2);
    expect(wings).toBeLessThan(20 + 40 / tan - span * 0.6);
  });
});
