// ?screen=simlab&debug=1 — the pure sim (src/game) running live through the
// real FixedStepper with a scripted pilot, drawn on a 2D canvas: a top view
// (rail s across, x down) and a front view (the x/y envelope), plus the HUD
// bus values and event counts. QA surface for the sim before any 3D exists;
// stays useful for tuning (no three.js here).
import { useEffect, useRef } from 'react';
import { Sim } from '../game/sim';
import { FixedStepper } from '../game/core/step';
import { Ev } from '../game/core/events';
import { emptyInput } from '../game/input';
import { Rng } from '../game/core/rng';
import { TEST_LEVEL } from '../levels/testLevel';
import { EMPTY_TIERS } from '../data/upgrades';
import { PLAYER, RAIL } from '../data/mission';
import { HEX } from '../render/palette';
import { registerDebug } from './debugApi';

const VIEW = { ahead: 320, behind: 20 } as const;
const DRONE = { type: 1, hp: 40, radius: 2, score: 100, every: 1.6 } as const;

export function SimLab() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    const g = cv.getContext('2d')!;
    const sim = new Sim({ level: TEST_LEVEL, ship: 'halcyon', tiers: { ...EMPTY_TIERS }, seed: 7 });
    const stepper = new FixedStepper();
    const reader = sim.events.reader();
    const counts = new Map<number, number>();
    const rng = new Rng(3);
    const inp = emptyInput();
    let spawnT = 0, last = performance.now(), raf = 0;
    const flashes: { x: number; y: number; s: number; t: number }[] = [];
    registerDebug('simlab', { state: () => ({ tick: sim.tick, s: sim.player.s, kills: sim.kills, score: sim.score, shots: sim.player.shotsFired, hits: sim.player.shotsHit, events: Object.fromEntries(counts), dropped: stepper.dropped }) });

    const pilot = () => {
      // scripted pilot: weave, aim at the nearest drone, roll now and then
      const p = sim.player, t = sim.time;
      inp.moveX = Math.sin(t * 0.7);
      inp.moveY = Math.sin(t * 1.1) * 0.6;
      let best = -1, bd = 1e9;
      for (let k = 0; k < sim.enemies.aliveCount; k++) {
        const e = sim.enemies.items[sim.enemies.alive[k]];
        const d = e.s - p.s;
        if (d > 30 && d < bd) {
          bd = d;
          best = k;
        }
      }
      if (best >= 0) {
        const e = sim.enemies.items[sim.enemies.alive[best]];
        inp.aimYaw = Math.atan2(e.x - p.x, e.s - p.s);
        inp.aimPitch = Math.atan2(e.y - p.y, e.s - p.s);
        inp.fire = true;
      } else inp.fire = false;
      inp.boost = Math.sin(t * 0.3) > 0.8;
      inp.roll = rng.next() < 0.004 ? rng.sign() : 0;
    };

    const frame = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const n = stepper.advance(dt);
      for (let i = 0; i < n; i++) {
        spawnT -= 1 / 60;
        if (spawnT <= 0 && sim.enemies.aliveCount < 8) {
          spawnT = DRONE.every;
          const hold = rng.range(140, 260);
          sim.spawnEnemy(DRONE.type, sim.player.s + hold, rng.range(-14, 14), rng.range(-8, 8), DRONE.hp, DRONE.radius, DRONE.score, hold);
        }
        pilot();
        sim.step(inp);
        inp.roll = 0;
      }
      reader.drain(i => {
        const ty = sim.events.type[i];
        counts.set(ty, (counts.get(ty) ?? 0) + 1);
        if (ty === Ev.Kill || ty === Ev.Hit) flashes.push({ x: sim.events.x[i], y: sim.events.y[i], s: sim.events.s[i], t: ty === Ev.Kill ? 0.5 : 0.12 });
      });
      draw(now, dt);
      raf = requestAnimationFrame(frame);
    };

    const draw = (_now: number, dt: number) => {
      const W = (cv.width = cv.clientWidth * devicePixelRatio), H = (cv.height = cv.clientHeight * devicePixelRatio);
      const k = devicePixelRatio;
      const p = sim.player, a = stepper.alpha;
      const ps = p.prevS + (p.s - p.prevS) * a;
      g.fillStyle = HEX.void;
      g.fillRect(0, 0, W, H);
      // ---- top view: s right, x down
      const top = { x: 40 * k, y: 70 * k, w: W - 80 * k, h: H * 0.48 };
      const sx = (s: number) => top.x + ((s - ps + VIEW.behind) / (VIEW.ahead + VIEW.behind)) * top.w;
      const sy = (x: number) => top.y + top.h / 2 + (x / RAIL.tunnelRadius) * (top.h / 2);
      g.strokeStyle = HEX.indigo;
      g.strokeRect(top.x, top.y, top.w, top.h);
      g.strokeStyle = 'rgba(127,209,255,0.25)';
      g.setLineDash([6 * k, 6 * k]);
      g.beginPath();
      g.moveTo(top.x, sy(-RAIL.envelope.a));
      g.lineTo(top.x + top.w, sy(-RAIL.envelope.a));
      g.moveTo(top.x, sy(RAIL.envelope.a));
      g.lineTo(top.x + top.w, sy(RAIL.envelope.a));
      g.stroke();
      g.setLineDash([]);
      // ---- front view: x right, y up (envelope ellipse)
      const fr = { cx: W * 0.25, cy: H * 0.8, sc: (H * 0.16) / RAIL.envelope.b };
      g.strokeStyle = 'rgba(127,209,255,0.4)';
      g.beginPath();
      g.ellipse(fr.cx, fr.cy, RAIL.envelope.a * fr.sc, RAIL.envelope.b * fr.sc, 0, 0, Math.PI * 2);
      g.stroke();
      // bolts
      const bp = sim.playerShots;
      g.strokeStyle = HEX.hot;
      g.lineWidth = 2 * k;
      g.beginPath();
      for (let i = 0; i < bp.count; i++) {
        const s1 = bp.s[i] - bp.vs[i] * (1 - a) / 60, x1 = bp.x[i] - bp.vx[i] * (1 - a) / 60;
        g.moveTo(sx(s1), sy(x1));
        g.lineTo(sx(s1 - bp.vs[i] * 0.012), sy(x1 - bp.vx[i] * 0.012));
      }
      g.stroke();
      // drones
      for (let kk = 0; kk < sim.enemies.aliveCount; kk++) {
        const e = sim.enemies.items[sim.enemies.alive[kk]];
        const es = e.prevS + (e.s - e.prevS) * a;
        g.fillStyle = e.flash > 0 ? HEX.frost : HEX.nebula;
        g.beginPath();
        g.arc(sx(es), sy(e.x), Math.max(3 * k, (e.radius / RAIL.tunnelRadius) * (top.h / 2)), 0, Math.PI * 2);
        g.fill();
        g.fillStyle = HEX.danger;
        g.fillRect(sx(es) - 12 * k, sy(e.x) - 14 * k, 24 * k * (e.hp / e.maxHp), 3 * k);
        g.fillStyle = HEX.nebula;
        g.beginPath();
        g.arc(fr.cx + e.x * fr.sc, fr.cy - e.y * fr.sc, 4 * k, 0, Math.PI * 2);
        g.fill();
      }
      // hits / kills
      for (let i = flashes.length - 1; i >= 0; i--) {
        const f = flashes[i];
        f.t -= dt;
        if (f.t <= 0) {
          flashes.splice(i, 1);
          continue;
        }
        g.strokeStyle = HEX.core;
        g.beginPath();
        g.arc(sx(f.s), sy(f.x), (10 + (0.5 - f.t) * 40) * k, 0, Math.PI * 2);
        g.stroke();
      }
      // player
      const px = p.prevX + (p.x - p.prevX) * a, py = p.prevY + (p.y - p.prevY) * a;
      g.fillStyle = HEX.ignition;
      g.beginPath();
      g.moveTo(sx(ps) + 10 * k, sy(px));
      g.lineTo(sx(ps) - 8 * k, sy(px) - 7 * k);
      g.lineTo(sx(ps) - 8 * k, sy(px) + 7 * k);
      g.fill();
      g.beginPath();
      g.arc(fr.cx + px * fr.sc, fr.cy - py * fr.sc, 6 * k, 0, Math.PI * 2);
      g.fill();
      // aim ray (top view)
      g.strokeStyle = 'rgba(255,225,194,0.35)';
      g.beginPath();
      g.moveTo(sx(ps), sy(px));
      g.lineTo(sx(ps + PLAYER.aim.convergence), sy(px + Math.tan(p.aimYaw) * PLAYER.aim.convergence));
      g.stroke();
      // text
      const h = sim.hud;
      g.fillStyle = HEX.frost;
      g.font = `${14 * k}px "JetBrains Mono", monospace`;
      g.fillText('SIM LAB // src/game, fixed 60 Hz, scripted pilot', 40 * k, 40 * k);
      const lines = [
        `tick ${sim.tick}  s ${p.s.toFixed(1)} m  speed ${p.speed.toFixed(1)} u/s  alpha ${a.toFixed(2)}  dropped ${stepper.dropped}`,
        `hull ${h.hull.toFixed(0)}/${h.maxHull.toFixed(0)}  shield ${h.shield.toFixed(0)}/${h.maxShield.toFixed(0)}  energy ${(h.energy * 100).toFixed(0)}%  roll cd ${(h.rollCd * 100).toFixed(0)}%`,
        `score ${sim.score}  combo x${sim.combo.toFixed(2)}  kills ${sim.kills}  shots ${p.shotsFired}  hits ${p.shotsHit}  acc ${p.shotsFired ? ((p.shotsHit / p.shotsFired) * 100).toFixed(0) : 0}%`,
        `bolts ${bp.count}/${bp.cap}  enemies ${sim.enemies.aliveCount}/${sim.enemies.cap}  events ${sim.events.head}`,
      ];
      g.fillStyle = HEX.steel;
      lines.forEach((l, i) => g.fillText(l, W * 0.45, H * 0.66 + i * 22 * k));
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', display: 'block' }} aria-label="Simulation lab" />;
}
