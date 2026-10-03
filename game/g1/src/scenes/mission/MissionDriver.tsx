// The per-frame mission loop (brief §3). Runs before the camera director
// (priority -3): input -> fixed sim steps (FixedStepper, max 5) -> events ->
// interpolated player view -> camera rig. The sim only advances in the
// sim-live flow states; render interpolation uses the stepper's alpha.
// Per-frame work touches refs and plain objects only (no React state).
import { useFrame } from '@react-three/fiber';
import { stage } from '../Stage';
import { mission } from './missionRuntime';
import { onSimEvent } from '../../app/mission/missionFlow';
import { InputManager } from '../../input/InputManager';
import { useFlow, isSimLive } from '../../app/flow';
import { perfMon } from '../../render/perfMon';
import { rigAim, rigFlight, rigCamera } from '../../render/rigs/rigState';
import { PLAYER, RIGS, GROUND, CAMERA_ATTACH, FEEL } from '../../data/mission';
import type { EventReader } from '../../game/core/events';
import { curveAt } from '../../game/rail';
import { STEP } from '../../game/core/step';
import { SPEED_FX, SPEED_REF } from '../../data/speedfx';
import { missionSpace } from '../../render/world/missionSpace';
import { director } from '../../render/cameraDirector';
import { useSettings } from '../../state/settings.store';
import { missionPost } from '../../render/MissionPostFX';
import { CameraShaker } from '../../render/CameraShaker';
import { updateCockpitLights } from './missionCamera';
import { cockpitFx } from '../cockpit/displays';
import { flightFeedback } from './flightFeedback';
import { Vector3, type Camera, type Fog } from 'three';
import type { InputState } from '../../input/inputState';

const _ray = new Vector3();
const _o = new Vector3();
/**
 * The aim ray (Control / Camera / Boundary addendum): the cannons converge on the point under the
 * full-screen reticle — the camera ray through it meets the convergence plane (PLAYER.aim.convergence
 * ahead of the ship, mission space); the aim angles to it from the ship are what the sim fires along.
 * Uses the camera as last rendered (the reticle is drawn exactly there: what you see is where you shoot).
 */
function cursorAim(cam: Camera, ist: InputState): void {
  const pl = mission.player.position, C = PLAYER.aim.convergence;
  _o.setFromMatrixPosition(cam.matrixWorld);
  _ray.set(ist.cx, ist.cy, 0.5).unproject(cam).sub(_o).normalize();
  _o.sub(mission.root.position);
  if (_ray.z > -1e-3) return;
  const t = (pl.z - C - _o.z) / _ray.z;
  ist.setCursorAim(Math.atan2(_o.x + _ray.x * t - pl.x, C), Math.atan2(_o.y + _ray.y * t - pl.y, C));
}

/** clearance (u) above the terrain of a mission-local point (camera collision: rigFlight.clearAt) */
function clearAt(lx: number, ly: number, lz: number): number {
  const world = mission.env, sim = mission.sim;
  if (!world || !sim) return Infinity;
  const p = sim.player, ps = p.prevS + (p.s - p.prevS) * mission.stepper.alpha;
  const r = missionSpace.r;
  const wy = missionSpace.py + r[1] * lx + r[4] * ly + r[7] * lz;
  return wy - world.groundY(ps - lz, lx);
}

let reader: EventReader | null = null;
let readerSim: unknown = null;
/** speed-line gain eased toward the active view's (follows the rig blend) */
let streakGain = 1;
/** linear progress of the camera attachment blend (0 steady .. 1 attached) */
let attachT = 1;

export function MissionDriver() {
  useFrame((state, dt) => {
    const sim = mission.sim;
    if (stage.mission < 0.5 || !sim) return;
    if (readerSim !== sim) {
      reader = sim.events.reader();
      readerSim = sim;
    }
    const now = performance.now() / 1000;
    const flowState = useFlow.getState().state;
    const ist = InputManager.state;
    ist.update(dt, now);
    ist.setViewport(state.size.width, state.size.height);
    const human = !mission.bot;
    rigCamera.cam = state.camera;
    if (human) cursorAim(state.camera, ist);

    // ---- fixed steps
    const n = isSimLive(flowState) ? mission.stepper.advance(dt, mission.timeScale) : 0;
    perfMon.begin('sim');
    for (let i = 0; i < n; i++) {
      if (mission.bot) mission.bot.think(sim, mission.input);
      else ist.sample(mission.input);
      if (mission.qaForce) Object.assign(mission.input, mission.qaForce);
      sim.step(mission.input);
    }
    perfMon.end('sim');
    if (!isSimLive(flowState)) mission.stepper.resync();
    mission.vfx?.drain(sim, mission.time);
    flightFeedback.update(sim, dt, isSimLive(flowState));
    reader?.drain(onSimEvent);

    // ---- player view (interpolated between the last two sim states)
    const p = sim.player, a = mission.stepper.alpha;
    const x = p.prevX + (p.x - p.prevX) * a, y = p.prevY + (p.y - p.prevY) * a;
    const pl = mission.player;
    // attitude: bank against lateral velocity, pitch with vertical, nose into the motion, barrel roll —
    // the mouse never moves the ship (addendum): the reticle only aims
    // a human's reticle is the raw late-latched one; the bot / QA-forced aim is what the sim consumed
    const simAim = !!mission.bot || (mission.qaForce !== null && 'aimYaw' in mission.qaForce);
    const aimYaw = simAim ? mission.input.aimYaw : ist.yaw;
    const aimPitch = simAim ? mission.input.aimPitch : ist.pitch;
    // springs toward bank / pitch / yaw targets (render/mission/shipAttitude.ts, data FEEL); the
    // roll time is interpolated so the barrel roll is smooth above 60 Hz; terrain contact shudders it
    const rollT = p.rollT >= 0 ? p.rollT + a * STEP : -1;
    const reduceLife = useSettings.getState().accessibility.reduceMotion ? 0.25 : 1;
    const att = mission.attitude;
    // camera attachment weight (0 STEADY .. 1 FULLY ATTACHED), eased so a settings change blends
    const st = useSettings.getState();
    const want = st.camera.attachment === 'attached' ? 1 : 0;
    attachT = want > attachT ? Math.min(want, attachT + dt / CAMERA_ATTACH.blend) : Math.max(want, attachT - dt / CAMERA_ATTACH.blend);
    rigFlight.attach = attachT * attachT * (3 - 2 * attachT);
    att.bankLimit = FEEL.bankMax + (CAMERA_ATTACH.bankMax - FEEL.bankMax) * rigFlight.attach;
    att.update(dt * mission.timeScale, p.vx, p.vy, p.latMax || sim.stats.lateralSpeed, rollT, PLAYER.roll.duration, p.rollDir, p.contact, reduceLife);
    mission.rollVis = att.roll;
    pl.position.set(x, y + att.bob, 0);
    pl.rotation.set(att.pitch + att.noisePitch, -att.yaw, att.bank + att.roll + att.noiseBank, 'YXZ');
    if (mission.ship) {
      mission.ship.setEngineLevel(p.boosting ? 1 : p.braking ? 0.25 : 0.6);
      mission.ship.update(state.clock.elapsedTime);
    }

    // ---- world: mission space moves to the player (path frame), tiles stream + turn into it, sun
    mission.time += dt * mission.timeScale;
    const reduce = st.accessibility.reduceMotion;
    const ps = p.prevS + (p.s - p.prevS) * a;
    const world = mission.env;
    world?.update(ps);
    // keyframe env probe: one cube face / the prefilter per frame while a recapture runs, then rebind
    if (world) {
      world.probe.advance(state.gl);
      const fresh = world.probe.takeFresh();
      if (fresh) state.scene.environment = fresh;
    }
    // the actors' linear fog follows the time of day's far haze
    if (world && state.scene.fog) (state.scene.fog as Fog).color.copy(world.tod.hazeFar);
    // ---- speed sensation: streaks, radial blur + edge CA, FOV, gust rumble
    const speed01 = Math.min(1.5, p.speed / SPEED_REF);
    const cruise = curveAt(sim.level.speedCurve, p.s) || sim.level.cruiseSpeed;
    const ratio = p.speed / Math.max(1, cruise);
    streakGain += (RIGS.streakGain[mission.rig.mode] - streakGain) * Math.min(1, dt / RIGS.blend * 3);
    // open air: sparse wind streaks at cruise, building with boost (the tube-era density read as a
    // hyperspace starfield over a valley)
    const air = SPEED_FX.airBase + SPEED_FX.airBoost * Math.min(1, Math.max(0, (ratio - 1) / 0.5));
    if (world) mission.streaks?.update(ps, speed01, st.graphics.speedLines * streakGain * air * (reduce ? 0.5 : 1), world.streakColor, state.camera.position.z - mission.root.position.z);
    missionPost.blur = reduce ? 0 : SPEED_FX.blur * Math.min(1, Math.max(0, (ratio - 1.05) / 0.4) + Math.max(0, speed01 - 0.85));
    missionPost.ca = SPEED_FX.caPerSpeed * speed01 * (reduce ? 0.3 : 1);
    rigFlight.speedRatio = ratio;
    rigFlight.boost = p.boosting;
    rigFlight.reduceMotion = reduce;
    // the path frame already turns and climbs with the valley; the camera only banks a touch into
    // the bend (cosmetic, curvature x speed^2, capped)
    const S = RIGS.sway;
    const curv = world ? world.path.curvatureAt(ps) : 0;
    rigFlight.swayX = 0;
    rigFlight.swayY = 0;
    rigFlight.swayBank = Math.max(-S.maxBank, Math.min(S.maxBank, -curv * S.bankPerCurv * ratio * ratio));
    // the world's gusts + turbulence / terrain contact (scenes/mission/flightFeedback.ts)
    if (world) CameraShaker.setRumble(world.def.weather.gusts * speed01 * SPEED_FX.rumble + flightFeedback.rumble, SPEED_FX.rumbleHz);

    // ---- weapons / impacts / trails (after the attitude: ribbons sample the wing tips)
    mission.vfx?.frame(dt, sim, a, ps, mission.time);

    // ---- camera: the reticle the HUD shows is the raw (late-latched) one
    rigAim.yaw = aimYaw;
    rigAim.pitch = aimPitch;
    rigAim.cursor = human && !simAim;
    rigAim.cx = ist.cx;
    rigAim.cy = ist.cy;
    rigFlight.bank = att.bank;
    rigFlight.roll = att.roll;
    rigFlight.yaw = -att.yaw;
    rigFlight.pitch = att.pitch;
    rigFlight.clearAt = world ? clearAt : null;
    rigFlight.ax = att.ax;
    rigFlight.ay = att.ay;
    rigFlight.rollStrength = st.camera.rollStrength;
    rigAim.lookAhead = st.controls.reticleLookAhead;
    rigFlight.envA = p.envA;
    rigFlight.envB = p.envB;
    rigFlight.freeL = p.freeL;
    rigFlight.freeR = p.freeR;
    rigFlight.freeUp = p.freeUp;
    rigFlight.freeDown = p.freeDown;
    mission.rig.update(dt);
    if (world) {
      // terrain-aware camera: never closer to the ground than GROUND.cameraClearance (mission-local
      // camera -> path-relative (s, u) -> ground; push up along local y)
      const O = mission.root.position, d = director.pos;
      const lx = d.x - O.x, ly = d.y - O.y, lz = d.z - O.z;
      const r = missionSpace.r;
      const wy = missionSpace.py + r[1] * lx + r[4] * ly + r[7] * lz;
      const g = world.groundY(ps - lz, lx);
      if (wy < g + GROUND.cameraClearance) d.y += g + GROUND.cameraClearance - wy;
      world.applySun(d, mission.time);
    }
    // cockpit view: the dash light follows the eye (after the rig placed the root)
    updateCockpitLights(cockpitFx.power.dash);
    mission.hands.update(dt * mission.timeScale, mission.input, p.shotsFired, reduce);
  }, -3);
  return null;
}
