import { describe, expect, it } from 'vitest';
import { Sim, type SimGround, type SimPath } from '../game/sim';
import { emptyInput } from '../game/input';
import { Ev } from '../game/core/events';
import { TEST_LEVEL } from '../levels/testLevel';
import { EMPTY_TIERS } from '../data/upgrades';
import { ENVELOPES, FREEDOM, FEEL, PLAYER, CONTACT, SERVICE_CEILING } from '../data/mission';
import { InputState, type InputOptions } from '../input/inputState';
import { DEFAULT_BINDINGS, cloneBindings } from '../input/bindings';
import { STEP } from '../game/core/step';
import { ShipAttitude } from '../render/mission/shipAttitude';
import type { LevelDef } from '../levels/types';

// Creative Bible §2 FREEDOM OF FLIGHT (AC2.3-AC2.9)
const level = (a: number, b: number): LevelDef => ({ ...TEST_LEVEL, envelope: [[0, a, b]] });
const make = (a: number, b: number, world?: { path: SimPath; ground: SimGround }) =>
  new Sim({ level: level(a, b), ship: 'halcyon', tiers: { ...EMPTY_TIERS }, seed: 3, world });
const cursor = (x: number, y: number) => ({ ...emptyInput(), cursor: true, cursorX: x, cursorY: y });

/** steps until `cond` holds (or the cap), in seconds */
function timeUntil(sim: Sim, inp: ReturnType<typeof cursor>, cond: () => boolean, cap = 600): number {
  for (let n = 0; n < cap; n++) {
    if (cond()) return n * STEP;
    sim.step(inp);
  }
  return Infinity;
}

describe('freedom of flight (Creative Bible §2)', () => {
  it('AC2.5 lateral speed = clamp(1.1 a, 30, 80) x AGI', () => {
    for (const [name, e] of Object.entries(ENVELOPES)) {
      const sim = make(e.a, e.b);
      sim.step(emptyInput());
      const agi = sim.stats.lateralSpeed / FREEDOM.agiRef;
      expect(sim.player.latMax, name).toBeCloseTo(Math.min(80, Math.max(30, 1.1 * e.a)) * agi, 6);
    }
  });

  it('AC2.5 cursor-flight crosses a full plain edge to edge in <= 1.8 s; a slot reacts in < 0.8 s', () => {
    const P = ENVELOPES.plains;
    const sim = make(P.a, P.b);
    // settle at the left edge
    timeUntil(sim, cursor(-1, 0), () => false, 240);
    expect(sim.player.x).toBeLessThan(-P.a * 0.95);
    const cross = timeUntil(sim, cursor(1, 0), () => sim.player.x > P.a * 0.9);
    expect(cross).toBeLessThanOrEqual(1.8);
    const S = ENVELOPES.slot;
    const slot = make(S.a, S.b);
    const react = timeUntil(slot, cursor(1, 0), () => slot.player.x > S.a * 0.8);
    expect(react).toBeLessThan(0.8);
  });

  it('AC2.3 the ship settles on the cursor target without overshooting the envelope', () => {
    const P = ENVELOPES.plains;
    const sim = make(P.a, P.b);
    timeUntil(sim, cursor(0.5, -0.5), () => false, 180);
    expect(sim.player.x).toBeCloseTo(0.5 * P.a, 0);
    expect(sim.player.y).toBeCloseTo(-0.5 * P.b, 0);
    let maxX = 0;
    for (let n = 0; n < 240; n++) {
      sim.step(cursor(1, 0));
      maxX = Math.max(maxX, sim.player.x);
    }
    expect(maxX).toBeLessThan(P.a * 1.02);
  });

  it('AC2.4 the boss arena envelope is 60 / 34', () => {
    expect(ENVELOPES.arena).toEqual({ a: 60, b: 34 });
  });

  it('AC2.9 a gorge wall pushes the ship SIDEWAYS (not up it) and scrapes past the margin', () => {
    // flat floor at -40, a 75 deg wall rising from x = 20 (world y = path y + local y; path y = 0)
    const path: SimPath = { yAt: () => 0, envelopeAt: (_s, out) => ((out.a = 60), (out.b = 34), out) };
    const ground: SimGround = { height: (_s, u) => (u < 20 ? -40 : -40 + (u - 20) * Math.tan((75 * Math.PI) / 180)) };
    const sim = make(60, 34, { path, ground });
    let scrapes = 0, maxY = -1e9;
    const r = sim.events.reader();
    for (let n = 0; n < 300; n++) {
      sim.step(cursor(1, 0));
      maxY = Math.max(maxY, sim.player.y);
      r.drain(i => void (sim.events.type[i] === Ev.GroundScrape && scrapes++));
    }
    // never inside the wall: the surface at the ship's altitude is at x = 20 + 40 / tan(75)
    const wallX = 20 + (40 + sim.player.y) / Math.tan((75 * Math.PI) / 180);
    expect(sim.player.x).toBeLessThan(wallX);
    expect(maxY).toBeLessThan(15); // it slid along the wall a little, it did not climb it
    expect(scrapes).toBeGreaterThan(0);
  });

  it('AC9.6 skimming and wall-running pay; a bolt passing close is a close call', () => {
    const path: SimPath = { yAt: () => 0, envelopeAt: (_s, out) => ((out.a = 60), (out.b = 34), out) };
    const ground: SimGround = { height: () => -(FREEDOM.skimAt - 1) };
    const sim = make(60, 34, { path, ground });
    for (let n = 0; n < 180; n++) sim.step(cursor(0, 0));
    expect(sim.player.skimTime).toBeGreaterThan(2.5);
    expect(sim.score).toBeGreaterThan(0);
    // a slow enemy bolt passing 2 u beside the player
    const s2 = make(60, 34);
    s2.step(emptyInput());
    const p = s2.player;
    s2.enemyShots.spawn(p.s + 30, p.x + PLAYER.hurtRadius + 2, p.y, -40, 0, 0, 3, 5, 0.3, 2);
    const r = s2.events.reader();
    let calls = 0;
    for (let n = 0; n < 120; n++) {
      s2.step(emptyInput());
      r.drain(i => void (s2.events.type[i] === Ev.CloseCall && calls++));
    }
    expect(calls).toBe(1);
    expect(s2.player.hull).toBe(s2.stats.maxHull);
  });

  it('AC2.7 the bank reaches 90 % of +-70 deg in about 0.18 s from a hard input', () => {
    const att = new ShipAttitude();
    const lat = 80, accel = lat / FREEDOM.accelTime;
    let vx = 0, t = 0, reached = Infinity;
    att.update(STEP, 0, 0, lat, -1, 1, 0, 0, 0);
    for (let n = 0; n < 120; n++) {
      vx = Math.max(-lat, vx - accel * STEP);
      att.update(STEP, vx, 0, lat, -1, 1, 0, 0, 0);
      t += STEP;
      if (att.bank > FEEL.bankMax * 0.9 && reached === Infinity) reached = t;
    }
    expect(FEEL.bankMax).toBeCloseTo((70 * Math.PI) / 180, 6);
    expect(reached).toBeLessThanOrEqual(0.2);
  });
});

// Control / Camera / Boundary addendum: the mouse never steers by default; NO invisible limit anywhere —
// the terrain is the wall (contact + slide + impact + water), the ceilings are diegetic (canyon-rim
// turbulence, the cloud deck)
describe('real boundaries (Control / Camera / Boundary addendum)', () => {
  const flat = (floor: number): SimGround => ({ height: () => floor });
  const pathAt = (a = 60, b = 34): SimPath => ({ yAt: () => 0, envelopeAt: (_s, out) => ((out.a = a), (out.b = b), out) });
  const keys = (x: number, y: number) => ({ ...emptyInput(), moveX: x, moveY: y });
  const count = (sim: Sim, type: Ev, f: () => void) => {
    const r = sim.events.reader();
    let n = 0;
    f();
    r.drain(i => void (sim.events.type[i] === type && n++));
    return n;
  };

  it('KEYBOARD steering: 20 s of pure mouse motion moves the ship by exactly 0', () => {
    const opts: InputOptions = { sensitivity: 1.6, invertY: false, autoFire: false, steering: 'keyboard', reticleAutoCentre: false };
    const ist = new InputState(() => cloneBindings(DEFAULT_BINDINGS), () => opts);
    ist.setViewport(1920, 1080);
    const world = { path: pathAt(), ground: flat(-40) };
    const moved = make(60, 34, world), still = make(60, 34, world);
    const inp = emptyInput();
    let seed = 7, minX = 1, maxX = -1;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    for (let n = 0; n < 20 * 60; n++) {
      ist.mouseMove(rnd() * 450, rnd() * 300, n * STEP);
      ist.update(STEP, n * STEP);
      ist.setCursorAim(ist.cx * 1.1, ist.cy * 0.8); // the camera ray through the reticle (MissionDriver)
      minX = Math.min(minX, ist.cx);
      maxX = Math.max(maxX, ist.cx);
      moved.step(ist.sample(inp));
      still.step(emptyInput());
    }
    expect(maxX - minX).toBeGreaterThan(1.5); // the reticle really swept the screen
    expect(moved.player.x).toBe(0);
    expect(moved.player.y).toBe(0);
    expect(moved.player.s).toBe(still.player.s);
    expect(moved.player.clampEvents).toBe(0);
  });

  it('no envelope clamp: the keys fly far past the design envelope until real terrain stops the ship', () => {
    const sim = make(26, 18, { path: pathAt(26, 18), ground: flat(-400) });
    for (let n = 0; n < 240; n++) sim.step(keys(1, 0));
    expect(sim.player.x).toBeGreaterThan(26 * 3);
    expect(sim.player.clampEvents).toBe(0);
  });

  it('a wall reached with the keys: within 2 u, scrape + SLIDE, forward motion never stops', () => {
    const tan = Math.tan((75 * Math.PI) / 180);
    const ground: SimGround = { height: (_s, u) => (u < 20 ? -40 : -40 + (u - 20) * tan) };
    const sim = make(60, 34, { path: pathAt(), ground });
    let scrapes = 0, closest = Infinity;
    for (let n = 0; n < 300; n++) {
      const s0 = sim.player.s;
      scrapes += count(sim, Ev.GroundScrape, () => sim.step(keys(1, 0)));
      expect(sim.player.s - s0).toBeGreaterThan(sim.player.speed * STEP * 0.5); // never an invisible stop
      const face = 20 + (40 + sim.player.y) / tan;
      closest = Math.min(closest, face - sim.player.x);
    }
    expect(closest).toBeLessThan(2 + CONTACT.hullR); // hull within 2 u of the face
    expect(closest).toBeGreaterThan(0); // never inside it
    expect(scrapes).toBeGreaterThan(0);
    expect(sim.player.clampEvents).toBe(0);
  });

  it('contact never adds forward speed (no wall surfing on a slope that falls away ahead)', () => {
    // a wall on the right that recedes ahead (its face normal has a FORWARD component)
    const tan = Math.tan((70 * Math.PI) / 180);
    const ground: SimGround = { height: (s, u) => (u < 20 + s * 0.5 ? -40 : -40 + (u - 20 - s * 0.5) * tan) };
    const sim = make(60, 34, { path: pathAt(), ground });
    const cruise = sim.level.cruiseSpeed;
    let maxSpeed = 0, contacts = 0;
    for (let n = 0; n < 400; n++) {
      sim.step(keys(1, 0));
      maxSpeed = Math.max(maxSpeed, sim.player.speed);
      if (sim.player.contact > 0) contacts++;
    }
    expect(contacts).toBeGreaterThan(10);
    expect(maxSpeed).toBeLessThanOrEqual(cruise * 1.001);
  });

  it('a face ACROSS the line: head-on impact 6-25 by closing speed, 30 % bounce, 0.6 s immunity, no tunnelling at boost', () => {
    const S0 = 200;
    const ground: SimGround = { height: s => (s < S0 ? -40 : 120) };
    const sim = make(60, 34, { path: pathAt(), ground });
    const dmg: number[] = [];
    const r = sim.events.reader();
    let maxS = 0;
    for (let n = 0; n < 600; n++) {
      sim.step({ ...emptyInput(), boost: true });
      maxS = Math.max(maxS, sim.player.s);
      r.drain(i => {
        if (sim.events.type[i] === Ev.GroundScrape && sim.events.b[i] === 1) dmg.push(sim.events.a[i]);
      });
    }
    expect(dmg.length).toBeGreaterThan(0);
    for (const d of dmg) {
      expect(d).toBeGreaterThanOrEqual(CONTACT.impactMin);
      expect(d).toBeLessThanOrEqual(CONTACT.impactMax);
    }
    expect(dmg.length).toBeLessThanOrEqual(Math.ceil(10 / CONTACT.impactImmunity) + 1);
    expect(maxS).toBeLessThan(S0); // never through the face
    expect(sim.player.clampEvents).toBe(0);
  });

  it('water: splash + 8 damage (once a second) + drag + a bounce up — the ship never sinks', () => {
    const ground: SimGround = { height: () => -60, water: () => -20 };
    const sim = make(60, 34, { path: pathAt(), ground });
    let splashes = 0, minY = Infinity;
    const v0 = sim.player.speed;
    for (let n = 0; n < 180; n++) {
      splashes += count(sim, Ev.Splash, () => sim.step(keys(0, -1)));
      minY = Math.min(minY, sim.player.y);
    }
    expect(splashes).toBeGreaterThanOrEqual(1);
    expect(splashes).toBeLessThanOrEqual(3);
    expect(minY).toBeGreaterThan(-20 - CONTACT.hullR * 2);
    expect(sim.player.shield + sim.player.hull).toBeLessThan(sim.stats.maxShield + sim.stats.maxHull);
    expect(sim.player.speed).toBeLessThanOrEqual(v0 * 1.001);
  });

  it('VERTICAL FREEDOM: straight up reaches >= 400 u, the climb decays smoothly to 0 at the service ceiling, no clamp', () => {
    const sim = make(60, 34, { path: pathAt(), ground: flat(-40) });
    let maxY = -Infinity, prevVy = Infinity, decaying = true;
    for (let n = 0; n < 60 * 20; n++) {
      sim.step(keys(0, 1));
      const p = sim.player;
      maxY = Math.max(maxY, p.y);
      // inside the last 80 u the climb rate never exceeds lim x room / 80 (a smooth decay, no wall)
      // (the cap acts on the room BEFORE this step's move)
      const room = p.freeUp - p.y + p.vy * STEP;
      if (room < SERVICE_CEILING.decay && p.vy > (p.latMax * Math.max(0, room)) / SERVICE_CEILING.decay + 1e-9) decaying = false;
      prevVy = p.vy;
    }
    expect(sim.player.freeUp).toBeGreaterThanOrEqual(SERVICE_CEILING.min);
    expect(maxY).toBeGreaterThanOrEqual(SERVICE_CEILING.min - 2);
    expect(maxY).toBeLessThanOrEqual(sim.player.freeUp + 1e-6);
    expect(decaying).toBe(true);
    expect(prevVy).toBeLessThan(1);
    expect(sim.player.clampEvents).toBe(0);
  });

  it('the service ceiling clears the tallest ridge within 600 u by 150 u', () => {
    // a 700 u peak 450 u to the right of the line
    const ground: SimGround = { height: (_s, u) => (Math.abs(u - 450) < 60 ? 700 : -40) };
    const sim = make(60, 34, { path: pathAt(), ground });
    sim.step(emptyInput());
    expect(sim.player.ceilY).toBeCloseTo(700 + SERVICE_CEILING.ridgeMargin, 6);
    expect(sim.player.freeUp).toBeCloseTo(850, 6);
  });

  it('holding 60 s at 350 u is stable (no drift, no push), and the dive back to a skim is clean', () => {
    const sim = make(60, 34, { path: pathAt(), ground: flat(-40) });
    while (sim.player.y < 350) sim.step(keys(0, 1));
    const y0 = sim.player.y;
    let drift = 0;
    for (let n = 0; n < 60 * 60; n++) {
      sim.step(emptyInput());
      drift = Math.max(drift, Math.abs(sim.player.y - y0));
    }
    expect(drift).toBeLessThan(6); // the release decelerates over ~0.12 s, then it holds
    let minClear = Infinity;
    for (let n = 0; n < 60 * 12; n++) {
      sim.step(keys(0, -1));
      minClear = Math.min(minClear, sim.player.y + 40);
    }
    expect(minClear).toBeGreaterThan(CONTACT.hullR - 0.6); // down onto the floor: contact, never through
    expect(sim.player.alive).toBe(true);
    expect(sim.player.clampEvents).toBe(0);
  });

  it('altitude has consequences: > 180 u for 4 s summons air hunters (once per cooldown)', () => {
    const sim = make(60, 34, { path: pathAt(), ground: flat(-40) });
    const r = sim.events.reader();
    let calls = 0, firstAt = -1;
    for (let n = 0; n < 60 * 30; n++) {
      sim.step(sim.player.y < 250 ? keys(0, 1) : emptyInput());
      r.drain(i => {
        if (sim.events.type[i] === Ev.AirHunters) {
          calls++;
          if (firstAt < 0) firstAt = sim.time;
        }
      });
    }
    expect(calls).toBe(Math.floor((30 - firstAt) / SERVICE_CEILING.airHunters.cooldown) + 1);
    expect(firstAt).toBeGreaterThan(SERVICE_CEILING.airHunters.after);
  });
});
