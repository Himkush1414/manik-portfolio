// The deterministic mission simulation (brief §3, §5, §7, §10). Pure
// TypeScript: no three.js / React / DOM (tests/gameBoundary.test.ts). One call
// to step() = one fixed 1/60 s tick, in the brief's order:
//   input -> player -> spawner -> AI -> projectiles -> collisions -> damage
//   -> pickups -> scoring -> events -> HUD bus
// Everything is preallocated; step() allocates nothing. Same LevelDef + seed
// + input script => identical state (tests/sim.test.ts).
import { CAPS, PLAYER, RAIL, SIM, AIM_ASSIST, SCORING, FREEDOM, CONTACT, CEILING, FEEL, type AimAssist } from '../data/mission';
import { playerStats, type PlayerStats } from '../data/stats';
import type { ShipId } from '../data/ships';
import type { UpgradeTiers } from '../data/upgrades';
import type { LevelDef } from '../levels/types';
import { STEP } from './core/step';
import { createStreams, type RngStreams } from './core/rng';
import { EventRing, Ev } from './core/events';
import { ProjectilePool, SlotPool } from './core/pool';
import { curveAt, envelopeAt } from './rail';
import { segSphere } from './collide';
import type { SimInput } from './input';
import { createHud, type HudState } from './hud';

/** projectile kinds (render picks the visual by kind) */
export const enum Shot {
  PlayerBolt = 1,
  EnemyOrb = 2,
}

export type SimConfig = {
  level: LevelDef;
  ship: ShipId;
  tiers: UpgradeTiers;
  seed?: number;
  aimAssist?: AimAssist;
  /** QA ?god=1: damage is computed and reported but never applied */
  god?: boolean;
  /** twin cannon muzzles [left, right] (rail-space offsets: x right, y up, forward); default PLAYER.muzzles */
  muzzles?: readonly (readonly [number, number, number])[];
  /** Phase 2R world: the flight path (envelope + altitude) and deterministic ground heights at
   *  path-relative (s, u). Without it the level's envelope segments apply and nothing hits terrain. */
  world?: { path: SimPath; ground: SimGround };
  /** half wing span (u) of the flown ship: the wing-tip contact spheres (render measures the model) */
  wingHalfSpan?: number;
};

/** what the sim needs from the flight path (game/world/path.ts FlightPath) */
export type SimPath = {
  yAt(s: number): number;
  /** DESIGN envelope (tunes the lateral speed; never a limit) */
  envelopeAt(s: number, out: { a: number; b: number }): { a: number; b: number };
  /** world y of the cloud deck over this s (diegetic ceiling); default path y + CEILING.deck */
  deckAt?(s: number): number;
};
/** ground world-y at path-relative (s, u) (game/world/terrain.ts HeightGrid); water surface y or NaN */
export type SimGround = { height(s: number, u: number): number; water?(s: number, u: number): number; fill?(s0: number, s1: number): void };

export class Player {
  /** terrain scrape cooldown (s) */
  scrapeCd = 0;
  /** this step's lateral speed limit (from the envelope + AGI) and envelope (u) */
  latMax = 0;
  envA = 0;
  envB = 0;
  /** close calls / skim / wall-run (Creative Bible AC9.6) */
  closeCd = 0;
  closeCalls = 0;
  skimTime = 0;
  wallTime = 0;
  /** the current skim / wall-run streak (s), for the HUD + score ticks, and its kind (0 skim, 1 wall run) */
  skimT = 0;
  streakWall = 0;
  /** measured free space (u) at the path line's altitude: left / right to terrain, up to the ceiling,
   *  down to the ground under the path (camera STEADY follow, steering target, spawner lanes) */
  freeL = 0;
  freeR = 0;
  freeUp = 0;
  freeDown = 0;
  /** ceiling: 0..1 turbulence, 0..1 into the cloud deck's base (whiteout), kind (0 rim, 1 deck) */
  turb = 0;
  deck = 0;
  ceilingKind = 1;
  /** terrain contact this step (0..1, presentation shudder) + the last contact normal (u, y; VFX) + timers */
  contact = 0;
  contactNu = 0;
  contactNy = 1;
  scrapeAcc = 0;
  scrapeTick = 0;
  impactCd = 0;
  waterCd = 0;
  /** an invisible limit fired (must stay 0: addendum §3) */
  clampEvents = 0;
  s = 0;
  x = 0;
  y = 0;
  prevS = 0;
  prevX = 0;
  prevY = 0;
  vx = 0;
  vy = 0;
  speed = 0;
  hull = 0;
  shield = 0;
  energy = 0;
  boosting = false;
  braking = false;
  /** s left in the empty-energy lockout */
  boostLock = 0;
  /** s since boost was last used (regen waits) */
  sinceBoost = 0;
  /** time into the current roll, -1 = not rolling */
  rollT = -1;
  rollDir = 0;
  rollCd = 0;
  hullImmune = 0;
  sinceDamage = 0;
  fireCd = 0;
  cannon = 0;
  aimYaw = 0;
  aimPitch = 0;
  alive = true;
  grazeCd = 0;
  shotsFired = 0;
  shotsHit = 0;
  damageTaken = 0;
}

export class Enemy {
  /** registry type index (0 = unused) */
  type = 0;
  hp = 0;
  maxHp = 0;
  s = 0;
  x = 0;
  y = 0;
  prevS = 0;
  prevX = 0;
  prevY = 0;
  /** collider radius (2E: per-type collider sets) */
  radius = 1;
  /** seconds of white hit flash left (render) */
  flash = 0;
  /** seconds alive */
  age = 0;
  score = 0;
  /** keeps this rail distance ahead of the player (0 = static in world s) */
  hold = 0;
  constructor(readonly slot: number) {}
}

const DEG = Math.PI / 180;
// scratch (module scope: step() allocates nothing)
const env = { a: 0, b: 0 };
const _n = new Float64Array(3);
const WING_SIDES = [-1, 1] as const;
const order = new Int16Array(CAPS.enemies);

export class Sim {
  readonly cfg: SimConfig;
  readonly level: LevelDef;
  readonly stats: PlayerStats;
  readonly rng: RngStreams;
  readonly player = new Player();
  readonly playerShots = new ProjectilePool(CAPS.playerBullets);
  readonly enemyShots = new ProjectilePool(CAPS.enemyBullets);
  readonly enemies = new SlotPool<Enemy>(CAPS.enemies, i => new Enemy(i));
  readonly events = new EventRing(CAPS.events);
  readonly hud: HudState = createHud();
  tick = 0;
  time = 0;
  score = 0;
  combo = 1;
  comboT = 0;
  kills = 0;
  credits = 0;
  /** next timeline index (spawner) */
  cursor = 0;
  done = false;
  private assist: (typeof AIM_ASSIST)[AimAssist];
  private muzzles: readonly (readonly [number, number, number])[];

  constructor(cfg: SimConfig) {
    this.cfg = cfg;
    this.level = cfg.level;
    this.stats = playerStats(cfg.ship, cfg.tiers);
    this.rng = createStreams(cfg.seed ?? cfg.level.seed);
    this.assist = AIM_ASSIST[cfg.aimAssist ?? 'low'];
    this.muzzles = cfg.muzzles ?? PLAYER.muzzles;
    this.reset(0);
  }

  /** (Re)start at rail position `atM` (retry from a checkpoint): sim state only — pools persist. */
  reset(atM: number): void {
    const p = this.player;
    const st = this.stats;
    p.s = p.prevS = atM;
    p.x = p.y = p.prevX = p.prevY = p.vx = p.vy = 0;
    p.speed = curveAt(this.level.speedCurve, atM) || this.level.cruiseSpeed;
    p.hull = st.maxHull;
    p.shield = st.maxShield;
    p.energy = PLAYER.boost.energy;
    p.boosting = p.braking = false;
    p.boostLock = 0;
    p.scrapeCd = 0;
    p.closeCd = p.skimT = p.streakWall = 0;
    p.turb = p.deck = p.contact = p.scrapeAcc = p.scrapeTick = p.impactCd = p.waterCd = 0;
    p.clampEvents = 0;
    p.closeCalls = p.skimTime = p.wallTime = 0;
    p.sinceBoost = 99;
    p.rollT = -1;
    p.rollCd = p.hullImmune = p.fireCd = p.grazeCd = 0;
    p.sinceDamage = 99;
    p.alive = true;
    p.shotsFired = p.shotsHit = p.damageTaken = 0;
    this.playerShots.clear();
    this.enemyShots.clear();
    this.enemies.clear();
    this.events.clear();
    this.tick = 0;
    this.time = 0;
    this.score = this.kills = this.credits = 0;
    this.combo = 1;
    this.comboT = 0;
    this.done = false;
    this.cursor = 0;
    while (this.cursor < this.level.timeline.length && this.level.timeline[this.cursor].atM < atM) this.cursor++;
    this.writeHud();
  }

  step(input: SimInput): void {
    if (this.done) return;
    this.tick++;
    this.time += STEP;
    this.updatePlayer(input);
    this.updateEnemies();
    this.updateShots(this.playerShots);
    this.updateShots(this.enemyShots);
    this.collidePlayerShots();
    this.collideEnemyShots();
    this.updateScoring();
    if (this.player.s >= this.level.lengthM && this.player.alive) {
      this.done = true;
      this.emit(Ev.LevelComplete, -1, this.player.x, this.player.y, this.player.s);
    }
    if (this.tick % SIM.hudEvery === 0) this.writeHud();
  }

  // ------------------------------------------------------------------ player
  private updatePlayer(input: SimInput): void {
    const p = this.player;
    const st = this.stats;
    const dt = STEP;
    p.prevS = p.s;
    p.prevX = p.x;
    p.prevY = p.y;
    if (!p.alive) return;

    // aim (already clamped to the cone by the producer; clamp again: bots / tests)
    p.aimYaw = Math.max(-PLAYER.aim.coneX, Math.min(PLAYER.aim.coneX, input.aimYaw));
    p.aimPitch = Math.max(-PLAYER.aim.coneY, Math.min(PLAYER.aim.coneY, input.aimPitch));

    // design envelope (tunes the lateral speed only — addendum §3: nothing limits the ship but terrain)
    const world = this.cfg.world;
    if (world) world.path.envelopeAt(p.s, env);
    else envelopeAt(this.level.envelope, p.s, env);
    p.envA = env.a;
    p.envB = env.b;
    const L = FREEDOM.lateral;
    const lim = Math.min(L.max, Math.max(L.min, L.k * env.a)) * (st.lateralSpeed / FREEDOM.agiRef);
    p.latMax = lim;
    const accel = lim / FREEDOM.accelTime, decel = lim / FREEDOM.stopTime;
    if (world) {
      // the height grid's rows ahead (bolts reach ~320 u): new rows only, a few per step
      world.ground.fill?.(p.s - 60, p.s + 700);
      this.measureFree(world);
    }
    if (input.cursor) {
      // KEYBOARD + MOUSE: a critically damped pull toward the cursor's point in the MEASURED free space
      // (kept targetInset inside it, so it never scrapes by accident); the keys nudge the cursor itself
      const w = FREEDOM.omega, I = FREEDOM.targetInset;
      const cx = Math.max(-1, Math.min(1, input.cursorX)), cy = Math.max(-1, Math.min(1, input.cursorY));
      const tx = world ? cx * Math.max(0, (cx > 0 ? p.freeR : p.freeL) - I) : cx * env.a;
      const ty = world ? cy * Math.max(0, (cy > 0 ? p.freeUp : p.freeDown) - I) : cy * env.b;
      let axc = w * w * (tx - p.x) - 2 * w * p.vx, ayc = w * w * (ty - p.y) - 2 * w * p.vy;
      const am = Math.hypot(axc, ayc), amax = Math.max(accel, decel);
      if (am > amax) {
        axc *= amax / am;
        ayc *= amax / am;
      }
      p.vx += axc * dt;
      p.vy += ayc * dt;
      const vm = Math.hypot(p.vx, p.vy);
      if (vm > lim) {
        p.vx *= lim / vm;
        p.vy *= lim / vm;
      }
    } else {
      // KEYBOARD STEERS (default): the movement keys only; the mouse aims and never moves the ship
      let tvx = input.moveX * lim;
      let tvy = input.moveY * lim;
      if (tvx > lim) tvx = lim;
      else if (tvx < -lim) tvx = -lim;
      if (tvy > lim) tvy = lim;
      else if (tvy < -lim) tvy = -lim;
      p.vx = approach(p.vx, tvx, (Math.abs(tvx) > Math.abs(p.vx) && tvx * p.vx >= 0 ? accel : decel) * dt);
      p.vy = approach(p.vy, tvy, (Math.abs(tvy) > Math.abs(p.vy) && tvy * p.vy >= 0 ? accel : decel) * dt);
    }

    // roll: impulse with a linearly decaying profile whose integral is 6 u
    p.rollCd = Math.max(0, p.rollCd - dt);
    if (input.roll !== 0 && p.rollCd <= 0 && p.rollT < 0) {
      p.rollT = 0;
      p.rollDir = input.roll;
      p.rollCd = PLAYER.roll.cooldown;
      this.emit(Ev.Roll, -1, p.x, p.y, p.s, input.roll);
    }
    let rollVx = 0;
    if (p.rollT >= 0) {
      const T = PLAYER.roll.duration;
      const peak = (2 * PLAYER.roll.impulse) / T;
      rollVx = p.rollDir * peak * (1 - p.rollT / T);
      p.rollT += dt;
      if (p.rollT >= T) p.rollT = -1;
    }

    // diegetic ceiling (ridge turbulence / cloud deck): climb authority fades, shear, downdraft
    if (world) this.ceiling(world, lim, dt);

    // forward speed: level curve x boost / brake, eased
    const cruise = curveAt(this.level.speedCurve, p.s) || this.level.cruiseSpeed;
    p.boostLock = Math.max(0, p.boostLock - dt);
    const wantBoost = input.boost && p.boostLock <= 0 && p.energy > 0;
    if (wantBoost !== p.boosting) this.emit(wantBoost ? Ev.BoostOn : Ev.BoostOff, -1, p.x, p.y, p.s);
    p.boosting = wantBoost;
    p.braking = input.brake && !wantBoost;
    if (p.boosting) {
      p.energy -= PLAYER.boost.drain * dt;
      p.sinceBoost = 0;
      if (p.energy <= 0) {
        p.energy = 0;
        p.boostLock = PLAYER.boost.lockout;
        p.boosting = false;
        this.emit(Ev.BoostOff, -1, p.x, p.y, p.s);
      }
    } else {
      p.sinceBoost += dt;
      if (p.sinceBoost >= PLAYER.boost.regenDelay) p.energy = Math.min(PLAYER.boost.energy, p.energy + PLAYER.boost.regen * dt);
    }
    const target = cruise * (p.boosting ? st.boostMult : p.braking ? PLAYER.brake : 1);
    p.speed += (target - p.speed) * (1 - Math.exp(-PLAYER.speedResponse * dt));
    // ALL motion (lateral + forward) through one swept contact: walls slide, a face ahead is an impact
    this.moveAndCollide(p.vx + rollVx, p.vy, p.speed, dt);
    this.terrainScore(dt);
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.s)) {
      // a numerical guard is the ONLY reset the player can get; counted (must stay 0)
      p.x = p.y = p.vx = p.vy = 0;
      p.s = p.prevS;
      p.clampEvents++;
    }

    // shields regenerate after a quiet spell; immunity timers
    p.sinceDamage += dt;
    p.hullImmune = Math.max(0, p.hullImmune - dt);
    if (p.sinceDamage >= st.shieldDelay && p.shield < st.maxShield) p.shield = Math.min(st.maxShield, p.shield + st.shieldRegen * dt);

    // weapons
    p.fireCd -= dt;
    if (input.fire && p.fireCd <= 0) {
      this.firePlayer();
      p.fireCd += 1 / st.fireRate;
      if (p.fireCd < 0) p.fireCd = 0;
    } else if (p.fireCd < 0) p.fireCd = 0;
  }

  /** One bolt from the alternating cannon, converging on the aim point (or an assisted target). */
  private firePlayer(): void {
    const p = this.player;
    const m = this.muzzles[p.cannon];
    p.cannon ^= 1;
    const C = PLAYER.aim.convergence;
    // muzzle in rail space (ship-local x right / y up / z forward)
    const mx = p.x + m[0], my = p.y + m[1], ms = p.s + m[2];
    // convergence point
    let tx = p.x + Math.tan(p.aimYaw) * C, ty = p.y + Math.tan(p.aimPitch) * C, ts = p.s + C;
    // aim assist: nearest valid enemy inside the cone of the aim ray -> steer (capped)
    const a = this.assist;
    if (a.steerDeg > 0) {
      const ax = tx - p.x, ay = ty - p.y, as = C;
      const al = Math.hypot(ax, ay, as);
      let best = -1, bestCos = Math.cos(a.coneDeg * DEG);
      const list = this.enemies.alive;
      for (let k = 0; k < this.enemies.aliveCount; k++) {
        const e = this.enemies.items[list[k]];
        const ex = e.x - p.x, ey = e.y - p.y, es = e.s - p.s;
        if (es < 20 || es > PLAYER.bullet.range) continue;
        const c = (ax * ex + ay * ey + as * es) / (al * Math.hypot(ex, ey, es));
        if (c > bestCos) {
          bestCos = c;
          best = k;
        }
      }
      if (best >= 0) {
        const e = this.enemies.items[list[best]];
        // lead: time to target at bolt speed, enemy velocity from its last step
        const dist = Math.hypot(e.x - mx, e.y - my, e.s - ms);
        const tt = dist / PLAYER.bullet.speed;
        const lx = e.x + ((e.x - e.prevX) / STEP) * tt, ly = e.y + ((e.y - e.prevY) / STEP) * tt;
        const ls = e.s + ((e.s - e.prevS) / STEP - p.speed) * tt + p.speed * tt;
        // steer the aim point toward the lead point, at most steerDeg off the aim ray
        const maxOff = Math.tan(a.steerDeg * DEG) * Math.hypot(ls - ms, 1);
        const ox = lx - tx, oy = ly - ty;
        const ol = Math.hypot(ox, oy);
        const f = ol > maxOff ? maxOff / ol : 1;
        tx += ox * f;
        ty += oy * f;
        ts = ls;
      }
    }
    let dx = tx - mx, dy = ty - my, ds = ts - ms;
    const L = Math.hypot(dx, dy, ds) || 1;
    const v = PLAYER.bullet.speed / L;
    dx *= v;
    dy *= v;
    ds *= v;
    const i = this.playerShots.spawn(ms, mx, my, ds + p.speed, dx, dy, PLAYER.bullet.range / PLAYER.bullet.speed, this.stats.damage, PLAYER.bullet.radius, Shot.PlayerBolt);
    if (i >= 0) {
      p.shotsFired++;
      this.emit(Ev.PlayerFire, -1, mx, my, ms, p.cannon ^ 1);
    }
  }

  // ----------------------------------------------------------------- enemies
  private updateEnemies(): void {
    const ps = this.player.s;
    const list = this.enemies.alive;
    for (let k = this.enemies.aliveCount - 1; k >= 0; k--) {
      const e = this.enemies.items[list[k]];
      e.prevS = e.s;
      e.prevX = e.x;
      e.prevY = e.y;
      e.age += STEP;
      if (e.flash > 0) e.flash -= STEP;
      if (e.hold > 0) e.s = ps + e.hold;
      if (e.s < ps - RAIL.despawnBehind) this.enemies.release(e.slot);
    }
  }

  /** Spawn an enemy of `type` (registry index) — used by the spawner (2E) and tests / simlab. */
  spawnEnemy(type: number, s: number, x: number, y: number, hp: number, radius: number, score: number, hold = 0): Enemy | null {
    const slot = this.enemies.acquire();
    if (slot < 0) return null;
    const e = this.enemies.items[slot];
    e.type = type;
    e.hp = e.maxHp = hp;
    e.s = e.prevS = s;
    e.x = e.prevX = x;
    e.y = e.prevY = y;
    e.radius = radius;
    e.flash = 0;
    e.age = 0;
    e.score = score;
    e.hold = hold;
    return e;
  }

  // ------------------------------------------------------------- projectiles
  private updateShots(pool: ProjectilePool): void {
    const world = this.cfg.world;
    for (let i = pool.count - 1; i >= 0; i--) {
      pool.s[i] += pool.vs[i] * STEP;
      pool.x[i] += pool.vx[i] * STEP;
      pool.y[i] += pool.vy[i] * STEP;
      pool.life[i] -= STEP;
      if (pool.life[i] <= 0) {
        pool.kill(i);
        continue;
      }
      // bolts that reach the ground burst into a surface puff (player and enemy bolts alike)
      if (world) {
        const s = pool.s[i], x = pool.x[i], y = pool.y[i];
        if (world.path.yAt(s) + y < world.ground.height(s, x)) {
          this.emit(Ev.Spark, -1, x, y, s, 0, 1);
          pool.kill(i);
        }
      }
    }
  }

  // -------------------------------------------------------------- collisions
  private collidePlayerShots(): void {
    const n = this.enemies.aliveCount;
    if (n === 0 || this.playerShots.count === 0) return;
    // broadphase: live enemies sorted by s (insertion sort, <= 40)
    let maxR = 0;
    for (let k = 0; k < n; k++) {
      const slot = this.enemies.alive[k];
      const e = this.enemies.items[slot];
      if (e.radius > maxR) maxR = e.radius;
      let j = k - 1;
      while (j >= 0 && this.enemies.items[order[j]].s > e.s) {
        order[j + 1] = order[j];
        j--;
      }
      order[j + 1] = slot;
    }
    const pool = this.playerShots;
    for (let i = pool.count - 1; i >= 0; i--) {
      const s1 = pool.s[i], s0 = s1 - pool.vs[i] * STEP;
      const x1 = pool.x[i], x0 = x1 - pool.vx[i] * STEP;
      const y1 = pool.y[i], y0 = y1 - pool.vy[i] * STEP;
      const lo = Math.min(s0, s1) - maxR - 8, hi = Math.max(s0, s1) + maxR + 8;
      // first candidate by binary search
      let a = 0, b = n;
      while (a < b) {
        const mid = (a + b) >> 1;
        if (this.enemies.items[order[mid]].s < lo) a = mid + 1;
        else b = mid;
      }
      let hitSlot = -1, hitT = 2;
      for (let k = a; k < n; k++) {
        const e = this.enemies.items[order[k]];
        if (e.s > hi) break;
        if (e.hp <= 0) continue;
        // relative motion over the step (enemy moved too)
        const px = x0 - e.prevX, py = y0 - e.prevY, pz = s0 - e.prevS;
        const dx = x1 - e.x - px, dy = y1 - e.y - py, dz = s1 - e.s - pz;
        const t = segSphere(px, py, pz, dx, dy, dz, e.radius + pool.radius[i]);
        if (t >= 0 && t < hitT) {
          hitT = t;
          hitSlot = e.slot;
        }
      }
      if (hitSlot >= 0) {
        const e = this.enemies.items[hitSlot];
        this.player.shotsHit++;
        this.damageEnemy(e, pool.dmg[i], x0 + (x1 - x0) * hitT, y0 + (y1 - y0) * hitT, s0 + (s1 - s0) * hitT, 0);
        pool.kill(i);
      }
    }
  }

  /** enemy projectiles vs the player hurtbox (r 1.6: smaller than the model — fair, brief §5) */
  private collideEnemyShots(): void {
    const p = this.player;
    if (!p.alive) return;
    const pool = this.enemyShots;
    for (let i = pool.count - 1; i >= 0; i--) {
      const s1 = pool.s[i], s0 = s1 - pool.vs[i] * STEP;
      // cheap reject: not near the player's rail position this step
      if (Math.abs(s1 - p.s) > 12 && Math.abs(s0 - p.prevS) > 12) continue;
      const x1 = pool.x[i], x0 = x1 - pool.vx[i] * STEP;
      const y1 = pool.y[i], y0 = y1 - pool.vy[i] * STEP;
      const px = x0 - p.prevX, py = y0 - p.prevY, pz = s0 - p.prevS;
      const t = segSphere(px, py, pz, x1 - p.x - px, y1 - p.y - py, s1 - p.s - pz, PLAYER.hurtRadius + pool.radius[i]);
      if (t < 0) {
        // a bolt crossing the player's plane this step close by (not a hit) = a close call
        if ((s0 - p.prevS) * (s1 - p.s) <= 0 && p.closeCd <= 0) {
          const miss = Math.hypot(x1 - p.x, y1 - p.y) - PLAYER.hurtRadius - pool.radius[i];
          if (miss < FREEDOM.closeBolt) this.closeCall(0);
        }
        continue;
      }
      const hx = x0 + (x1 - x0) * t, hy = y0 + (y1 - y0) * t, hs = s0 + (s1 - s0) * t;
      const dmg = pool.dmg[i];
      pool.kill(i);
      this.damagePlayer(dmg, 0, hx, hy, hs);
    }
  }

  private damageEnemy(e: Enemy, dmg: number, x: number, y: number, s: number, weak: number): void {
    e.hp -= dmg;
    e.flash = 0.08;
    this.emit(Ev.Hit, e.slot, x, y, s, dmg, weak);
    this.hud.targetSlot = e.slot;
    if (e.hp <= 0) {
      this.kills++;
      const value = Math.round(e.score * this.combo);
      this.score += value;
      this.combo = Math.min(SCORING.comboMax, this.combo + SCORING.comboStep);
      this.comboT = SCORING.comboWindow;
      this.emit(Ev.Kill, e.slot, e.x, e.y, e.s, value, e.type);
      this.emit(Ev.Explode, e.slot, e.x, e.y, e.s, 1);
      this.enemies.release(e.slot);
    }
  }


  // ------------------------------------------------------- terrain contact (addendum §3)
  /** free space at the path line: lateral scan to terrain, the ceiling above, the ground below */
  private measureFree(world: NonNullable<SimConfig['world']>): void {
    const p = this.player, G = world.ground, s = p.s;
    const py = world.path.yAt(s);
    const step = CONTACT.scanStep, max = CONTACT.scanMax;
    let l: number = max, r: number = max;
    for (let u = step; u <= max; u += step) {
      if (G.height(s, -u) > py) {
        l = u;
        break;
      }
    }
    for (let u = step; u <= max; u += step) {
      if (G.height(s, u) > py) {
        r = u;
        break;
      }
    }
    p.freeL = l;
    p.freeR = r;
    p.freeDown = Math.max(0, py - G.height(s, 0));
    // ceiling: the cloud deck, or a canyon rim when both walls are within reach and below the deck
    const deck = world.path.deckAt ? world.path.deckAt(s) : py + Math.max(CEILING.deckK * p.envB, CEILING.deckMin);
    let ceil = deck, kind = 1;
    if (l < max && r < max) {
      let topL = -Infinity, topR = -Infinity;
      for (const d of CEILING.rimProbe) {
        topL = Math.max(topL, G.height(s, -(l + d)));
        topR = Math.max(topR, G.height(s, r + d));
      }
      const rim = Math.min(topL, topR);
      if (rim < deck) {
        ceil = rim;
        kind = 0;
      }
    }
    p.freeUp = Math.max(0, ceil - py);
    p.ceilingKind = kind;
  }

  /** ridge turbulence / cloud deck: climb authority fades to zero at the ceiling, shear, downdraft above */
  private ceiling(world: NonNullable<SimConfig['world']>, lim: number, dt: number): void {
    const p = this.player;
    const wy = world.path.yAt(p.s) + p.y;
    const ceilY = world.path.yAt(p.s) + p.freeUp;
    const below = ceilY - wy;
    p.turb = Math.min(1, Math.max(0, 1 - below / CEILING.zone));
    // inside the cloud base: the whiteout builds over the last deckFog u below the deck
    p.deck = p.ceilingKind === 1 ? Math.min(1, Math.max(0, 1 - below / CEILING.deckFog)) : 0;
    if (p.turb <= 0) return;
    // climb authority: the rising-air shear eats the climb as the rim / deck nears
    const cap = lim * Math.max(0, below) / CEILING.zone;
    if (p.vy > cap) p.vy = cap;
    // shear: deterministic gusts (sim stream)
    p.vx += (this.rng.sim.next() - 0.5) * 2 * CEILING.shear * p.turb * dt;
    p.vy += (this.rng.sim.next() - 0.5) * CEILING.shear * 0.6 * p.turb * dt;
    // above the deck / rim: the air pushes the ship back down
    if (below < 0) p.vy -= (CEILING.downdraft + CEILING.downdraftPerU * -below) * dt;
  }

  /**
   * Swept contact: the motion (lateral x / y + forward s) is split into sub-steps no longer than
   * CONTACT.sweep x hullR; after each, the hull sphere (ring of samples + centre, each with the gradient
   * plane) and the two wing-tip spheres are pushed out along the deepest contact normal and the velocity
   * loses its into-surface part (slide) — or, fast enough, bounces 30 % and takes impact damage.
   */
  private moveAndCollide(vx: number, vy: number, vs: number, dt: number): void {
    const p = this.player, world = this.cfg.world;
    const dist = Math.hypot(vx, vy, vs) * dt;
    const n = world ? Math.max(1, Math.ceil(dist / (CONTACT.sweep * CONTACT.hullR))) : 1;
    const h = dt / n;
    p.contact = 0;
    p.impactCd = Math.max(0, p.impactCd - dt);
    p.waterCd = Math.max(0, p.waterCd - dt);
    for (let k = 0; k < n; k++) {
      p.x += vx * h;
      p.y += vy * h;
      p.s += vs * h;
      if (!world) continue;
      if (this.contactPass(world, h) > 0) {
        // the rest of the sub-steps move with the response velocity (a roll into a wall ends there)
        vx = p.vx;
        vy = p.vy;
        vs = p.speed;
      }
    }
    if (world) this.waterPass(world, dt);
  }

  /** one contact resolution at the current position; returns the deepest penetration (u) */
  private contactPass(world: NonNullable<SimConfig['world']>, h: number): number {
    const p = this.player, G = world.ground;
    const wy = world.path.yAt(p.s) + p.y;
    const R = CONTACT.hullR;
    let best = 0, nU = 0, nY = 1, nS = 0;
    // hull: centre + ring (in the s-u plane at the hull's height), each sample's tangent plane
    for (let i = -1; i < CONTACT.ring; i++) {
      const a = i < 0 ? 0 : (i / CONTACT.ring) * Math.PI * 2;
      const du = i < 0 ? 0 : Math.cos(a) * R, ds = i < 0 ? 0 : Math.sin(a) * R;
      const pen = this.planePen(G, p.s + ds, p.x + du, p.s, p.x, wy, R, _n);
      if (pen > best) {
        best = pen;
        nU = _n[0];
        nY = _n[1];
        nS = _n[2];
      }
    }
    // wing tips (bank from the lateral velocity, deterministic; the visual attitude may differ a little)
    const hs = this.cfg.wingHalfSpan ?? 0;
    if (hs > 0) {
      const bank = Math.max(-1, Math.min(1, p.vx / Math.max(1, p.latMax))) * FEEL.bankMax * 0.57; // ~ +-40 deg
      const cb = Math.cos(bank), sb = Math.sin(bank);
      for (const side of WING_SIDES) {
        const tu = p.x + side * hs * cb, ty = wy - side * hs * sb;
        const pen = this.planePen(G, p.s, tu, p.s, tu, ty, CONTACT.wingR, _n);
        if (pen > best) {
          best = pen;
          nU = _n[0];
          nY = _n[1];
          nS = _n[2];
        }
      }
    }
    if (best <= 0) return 0;
    // push out along the normal (u, y, s components)
    p.x += nU * best;
    p.y += nY * best;
    p.s += nS * best;
    p.contact = Math.min(1, Math.max(p.contact, best / R + 0.3));
    p.contactNu = nU;
    p.contactNy = nY;
    // velocity response: into-surface component removed (slide) or bounced (impact)
    const vn = p.vx * nU + p.vy * nY + p.speed * nS;
    if (vn < 0) {
      const closing = -vn;
      const k = closing >= CONTACT.impactAt ? 1 + CONTACT.bounce : 1;
      p.vx -= k * vn * nU;
      p.vy -= k * vn * nY;
      // forward speed: a face ahead takes speed away; a contact never ADDS rail speed (no wall surfing)
      const dvs = -k * vn * nS;
      if (dvs < 0) {
        const cruise = curveAt(this.level.speedCurve, p.s) || this.level.cruiseSpeed;
        p.speed = Math.max(cruise * CONTACT.minSpeedShare, p.speed + dvs);
      }
      if (closing >= CONTACT.impactAt && p.impactCd <= 0) {
        const t = Math.min(1, (closing - CONTACT.impactAt) / (CONTACT.impactFull - CONTACT.impactAt));
        const dmg = CONTACT.impactMin + (CONTACT.impactMax - CONTACT.impactMin) * t;
        p.impactCd = CONTACT.impactImmunity;
        this.damagePlayer(dmg, 1, p.x, p.y, p.s);
        p.hullImmune = Math.max(p.hullImmune, CONTACT.impactImmunity);
        this.emit(Ev.GroundScrape, -1, p.x, p.y, p.s, dmg, 1);
        return best;
      }
    }
    // sliding contact at speed: scrape (shield first), a few u/s or more along the surface
    const tangential = Math.hypot(p.vx - (p.vx * nU + p.vy * nY) * nU, p.vy - (p.vx * nU + p.vy * nY) * nY, p.speed * (1 - Math.abs(nS)));
    if (tangential > CONTACT.scrapeSpeed) p.scrapeAcc += CONTACT.scrapeDps * h;
    return best;
  }

  /**
   * Penetration of a sphere (centre (cs, cu, cy), radius r) into the tangent plane of the terrain at the
   * sample (ss, su); `out` = the plane's unit normal (u, y, s). <= 0: no contact.
   */
  private planePen(G: SimGround, ss: number, su: number, cs: number, cu: number, cy: number, r: number, out: Float64Array): number {
    const hh = G.height(ss, su);
    // quick reject: the sample surface far below the sphere
    if (hh < cy - r - 6) return 0;
    const gu = (G.height(ss, su + 0.75) - G.height(ss, su - 0.75)) / 1.5;
    const gs = (G.height(ss + 0.75, su) - G.height(ss - 0.75, su)) / 1.5;
    const inv = 1 / Math.sqrt(1 + gu * gu + gs * gs);
    const nu = -gu * inv, ny = inv, ns = -gs * inv;
    out[0] = nu;
    out[1] = ny;
    out[2] = ns;
    const d = (cu - su) * nu + (cy - hh) * ny + (cs - ss) * ns;
    return r - d;
  }

  /** water: splash + drag + damage (rate-limited) + a bounce up */
  private waterPass(world: NonNullable<SimConfig['world']>, dt: number): void {
    const p = this.player, G = world.ground;
    if (!G.water) return;
    const wY = G.water(p.s, p.x);
    if (!(wY === wY)) return; // NaN = dry
    const wy = world.path.yAt(p.s) + p.y;
    if (wy - CONTACT.hullR * 0.5 > wY) return;
    p.speed *= Math.exp(-CONTACT.waterDrag * dt);
    if (p.vy < CONTACT.waterBounce) p.vy = CONTACT.waterBounce;
    if (p.waterCd <= 0) {
      p.waterCd = CONTACT.waterCd;
      this.damagePlayer(CONTACT.waterDamage, 1, p.x, p.y, p.s);
      this.emit(Ev.Splash, -1, p.x, p.y, p.s, CONTACT.waterDamage);
    }
  }

  /** scrape damage ticks, skim / wall-run / rock close calls */
  private terrainScore(dt: number): void {
    const p = this.player, world = this.cfg.world;
    p.scrapeCd = Math.max(0, p.scrapeCd - dt);
    p.closeCd = Math.max(0, p.closeCd - dt);
    p.scrapeTick -= dt;
    if (p.scrapeAcc > 0 && p.scrapeTick <= 0) {
      p.scrapeTick = CONTACT.scrapeTick;
      const dmg = p.scrapeAcc;
      p.scrapeAcc = 0;
      this.damagePlayer(dmg, 1, p.x, p.y, p.s);
      this.emit(Ev.GroundScrape, -1, p.x, p.y, p.s, dmg, 0);
    }
    if (!world) return;
    const G = world.ground;
    const wy = world.path.yAt(p.s) + p.y;
    const vClear = wy - G.height(p.s, p.x);
    // lateral probes measure from the ship's OUTERMOST point (the wing tips when it has wings): a winged
    // ship hugging a wall keeps its centre a whole half-span away from it
    const hs = this.cfg.wingHalfSpan ?? 0;
    const ext = hs > 0 ? hs + CONTACT.wingR : CONTACT.hullR;
    // a close call: rock within closeRock of the hull underside or of the outermost point, no contact
    const under = vClear - CONTACT.hullR;
    const side = G.height(p.s, p.x - ext - FREEDOM.closeRock) > wy - CONTACT.hullR || G.height(p.s, p.x + ext + FREEDOM.closeRock) > wy - CONTACT.hullR;
    if (p.contact <= 0 && p.closeCd <= 0 && ((under > 0 && under < FREEDOM.closeRock) || side)) this.closeCall(1);
    const wall = G.height(p.s, p.x - ext - FREEDOM.wallProbe) > wy || G.height(p.s, p.x + ext + FREEDOM.wallProbe) > wy;
    const skim = vClear < FREEDOM.skimAt && p.contact <= 0;
    if (skim || wall) {
      const before = Math.floor(p.skimT);
      p.skimT += dt;
      if (skim) p.skimTime += dt;
      if (wall) p.wallTime += dt;
      p.streakWall = wall ? 1 : 0;
      if (Math.floor(p.skimT) > before) this.score += Math.round(FREEDOM.skimScore * this.combo);
    } else p.skimT = 0;
  }

  /** a near miss: score (x combo) + a shield tick + an event (whoosh / HUD) */
  private closeCall(kind: number): void {
    const p = this.player;
    p.closeCd = FREEDOM.closeCooldown;
    p.closeCalls++;
    const v = Math.round(FREEDOM.closeScore * this.combo);
    this.score += v;
    p.shield = Math.min(this.stats.maxShield, p.shield + FREEDOM.closeShield);
    this.emit(Ev.CloseCall, -1, p.x, p.y, p.s, kind, v);
  }

  // ------------------------------------------------------------------ damage
  /** Damage to the player. kind 0 = projectile (roll i-frames apply), 1 = hazard / collision. Returns hull lost. */
  damagePlayer(amount: number, kind: 0 | 1, x: number, y: number, s: number): number {
    const p = this.player;
    if (!p.alive || amount <= 0) return 0;
    if (kind === 0 && p.rollT >= PLAYER.roll.iframeFrom && p.rollT <= PLAYER.roll.iframeTo) {
      this.emit(Ev.Graze, -1, x, y, s, 1);
      return 0;
    }
    p.sinceDamage = 0;
    const god = !!this.cfg.god;
    const toShield = Math.min(p.shield, amount);
    if (!god) p.shield -= toShield;
    if (toShield > 0) this.emit(Ev.PlayerShield, -1, x, y, s, toShield);
    const rest = amount - toShield;
    if (rest <= 0 || p.hullImmune > 0) return 0;
    if (!god) p.hull -= rest;
    p.damageTaken += rest;
    p.hullImmune = PLAYER.hullImmunity;
    this.combo = 1;
    this.comboT = 0;
    this.emit(Ev.PlayerHull, -1, x, y, s, rest, kind);
    if (p.hull <= 0) {
      p.hull = 0;
      p.alive = false;
      this.emit(Ev.PlayerDied, -1, p.x, p.y, p.s);
    }
    return rest;
  }

  // ----------------------------------------------------------------- scoring
  private updateScoring(): void {
    if (this.comboT > 0) {
      this.comboT -= STEP;
      if (this.comboT <= 0) {
        this.comboT = 0;
        this.combo = 1;
      }
    }
  }

  // ------------------------------------------------------------------ events
  emit(type: Ev, id: number, x: number, y: number, s: number, a = 0, b = 0): void {
    this.events.push(type, this.tick, id, x, y, s, a, b);
  }

  // --------------------------------------------------------------------- HUD
  private writeHud(): void {
    const h = this.hud, p = this.player, st = this.stats;
    h.seq++;
    h.hull = p.hull;
    h.maxHull = st.maxHull;
    h.shield = p.shield;
    h.maxShield = st.maxShield;
    h.energy = p.energy / PLAYER.boost.energy;
    h.boostLocked = p.boostLock > 0;
    h.speed = p.speed;
    h.rollCd = p.rollCd / PLAYER.roll.cooldown;
    h.score = this.score;
    h.combo = this.combo;
    h.comboT = this.comboT / SCORING.comboWindow;
    h.credits = this.credits;
    h.progress = Math.min(1, p.s / this.level.lengthM);
    h.alive = p.alive;
    if (h.targetSlot >= 0) {
      if (!this.enemies.isLive(h.targetSlot)) h.targetSlot = -1;
      else {
        const e = this.enemies.items[h.targetSlot];
        h.targetType = e.type;
        h.targetHp = e.hp / e.maxHp;
      }
    }
  }
}

function approach(v: number, target: number, maxDelta: number): number {
  return v < target ? Math.min(target, v + maxDelta) : Math.max(target, v - maxDelta);
}
