// Mission VFX hub (brief §3 EVENT BUS, §13): owns the weapon / impact /
// trail renderers, reads the sim's event ring with its own cursor and turns
// events into GPU spawn records — the sim never calls VFX. Built once
// (MissionLoader), compiled with the mission root in prepare, reused across
// launches and retries. Per frame: drain events -> bolts -> muzzle -> ribbons
// -> particle uploads. No allocation per frame.
import { Object3D, type Group } from 'three';
import { Ev, type EventReader } from '../../../game/core/events';
import type { Sim } from '../../../game/sim';
import { BURSTS, MUZZLE, RAMPS, SCRAPE_STREAM } from '../../../data/vfx';
import { CONTACT } from '../../../data/mission';
import { QUALITY, type Preset } from '../../quality';
import type { ShipSpec } from '../../../ships/types';
import { cannonMuzzles, engineMounts, wingTips } from '../../../scenes/mission/shipMounts';
import { Particles } from './Particles';
import { Bolts } from './Bolts';
import { MuzzleFlash } from './MuzzleFlash';
import { Ribbons } from './Ribbons';
import { pick, vfxRng } from './gpu';

type Burst = { count: number; speed: readonly [number, number]; life: readonly [number, number]; size: readonly [number, number]; drag: number; spread: number };

export class MissionVfx {
  readonly particles = new Particles();
  readonly bolts = new Bolts();
  readonly muzzle = new MuzzleFlash();
  readonly ribbons = new Ribbons();
  private reader: EventReader | null = null;
  private readerSim: Sim | null = null;
  private sim: Sim | null = null;
  private tips = [new Object3D(), new Object3D()];
  private engines: [number, number, number][] = [];
  private onEv = (slot: number) => this.event(slot);
  /** terrain surface at path-relative (s, u): 0 soil / grass, 1 rock (MissionLoader binds the world) */
  surfaceAt: (s: number, u: number) => number = () => 0;
  /** continuous-scrape emission carry (fractional particles between frames) */
  private scrapeCarry = 0;
  private dustCarry = 0;

  /** mission root gets the world-space effects; the attitude group gets the muzzle flashes */
  attach(root: Group, player: Group): void {
    root.add(this.particles.mesh, this.bolts.tracers, this.bolts.orbs, this.ribbons.mesh);
    player.add(this.muzzle.group);
  }

  /** the flown ship: muzzle flashes at its cannons, ribbons from its wing tips, boost puffs at its engines */
  setShip(model: Group, spec: ShipSpec): void {
    const m = cannonMuzzles(spec);
    this.muzzle.setMuzzles(m);
    const t = wingTips(spec);
    for (let i = 0; i < 2; i++) {
      this.tips[i].position.set(t[i][0], t[i][1], t[i][2]);
      model.add(this.tips[i]);
    }
    this.ribbons.setTips(this.tips[1], this.tips[0]);
    this.engines = engineMounts(spec).map(e => [-e[0], e[1], e[2]]);
  }

  setTier(p: Preset): void {
    this.particles.setTier(p, QUALITY[p].particles);
  }

  /** cockpit view: the flashes are seen from beside the guns */
  setCockpitView(on: boolean): void {
    this.muzzle.scale = on ? MUZZLE.cockpitScale : 1;
  }

  /** mission start / retry: nothing from the previous run stays on screen */
  reset(): void {
    this.particles.clear();
    this.bolts.clear();
    this.muzzle.clear();
    this.ribbons.reset();
    this.reader?.skip();
  }

  /** Drain this frame's sim events into spawn records (before frame()). */
  drain(sim: Sim, time: number): void {
    if (this.readerSim !== sim) {
      this.reader = sim.events.reader();
      this.readerSim = sim;
    }
    this.sim = sim;
    this.particles.time = time;
    this.reader?.drain(this.onEv);
  }

  /** Per frame, after the player attitude is final. */
  frame(dt: number, sim: Sim, alpha: number, playerS: number, time: number): void {
    this.scrapeStream(dt, sim);
    this.bolts.update(sim.playerShots, sim.enemyShots, alpha, playerS, time);
    this.muzzle.update(dt);
    this.ribbons.boost += ((sim.player.boosting ? 1 : 0) - this.ribbons.boost) * Math.min(1, dt * 6);
    this.ribbons.update(dt, playerS);
    this.particles.update(time, playerS);
  }

  private event(slot: number): void {
    const sim = this.sim;
    if (!sim) return;
    const E = sim.events;
    const type = E.type[slot];
    const x = E.x[slot], y = E.y[slot], s = E.s[slot];
    switch (type) {
      case Ev.PlayerFire:
        this.muzzle.fire(E.a[slot]);
        break;
      case Ev.Hit: {
        const weak = E.b[slot] > 0;
        // sparks kick back toward the shooter
        this.burst(weak ? BURSTS.weak : BURSTS.hit, x, y, s, 0, 0, -1, weak ? RAMPS.weak : RAMPS.spark);
        const puff = weak ? BURSTS.puff.weak : BURSTS.puff.hit;
        this.particles.emit(x, y, s, 0, 0, 0, puff[1], puff[0], RAMPS.flash, 0, false);
        break;
      }
      case Ev.Kill:
        this.burst(BURSTS.kill, x, y, s, 0, 0, 0, RAMPS.spark);
        this.particles.emit(x, y, s, 0, 0, 0, BURSTS.puff.kill[1], BURSTS.puff.kill[0], RAMPS.flash, 0, false);
        break;
      case Ev.Spark: {
        // a bolt reached the ground: spray up and back, chips on rock / dust on soil
        const rock = this.surfaceAt(s, x) > 0.5;
        this.burst(BURSTS.wall, x, y, s, 0, 0.8, -0.4, RAMPS.spark);
        this.burst(BURSTS.dust, x, y, s, 0, 1, -0.2, rock ? RAMPS.chips : RAMPS.dust);
        break;
      }
      case Ev.Graze:
        // roll i-frames ate a projectile: an Ice flicker where it passed
        this.burst(BURSTS.graze, x, y, s, 0, 0, -1, RAMPS.ice);
        break;
      case Ev.GroundScrape: {
        // terrain contact (addendum §3): sparks off the hull at the contact point, a puff by surface
        const p = sim.player, nu = p.contactNu, ny = p.contactNy, R = CONTACT.hullR;
        const cx = x - nu * R, cy = y - ny * R;
        const hard = E.b[slot] === 1;
        const rock = this.surfaceAt(s, cx) > 0.5;
        this.burst(hard ? BURSTS.impact : BURSTS.scrape, cx, cy, s, nu, ny, -0.8, RAMPS.spark, p.speed * 0.6);
        this.burst(BURSTS.dust, cx, cy, s, nu, ny, -0.3, rock ? RAMPS.chips : RAMPS.dust, p.speed * 0.3);
        if (hard) this.particles.emit(cx, cy, s, 0, 0, 0, BURSTS.puff.hit[1] * 2, BURSTS.puff.hit[0] * 2, RAMPS.flash, 0, false);
        break;
      }
      case Ev.Splash: {
        // water: a white sheet thrown up and back
        const p = sim.player;
        this.burst(BURSTS.splash, x, y - CONTACT.hullR, s, 0, 1.4, -0.6, RAMPS.water, p.speed * 0.4);
        break;
      }
      case Ev.BoostOn: {
        const p = sim.player;
        for (let e = 0; e < this.engines.length; e++) {
          const m = this.engines[e];
          this.burst(BURSTS.boost, p.x + m[0], p.y + m[1], p.s + m[2], 0, 0, -1, RAMPS.engine, p.speed * 0.55);
        }
        break;
      }
    }
  }

  /** while the hull is in contact: a stream of sparks (+ some dust) from the contact point */
  private scrapeStream(dt: number, sim: Sim): void {
    const p = sim.player;
    if (p.contact <= 0 || !p.alive) {
      this.scrapeCarry = this.dustCarry = 0;
      return;
    }
    const d = this.particles.density, R = CONTACT.hullR;
    const cx = p.x - p.contactNu * R, cy = p.y - p.contactNy * R;
    this.scrapeCarry += SCRAPE_STREAM.sparksPerSec * d * dt;
    this.dustCarry += SCRAPE_STREAM.dustPerSec * d * dt;
    const rock = this.dustCarry >= 1 && this.surfaceAt(p.s, cx) > 0.5;
    const B = BURSTS.scrape;
    for (; this.scrapeCarry >= 1; this.scrapeCarry--) {
      const sp = pick(B.speed);
      const a = (vfxRng.next() - 0.5) * 1.6;
      this.particles.emit(cx, cy, p.s, (p.contactNu + a * p.contactNy) * sp * 0.5, (p.contactNy - a * p.contactNu) * sp * 0.5, -sp + p.speed * 0.55, pick(B.life), pick(B.size), RAMPS.spark, B.drag, true);
    }
    const D = BURSTS.dust;
    for (; this.dustCarry >= 1; this.dustCarry--) {
      const sp = pick(D.speed);
      this.particles.emit(cx, cy, p.s, p.contactNu * sp, p.contactNy * sp, -sp * 0.5 + p.speed * 0.3, pick(D.life), pick(D.size), rock ? RAMPS.chips : RAMPS.dust, D.drag, false);
    }
  }

  /** n sparks from (x, y, s) around direction (dx, dy, ds) (0 = isotropic); vs0 = inherited forward speed */
  private burst(b: Burst, x: number, y: number, s: number, dx: number, dy: number, ds: number, ramp: number, vs0 = 0): void {
    const n = Math.max(1, Math.round(b.count * this.particles.density));
    for (let i = 0; i < n; i++) {
      // random unit vector (vfx stream), biased toward the burst direction
      const u = vfxRng.next() * 2 - 1, a = vfxRng.next() * Math.PI * 2;
      const q = Math.sqrt(1 - u * u);
      let rx = q * Math.cos(a) * b.spread + dx, ry = q * Math.sin(a) * b.spread + dy, rs = u * b.spread + ds;
      const l = Math.hypot(rx, ry, rs) || 1;
      const sp = pick(b.speed);
      rx = (rx / l) * sp;
      ry = (ry / l) * sp;
      rs = (rs / l) * sp + vs0;
      this.particles.emit(x, y, s, rx, ry, rs, pick(b.life), pick(b.size), ramp, b.drag, true);
    }
  }

  /** QA (__G1__.vfx.stats): live instance counts + the first tracer's head / direction */
  stats(): Record<string, unknown> {
    const h = this.bolts.debugFirst();
    return { tracers: this.bolts.tracerCount, orbs: this.bolts.orbCount, particlesSpawned: this.particles.spawned, firstTracer: h };
  }

  dispose(): void {
    this.particles.dispose();
    this.bolts.dispose();
    this.muzzle.dispose();
    this.ribbons.dispose();
    this.tips.forEach(t => t.removeFromParent());
  }
}
