// The deterministic mission simulation (brief §3, §5, §7, §10). Pure
// TypeScript: no three.js / React / DOM (tests/gameBoundary.test.ts). One call
// to step() = one fixed 1/60 s tick, in the brief's order:
//   input -> player -> spawner -> AI -> projectiles -> collisions -> damage
//   -> pickups -> scoring -> events -> HUD bus
// Everything is preallocated; step() allocates nothing. Same LevelDef + seed
// + input script => identical state (tests/sim.test.ts).
import { CAPS, PLAYER, RAIL, SIM, AIM_ASSIST, SCORING, type AimAssist } from '../data/mission';
import { playerStats, type PlayerStats } from '../data/stats';
import type { ShipId } from '../data/ships';
import type { UpgradeTiers } from '../data/upgrades';
import type { LevelDef } from '../levels/types';
import { STEP } from './core/step';
import { createStreams, type RngStreams } from './core/rng';
import { EventRing, Ev } from './core/events';
import { ProjectilePool, SlotPool } from './core/pool';
import { curveAt, envelopeAt, ellipseR } from './rail';
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
};

export class Player {
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

  constructor(cfg: SimConfig) {
    this.cfg = cfg;
    this.level = cfg.level;
    this.stats = playerStats(cfg.ship, cfg.tiers);
    this.rng = createStreams(cfg.seed ?? cfg.level.seed);
    this.assist = AIM_ASSIST[cfg.aimAssist ?? 'low'];
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

    // lateral: velocity command = keys + mouse fine positioning (15 % of the
    // reticle offset at convergence becomes a position target, tau 0.25 s)
    let tvx = input.moveX * st.lateralSpeed;
    let tvy = input.moveY * st.lateralSpeed;
    if (input.aimSteer) {
      const C = PLAYER.aim.convergence;
      tvx += (Math.tan(p.aimYaw) * C * PLAYER.aim.steer) / PLAYER.aim.steerTau;
      tvy += (Math.tan(p.aimPitch) * C * PLAYER.aim.steer) / PLAYER.aim.steerTau;
    }
    const lim = st.lateralSpeed;
    if (tvx > lim) tvx = lim;
    else if (tvx < -lim) tvx = -lim;
    if (tvy > lim) tvy = lim;
    else if (tvy < -lim) tvy = -lim;
    p.vx = approach(p.vx, tvx, (Math.abs(tvx) > Math.abs(p.vx) && tvx * p.vx >= 0 ? st.accel : st.decel) * dt);
    p.vy = approach(p.vy, tvy, (Math.abs(tvy) > Math.abs(p.vy) && tvy * p.vy >= 0 ? st.accel : st.decel) * dt);

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

    p.x += (p.vx + rollVx) * dt;
    p.y += p.vy * dt;

    // soft envelope: spring back proportional to the overshoot, graze sparks
    envelopeAt(this.level.envelope, p.s, env);
    const r = ellipseR(p.x, p.y, env.a, env.b);
    p.grazeCd = Math.max(0, p.grazeCd - dt);
    if (r > 1) {
      const over = Math.min(r - 1, RAIL.envelopeSoft);
      // inward normal of the ellipse (gradient), scaled
      let nx = p.x / (env.a * env.a), ny = p.y / (env.b * env.b);
      const nl = Math.hypot(nx, ny) || 1;
      nx /= nl;
      ny /= nl;
      const k = RAIL.envelopeSpring * over * dt;
      p.vx -= nx * k * env.a;
      p.vy -= ny * k * env.b;
      // never further out than the soft limit
      if (r > 1 + RAIL.envelopeSoft) {
        const f = (1 + RAIL.envelopeSoft) / r;
        p.x *= f;
        p.y *= f;
      }
      if (p.grazeCd <= 0) {
        p.grazeCd = RAIL.grazeEvery;
        this.emit(Ev.Graze, -1, p.x, p.y, p.s);
      }
    }

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
    p.s += p.speed * dt;

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
    const m = PLAYER.muzzles[p.cannon];
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
    const R2 = RAIL.tunnelRadius * RAIL.tunnelRadius;
    for (let i = pool.count - 1; i >= 0; i--) {
      pool.s[i] += pool.vs[i] * STEP;
      pool.x[i] += pool.vx[i] * STEP;
      pool.y[i] += pool.vy[i] * STEP;
      pool.life[i] -= STEP;
      const x = pool.x[i], y = pool.y[i];
      if (pool.life[i] <= 0) pool.kill(i);
      else if (x * x + y * y > R2) {
        this.emit(Ev.Spark, -1, x, y, pool.s[i]);
        pool.kill(i);
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
