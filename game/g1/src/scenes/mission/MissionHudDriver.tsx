// Writes the mission DOM HUD (brief §9) from the scene loop, after the camera
// director (priority 0.5: the camera is final, the render at 1 adds the shake
// on top, so the HUD stays steady). Per frame: reticle = the guns'
// convergence point on the late-latched aim, pipper = the same distance
// along the ship's nose, hit / kill marker fades, threat chevrons around the
// reticle — transforms / opacity only, written when they moved. At the sim's
// 20 Hz HUD refresh (hud.seq): bars (transform scaleX), numbers (text only
// when changed), danger / lock flags, rings.
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, type Camera } from 'three';
import { stage } from '../Stage';
import { mission } from './missionRuntime';
import { hudDom, RING_C } from '../../ui/screens/mission/hudDom';
import { hudView } from '../../ui/screens/mission/hudView';
import { rigAim, rigFlight } from '../../render/rigs/rigState';
import { HUD, PLAYER, RIGS } from '../../data/mission';
import { Ev, type EventReader } from '../../game/core/events';
import type { HudState } from '../../game/hud';
import { cockpitFx } from '../cockpit/displays';
import { useSettings } from '../../state/settings.store';

const _v = new Vector3();
const pos = { x: 0, y: 0, on: false };
let reader: EventReader | null = null;
let readerSim: unknown = null;
let lastSeq = -1;
let lastView = '';
let lastRoot: HTMLElement | null = null;
let hitT = 0, killT = 0;
const last = { score: -1, combo: -1, credits: -1, pct: -1, shield: -1, hull: -1, speed: -1, target: -2 };
const lastXY = new Float32Array(4);

/** world point -> CSS px in `pos` (on = in front of the camera) */
function project(cam: Camera, w: number, h: number): void {
  _v.project(cam);
  pos.on = _v.z < 1 && _v.z > -1;
  pos.x = (_v.x * 0.5 + 0.5) * w;
  pos.y = (-_v.y * 0.5 + 0.5) * h;
}

function place(el: HTMLElement | null, i: number): void {
  if (!el) return;
  const k = i * 2;
  if (Math.abs(lastXY[k] - pos.x) < 0.25 && Math.abs(lastXY[k + 1] - pos.y) < 0.25) return;
  lastXY[k] = pos.x;
  lastXY[k + 1] = pos.y;
  el.style.transform = `translate3d(${pos.x.toFixed(1)}px, ${pos.y.toFixed(1)}px, 0)`;
}

function text(el: HTMLElement | null, key: keyof typeof last, v: number, s: () => string): void {
  if (!el || last[key] === v) return;
  last[key] = v;
  el.textContent = s();
}

function flag(el: HTMLElement | null, name: string, on: boolean): void {
  if (el && (el.dataset[name] === 'true') !== on) el.dataset[name] = String(on);
}

/** the cockpit MFDs + combiner read the same refresh (hudMode 'mission') */
function cockpitData(h: HudState, sh: number, hu: number): void {
  const M = cockpitFx.mission;
  M.shield = sh;
  M.hull = hu;
  M.energy = Math.max(0, Math.min(1, h.energy));
  M.boostLocked = h.boostLocked;
  M.rollCd = h.rollCd;
  M.progress = h.progress;
  M.speed = Math.round(h.speed * HUD.speedScale);
  M.score = h.score;
  M.combo = h.combo;
  M.target = h.targetSlot >= 0;
  M.targetHp = h.targetHp;
  M.reduceFlash = useSettings.getState().accessibility.reduceFlashing;
}

function bars(h: HudState): void {
  const d = hudDom;
  const sh = h.shield / Math.max(1, h.maxShield), hu = h.hull / Math.max(1, h.maxHull);
  cockpitData(h, sh, hu);
  if (d.shield) d.shield.style.transform = `scaleX(${sh.toFixed(3)})`;
  if (d.hull) d.hull.style.transform = `scaleX(${hu.toFixed(3)})`;
  if (d.boost) d.boost.style.transform = `scaleX(${Math.max(0, Math.min(1, h.energy)).toFixed(3)})`;
  if (d.progress) d.progress.style.transform = `scaleX(${h.progress.toFixed(4)})`;
  flag(d.shieldBlock, 'danger', sh < HUD.danger);
  flag(d.hullBlock, 'danger', hu < HUD.danger);
  flag(d.boostBlock, 'locked', h.boostLocked);
  text(d.shieldVal, 'shield', Math.ceil(sh * 100), () => String(Math.ceil(sh * 100)));
  text(d.hullVal, 'hull', Math.ceil(hu * 100), () => String(Math.ceil(hu * 100)));
  text(d.score, 'score', h.score, () => h.score.toLocaleString('en-US'));
  text(d.combo, 'combo', h.combo, () => `x${h.combo}`);
  text(d.credits, 'credits', h.credits, () => h.credits.toLocaleString('en-US'));
  const pct = Math.floor(h.progress * 100);
  text(d.progressPct, 'pct', pct, () => `${pct}%`);
  const spd = Math.round(h.speed * HUD.speedScale);
  text(d.speed, 'speed', spd, () => String(spd));
  if (d.comboRing) d.comboRing.style.strokeDashoffset = String(RING_C * (1 - Math.max(0, Math.min(1, h.comboT))));
  if (d.rollRing) d.rollRing.style.strokeDashoffset = String(RING_C * Math.max(0, Math.min(1, h.rollCd)));
  if (d.target) {
    const on = h.targetSlot >= 0;
    flag(d.target, 'on', on);
    if (on && d.targetHp) d.targetHp.style.transform = `scaleX(${h.targetHp.toFixed(3)})`;
  }
}

export function MissionHudDriver() {
  const size = useThree(s => s.size);
  useFrame(({ camera }, dt) => {
    const d = hudDom, sim = mission.sim;
    if (stage.mission < 0.5 || !sim || !d.root) return;
    if (d.root !== lastRoot) {
      // a fresh HUD mount: everything is re-written
      lastRoot = d.root;
      lastView = '';
      lastSeq = -1;
      for (const k in last) last[k as keyof typeof last] = -2;
      lastXY.fill(-1e4);
    }
    // combiner attitude, per frame: the camera's roll / pitch relative to the rail (the cockpit rig
    // rides the ship; reduce-motion rolls the view only RIGS.reduceRoll of the bank, no barrel roll)
    const att = mission.attitude;
    cockpitFx.mission.bank = rigFlight.reduceMotion ? att.bank * RIGS.reduceRoll : att.bank + att.roll;
    cockpitFx.mission.pitch = att.pitch;
    const view = hudView.cockpit ? 'cockpit' : 'overlay';
    if (view !== lastView) d.root.dataset.view = lastView = view;
    if (readerSim !== sim) {
      reader = sim.events.reader();
      readerSim = sim;
    }
    reader?.drain(slot => {
      const t = sim.events.type[slot];
      if (t === Ev.Hit) hitT = HUD.hitLife;
      else if (t === Ev.Kill) killT = HUD.killLife;
    });

    // ---- reticle + pipper (convergence distance), in CSS px
    const C = PLAYER.aim.convergence, pl = mission.player;
    _v.set(pl.position.x + Math.tan(rigAim.yaw) * C, pl.position.y + Math.tan(rigAim.pitch) * C, -C);
    mission.root.localToWorld(_v);
    project(camera, size.width, size.height);
    const rx = pos.x, ry = pos.y;
    place(d.reticle, 0);
    _v.set(0, 0, -C);
    pl.localToWorld(_v);
    project(camera, size.width, size.height);
    place(d.pipper, 1);

    // ---- markers
    if (hitT > 0 || killT > 0) {
      hitT = Math.max(0, hitT - dt);
      killT = Math.max(0, killT - dt);
      if (d.hit) d.hit.style.opacity = (hitT / HUD.hitLife).toFixed(2);
      if (d.kill) {
        const k = killT / HUD.killLife;
        d.kill.style.opacity = k.toFixed(2);
        d.kill.style.scale = (1.6 - 0.6 * k).toFixed(2);
      }
    }

    // ---- threats: chevrons on a ring around the reticle, pointing outward
    const h = sim.hud;
    const R = HUD.threatRing * Math.min(size.width / 1920, size.height / 1080);
    for (let i = 0; i < d.threats.length; i++) {
      const el = d.threats[i], t = h.threats[i];
      if (!t || !t.active) {
        if (el.style.opacity !== '0') el.style.opacity = '0';
        continue;
      }
      const x = rx + Math.sin(t.angle) * R, y = ry - Math.cos(t.angle) * R;
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${t.angle.toFixed(3)}rad)`;
      el.style.opacity = (0.4 + 0.6 * t.urgency).toFixed(2);
    }

    // ---- 20 Hz data
    if (h.seq !== lastSeq) {
      lastSeq = h.seq;
      bars(h);
    }
  }, 0.5);
  return null;
}
