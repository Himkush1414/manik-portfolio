// Scripted pilot (brief §15). Pure: reads the Sim, writes a SimInput. Its own
// RNG stream (never the sim's), so a bot run is deterministic per (sim seed,
// bot seed). Human-like limits come from data/bot.ts: perception delay,
// per-target aim error, imperfect dodging, sloppy wandering.
import type { Sim } from '../sim';
import type { SimInput } from '../input';
import { Rng } from '../core/rng';
import { STEP } from '../core/step';
import { BOT, BOT_SKILLS, type BotSkillId } from '../../data/bot';
import { PLAYER, RAIL } from '../../data/mission';

const DEG = Math.PI / 180;

export class Bot {
  readonly skill;
  private rng: Rng;
  private target = -1;
  /** seconds the current target has been seen (aim starts after `reaction`) */
  private seen = 0;
  private errYaw = 0;
  private errPitch = 0;
  private dodgeX = 0;
  private dodgeY = 0;
  private dodgeT = 0;
  private wanderT = 0;
  private rerollT = 0;
  private weave = 0;
  /** projectile serials already judged (each threat rolls the dodge dice once) */
  private judged = new Uint32Array(64);
  private judgedN = 0;
  stats = { dodges: 0, rolls: 0, targets: 0 };

  constructor(
    readonly skillId: BotSkillId,
    seed: number,
  ) {
    this.skill = BOT_SKILLS[skillId];
    this.rng = new Rng(seed ^ 0x5bd1e995);
    this.weave = this.rng.range(0, 6.28);
  }

  think(sim: Sim, out: SimInput): SimInput {
    const p = sim.player;
    const sk = this.skill;
    out.roll = 0;
    out.brake = false;
    this.weave += STEP;

    // ---- target: nearest live enemy ahead in the useful range (sticky)
    if (this.target >= 0 && !sim.enemies.isLive(this.target)) this.target = -1;
    if (this.target < 0) {
      let best = -1, bd = 1e9;
      for (let k = 0; k < sim.enemies.aliveCount; k++) {
        const e = sim.enemies.items[sim.enemies.alive[k]];
        const d = e.s - p.s;
        if (d < 25 || d > PLAYER.bullet.range * 0.9) continue;
        const cost = d + Math.hypot(e.x - p.x, e.y - p.y) * 2;
        if (cost < bd) {
          bd = cost;
          best = e.slot;
        }
      }
      if (best >= 0) {
        this.target = best;
        this.seen = 0;
        this.rollError();
        this.stats.targets++;
      }
    }
    this.seen += STEP;
    // the aim error is re-rolled every `reroll` s on the same target (the correction below restarts)
    this.rerollT -= STEP;
    if (this.target >= 0 && this.rerollT <= 0) {
      this.rollError();
      this.seen = sk.reaction;
    }

    // ---- aim + fire (after the perception delay)
    let wantX = Math.sin(this.weave * 0.6) * 0.4, wantY = Math.sin(this.weave * 0.9) * 0.3;
    if (this.target >= 0 && this.seen >= sk.reaction) {
      const e = sim.enemies.items[this.target];
      const d = Math.max(1, e.s - p.s);
      const lead = BOT.leadSkill[this.skillId] * (d / PLAYER.bullet.speed);
      const ex = e.x + ((e.x - e.prevX) / STEP) * lead, ey = e.y + ((e.y - e.prevY) / STEP) * lead;
      const corr = sk.residual + (1 - sk.residual) * Math.exp(-(this.seen - sk.reaction) / sk.correct);
      out.aimYaw = Math.atan2(ex - p.x, d) + this.errYaw * corr;
      out.aimPitch = Math.atan2(ey - p.y, d) + this.errPitch * corr;
      out.fire = Math.abs(out.aimYaw) < PLAYER.aim.coneX && Math.abs(out.aimPitch) < PLAYER.aim.coneY;
      // drift toward the target's lane (keeps it inside the cone)
      wantX = ex / RAIL.envelope.a;
      wantY = ey / RAIL.envelope.b;
    } else {
      out.aimYaw *= 0.9;
      out.aimPitch *= 0.9;
      out.fire = false;
    }
    // sloppiness: brief wanders off the line
    this.wanderT -= STEP;
    if (this.wanderT <= 0 && this.rng.next() < sk.wander * STEP) this.wanderT = this.rng.range(0.3, 0.9);
    if (this.wanderT > 0) out.fire = false;

    // ---- threats: enemy projectiles predicted to pass close within the horizon
    this.dodgeT -= STEP;
    const shots = sim.enemyShots;
    for (let i = 0; i < shots.count; i++) {
      const rs = shots.s[i] - p.s;
      const closing = p.speed - shots.vs[i];
      if (rs <= 0 || closing <= 0) continue;
      const t = rs / closing;
      if (t > BOT.threatHorizon) continue;
      const px = shots.x[i] + shots.vx[i] * t - p.x, py = shots.y[i] + shots.vy[i] * t - p.y;
      if (Math.hypot(px, py) > PLAYER.hurtRadius + shots.radius[i] + 1.2) continue;
      if (this.wasJudged(shots.serial[i])) continue;
      if (t > BOT.threatHorizon - sk.reaction) continue; // not perceived yet
      this.judge(shots.serial[i]);
      if (this.rng.next() > sk.dodge) continue;
      this.stats.dodges++;
      if (t < PLAYER.roll.iframeTo && p.rollCd <= 0 && this.rng.next() < sk.rollUse) {
        out.roll = px > 0 ? -1 : 1;
        this.stats.rolls++;
      } else {
        this.dodgeX = px > 0 ? -1 : 1;
        this.dodgeY = py > 0 ? -0.5 : 0.5;
        this.dodgeT = 0.35;
      }
    }

    // ---- steering: dodge > lane target, kept inside the envelope margin
    const ax = this.dodgeT > 0 ? this.dodgeX : clamp(wantX * BOT.margin * RAIL.envelope.a - p.x, 1) ;
    const ay = this.dodgeT > 0 ? this.dodgeY : clamp(wantY * BOT.margin * RAIL.envelope.b - p.y, 1);
    out.moveX = Math.abs(ax) < 0.05 ? 0 : ax;
    out.moveY = Math.abs(ay) < 0.05 ? 0 : ay;
    out.boost = this.target < 0 && p.energy > 60 && this.rng.next() < sk.boostUse;
    return out;
  }

  private wasJudged(serial: number): boolean {
    for (let i = 0; i < this.judgedN; i++) if (this.judged[i] === serial) return true;
    return false;
  }

  private judge(serial: number): void {
    if (this.judgedN < this.judged.length) this.judged[this.judgedN++] = serial;
    else {
      this.judged.copyWithin(0, 1);
      this.judged[this.judged.length - 1] = serial;
    }
  }

  private rollError(): void {
    this.rerollT = this.skill.reroll;
    this.errYaw = this.gauss() * this.skill.aimErrorDeg * DEG;
    this.errPitch = this.gauss() * this.skill.aimErrorDeg * DEG;
  }

  /** standard normal (Box-Muller) from the bot stream */
  private gauss(): number {
    const u = Math.max(1e-9, this.rng.next()), v = this.rng.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
}

function clamp(v: number, lim: number): number {
  return v > lim ? lim : v < -lim ? -lim : v;
}
