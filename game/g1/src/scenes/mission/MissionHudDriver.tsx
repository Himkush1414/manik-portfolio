// Writes the mission DOM HUD (brief §9) from the scene loop, after the camera
// director (priority 0.5: the camera is final, the render at 1 adds the shake
// on top, so the HUD stays steady). Per frame: reticle = the guns'
// convergence point on the late-latched aim, pipper = the same distance
// along the ship's nose, hit / kill marker fades, threat chevrons around the
// reticle — transforms / opacity only, written when they moved. At the sim's
// 20 Hz HUD refresh (hud.seq): bars (transform scaleX), numbers (text only
// when changed), danger / lock flags, rings.
import { useFrame, useThree } from '@react-three/fiber';
import { Quaternion, Vector3, type Camera, type PerspectiveCamera } from 'three';
import { stage } from '../Stage';
import { mission } from './missionRuntime';
import { hudDom, RING_C } from '../../ui/screens/mission/hudDom';
import { hudView } from '../../ui/screens/mission/hudView';
import { rigAim, rigFlight } from '../../render/rigs/rigState';
import { HUD, PLAYER } from '../../data/mission';
import { Ev, type EventReader } from '../../game/core/events';
import type { HudState } from '../../game/hud';
import { cockpitFx } from '../cockpit/displays';
import { useSettings } from '../../state/settings.store';
import { hudFlight, hudFlightRemount } from './hudFlight';
import { reticleCanvas, type ReticleOpts } from '../../ui/screens/mission/reticleCanvas';
import { flightData, type FlightDataIn } from '../../ui/screens/mission/flightData';
import { bankAngle, elevation, heading, localToWorldDir, rotate } from '../../render/mission/flightAttitude';
import { missionSpace } from '../../render/world/missionSpace';

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
const ropts: ReticleOpts = { style: 'tactical', size: 1, brightness: 0.9, degrees: true };
// flight data (Planet 1 §1.3): ship + camera attitude in the planet frame, per frame, no allocation
const _sq = new Quaternion(), _cq = new Quaternion();
const _fw = { x: 0, y: 0, z: -1 }, _rt = { x: 1, y: 0, z: 0 }, _t = { x: 0, y: 0, z: 0 };
const FWD = { x: 0, y: 0, z: -1 }, RIGHT = { x: 1, y: 0, z: 0 };
/** the latest flight data (also read by the QA probe) */
export const fd: FlightDataIn = { heading: 0, bank: 0, camFwW: { x: 0, y: 0, z: -1 }, camQ: _cq, r: missionSpace.r };
const DEG = Math.PI / 180;

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
      hudFlightRemount();
    }
    // flight data: ship heading / bank in the planet frame (world = B local), the camera's world forward
    const r = missionSpace.r;
    mission.player.getWorldQuaternion(_sq);
    localToWorldDir(r, rotate(_sq, FWD, false, _t), _fw);
    localToWorldDir(r, rotate(_sq, RIGHT, false, _t), _rt);
    fd.heading = heading(_fw);
    fd.bank = bankAngle(_fw, _rt);
    camera.getWorldQuaternion(_cq);
    localToWorldDir(r, rotate(_cq, FWD, false, _t), fd.camFwW);
    // combiner attitude, per frame: the cockpit interior's roll / pitch relative to the rail (the cockpit
    // rig writes them: the view's roll + the shell's roll around it in STEADY HORIZON); the pitch gets the
    // rail's own climb so the combiner ladder is world-true (the path frame never banks)
    const M = cockpitFx.mission;
    M.bank = rigFlight.interiorRoll;
    M.pitch = rigFlight.interiorPitch + elevation(localToWorldDir(r, FWD, _t)) * DEG;
    M.heading = fd.heading;
    M.shipBank = fd.bank;
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
    if (rigAim.cursor) {
      // CURSOR-FLIGHT: the reticle IS the full-screen cursor (AC2.2); the guns converge under it
      pos.x = ((rigAim.cx + 1) / 2) * size.width;
      pos.y = ((1 - rigAim.cy) / 2) * size.height;
      pos.on = true;
    } else {
      _v.set(pl.position.x + Math.tan(rigAim.yaw) * C, pl.position.y + Math.tan(rigAim.pitch) * C, -C);
      mission.root.localToWorld(_v);
      project(camera, size.width, size.height);
    }
    const rx = pos.x, ry = pos.y;
    place(d.reticle, 0);
    _v.set(0, 0, -C);
    pl.localToWorld(_v);
    project(camera, size.width, size.height);
    place(d.pipper, 1);
    // the tactical reticle (canvas): degree scale through the live FOV, offset off the boresight pipper
    const hs = useSettings.getState().hud;
    ropts.style = hs.reticle;
    ropts.size = hs.reticleSize;
    ropts.brightness = hs.reticleBrightness;
    ropts.degrees = hs.reticleDegrees;
    reticleCanvas.draw(size.width, size.height, (camera as PerspectiveCamera).fov, rx, ry, pos.x, pos.y, pos.on, ropts, true, hudView.cockpit ? null : fd);

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

    // ---- flight layer: turbulence / whiteout / callouts / tutorial prompt
    hudFlight(sim, dt, rx, ry);

    // ---- 20 Hz data
    if (h.seq !== lastSeq) {
      lastSeq = h.seq;
      bars(h);
      reticleCanvas.setText(C * HUD.speedScale);
      flightData.setText(fd.heading);
    }
  }, 0.5);
  return null;
}
