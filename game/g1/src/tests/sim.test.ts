import { describe, expect, it } from 'vitest';
import { Sim } from '../game/sim';
import { emptyInput, type SimInput } from '../game/input';
import { Rng } from '../game/core/rng';
import { Ev } from '../game/core/events';
import { TEST_LEVEL } from '../levels/testLevel';
import { EMPTY_TIERS } from '../data/upgrades';
import { PLAYER } from '../data/mission';
import { STEP } from '../game/core/step';

const make = (seed = 1) => new Sim({ level: TEST_LEVEL, ship: 'halcyon', tiers: { ...EMPTY_TIERS }, seed });

function hash(sim: Sim): string {
  const p = sim.player;
  const parts = [p.s, p.x, p.y, p.vx, p.vy, p.speed, p.hull, p.shield, p.energy, sim.score, sim.kills, sim.playerShots.count];
  for (let i = 0; i < sim.playerShots.count; i++) parts.push(sim.playerShots.s[i], sim.playerShots.x[i]);
  return parts.map(v => v.toFixed(9)).join('|');
}

function scriptedRun(seed: number, steps: number): Sim {
  const sim = make(seed);
  const r = new Rng(99); // the INPUT script is fixed; the sim seed varies
  for (let k = 0; k < 4; k++) sim.spawnEnemy(1, 150 + k * 40, -10 + k * 7, (k % 2) * 4 - 2, 60, 2, 100, 150 + k * 40);
  const inp = emptyInput();
  for (let t = 0; t < steps; t++) {
    if (t % 20 === 0) {
      inp.moveX = r.range(-1, 1);
      inp.moveY = r.range(-1, 1);
      inp.aimYaw = r.range(-0.3, 0.3);
      inp.aimPitch = r.range(-0.2, 0.2);
      inp.fire = r.next() < 0.7;
      inp.boost = r.next() < 0.2;
      inp.roll = r.next() < 0.05 ? (r.sign() as 1 | -1) : 0;
    } else inp.roll = 0;
    sim.step(inp);
  }
  return sim;
}

describe('Sim determinism (brief §3)', () => {
  it('same seed + same input script = identical state after 3000 steps', () => {
    expect(hash(scriptedRun(7, 3000))).toBe(hash(scriptedRun(7, 3000)));
  });
});

describe('player flight (brief §5, §7)', () => {
  it('no invisible limit: without terrain, holding hard right just keeps going (addendum §3)', () => {
    const sim = make();
    const inp: SimInput = { ...emptyInput(), moveX: 1 };
    for (let t = 0; t < 300; t++) sim.step(inp);
    // 5 s at the lateral speed: far beyond any design envelope, no clamp, no spring-back
    expect(sim.player.x).toBeGreaterThan(sim.player.latMax * 4.5);
    expect(sim.player.clampEvents).toBe(0);
  });
  it('stops in about FREEDOM.stopTime (0.12 s) after the key is released', () => {
    const sim = make();
    for (let t = 0; t < 14; t++) sim.step({ ...emptyInput(), moveX: 1 });
    expect(Math.abs(sim.player.vx)).toBeGreaterThan(sim.player.latMax * 0.99);
    let n = 0;
    while (Math.abs(sim.player.vx) > 1e-6 && n < 120) {
      sim.step(emptyInput());
      n++;
    }
    expect(n * STEP).toBeLessThan(0.16);
  });
  it('a roll moves ~6 u sideways and grants projectile i-frames only in its window', () => {
    const sim = make();
    sim.step({ ...emptyInput(), roll: 1 });
    let t = 0;
    while (sim.player.rollT >= 0 && t < 60) {
      sim.step(emptyInput());
      t++;
    }
    expect(sim.player.x).toBeGreaterThan(PLAYER.roll.impulse * 0.9);
    expect(sim.player.x).toBeLessThan(PLAYER.roll.impulse * 1.1);
    // i-frames: projectile damage ignored mid-window, hazards still hurt
    const s2 = make();
    s2.step({ ...emptyInput(), roll: -1 });
    for (let k = 0; k < 12; k++) s2.step(emptyInput()); // ~0.2 s into the roll
    expect(s2.damagePlayer(20, 0, 0, 0, 0)).toBe(0);
    expect(s2.player.shield).toBe(s2.stats.maxShield);
    s2.damagePlayer(20, 1, 0, 0, 0);
    expect(s2.player.shield).toBeLessThan(s2.stats.maxShield);
  });
  it('boost drains energy, locks out when empty, regenerates after the delay', () => {
    const sim = make();
    const cruise = sim.player.speed;
    for (let t = 0; t < 60; t++) sim.step({ ...emptyInput(), boost: true });
    expect(sim.player.speed).toBeGreaterThan(cruise * 1.2);
    for (let t = 0; t < 120; t++) sim.step({ ...emptyInput(), boost: true });
    expect(sim.player.energy).toBe(0);
    expect(sim.player.boostLock).toBeGreaterThan(0);
    for (let t = 0; t < 240; t++) sim.step(emptyInput());
    expect(sim.player.energy).toBeGreaterThan(30);
  });
});

describe('weapons + collision', () => {
  it('fires at the stat fire rate, alternating cannons', () => {
    const sim = make();
    for (let t = 0; t < 120; t++) sim.step({ ...emptyInput(), fire: true });
    expect(sim.player.shotsFired).toBeGreaterThanOrEqual(Math.floor(sim.stats.fireRate * 2) - 1);
    expect(sim.player.shotsFired).toBeLessThanOrEqual(Math.ceil(sim.stats.fireRate * 2) + 1);
  });
  it('bolts converge on the aim point and kill a target through swept tests', () => {
    const sim = make();
    sim.spawnEnemy(1, 100, 0, 0, 30, 1.5, 100, 100); // holds 100 u ahead, dead centre
    const r = sim.events.reader();
    let kills = 0, hits = 0;
    for (let t = 0; t < 120; t++) {
      sim.step({ ...emptyInput(), fire: true });
      r.drain(i => {
        if (sim.events.type[i] === Ev.Kill) kills++;
        if (sim.events.type[i] === Ev.Hit) hits++;
      });
    }
    expect(kills).toBe(1);
    expect(hits).toBeGreaterThanOrEqual(Math.ceil(30 / sim.stats.damage));
    expect(sim.score).toBe(100);
  });
});

describe('damage model (brief §10)', () => {
  it('shield absorbs first; hull hits grant 0.6 s immunity and reset the combo; death emits', () => {
    const sim = make();
    sim.combo = 2.5;
    const sh = sim.stats.maxShield;
    sim.damagePlayer(sh + 10, 0, 0, 0, 0);
    expect(sim.player.shield).toBe(0);
    expect(sim.player.hull).toBeCloseTo(sim.stats.maxHull - 10);
    expect(sim.combo).toBe(1);
    expect(sim.damagePlayer(50, 1, 0, 0, 0)).toBe(0); // immune
    for (let t = 0; t < 40; t++) sim.step(emptyInput());
    const r = sim.events.reader();
    sim.damagePlayer(9999, 1, 0, 0, 0);
    let died = false;
    r.drain(i => void (sim.events.type[i] === Ev.PlayerDied && (died = true)));
    expect(died).toBe(true);
    expect(sim.player.alive).toBe(false);
  });
  it('god mode reports damage but never applies it', () => {
    const sim = new Sim({ level: TEST_LEVEL, ship: 'halcyon', tiers: { ...EMPTY_TIERS }, god: true });
    sim.damagePlayer(9999, 1, 0, 0, 0);
    expect(sim.player.alive).toBe(true);
    expect(sim.player.hull).toBe(sim.stats.maxHull);
  });
});

describe('enemy projectiles vs the player (brief §5 layers)', () => {
  it('a fast orb cannot tunnel through the hurtbox; a roll in its i-frame window lets it pass', () => {
    const sim = make();
    const p = sim.player;
    sim.enemyShots.spawn(p.s + 30, 0, 0, p.speed - 140, 0, 0, 3, 12, 0.6, 2);
    for (let t = 0; t < 30; t++) sim.step(emptyInput());
    expect(sim.player.shield).toBeCloseTo(sim.stats.maxShield - 12);
    expect(sim.enemyShots.count).toBe(0);
    const s2 = make();
    s2.step({ ...emptyInput(), roll: 1 });
    for (let t = 0; t < 8; t++) s2.step(emptyInput()); // ~0.15 s into the roll
    const q = s2.player;
    s2.enemyShots.spawn(q.s + 4, q.x, q.y, q.speed - 140, 0, 0, 3, 12, 0.6, 2); // arrives inside the window
    for (let t = 0; t < 4; t++) s2.step(emptyInput());
    expect(s2.player.shield).toBe(s2.stats.maxShield);
  });
});
