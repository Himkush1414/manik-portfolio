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
import { rigAim, rigFlight } from '../../render/rigs/rigState';
import { PLAYER, RIGS, GROUND } from '../../data/mission';
import type { EventReader } from '../../game/core/events';
import { curveAt, envelopeAt, ellipseR } from '../../game/rail';
import { STEP } from '../../game/core/step';
import { SPEED_FX, SPEED_REF } from '../../data/speedfx';
import { missionSpace } from '../../render/world/missionSpace';
import { director } from '../../render/cameraDirector';
import { useSettings } from '../../state/settings.store';
import { missionPost } from '../../render/MissionPostFX';
import { CameraShaker } from '../../render/CameraShaker';
import { updateCockpitLights } from './missionCamera';
import { cockpitFx } from '../cockpit/displays';

let reader: EventReader | null = null;
const _env = { a: 0, b: 0 };
let readerSim: unknown = null;
/** speed-line gain eased toward the active view's (follows the rig blend) */
let streakGain = 1;

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
    InputManager.state.update(dt, now);

    // ---- fixed steps
    const n = isSimLive(flowState) ? mission.stepper.advance(dt, mission.timeScale) : 0;
    perfMon.begin('sim');
    for (let i = 0; i < n; i++) {
      if (mission.bot) mission.bot.think(sim, mission.input);
      else InputManager.state.sample(mission.input, now);
      if (mission.qaForce) Object.assign(mission.input, mission.qaForce);
      sim.step(mission.input);
    }
    perfMon.end('sim');
    if (!isSimLive(flowState)) mission.stepper.resync();
    mission.vfx?.drain(sim, mission.time);
    reader?.drain(onSimEvent);

    // ---- player view (interpolated between the last two sim states)
    const p = sim.player, a = mission.stepper.alpha;
    const x = p.prevX + (p.x - p.prevX) * a, y = p.prevY + (p.y - p.prevY) * a;
    const pl = mission.player;
    // attitude: bank against lateral velocity, pitch with vertical, nose yaw toward the reticle, barrel roll
    // a human's reticle is the raw late-latched one; the bot / QA-forced aim is what the sim consumed
    const simAim = !!mission.bot || (mission.qaForce !== null && 'aimYaw' in mission.qaForce);
    const aimYaw = simAim ? mission.input.aimYaw : InputManager.state.yaw;
    const aimPitch = simAim ? mission.input.aimPitch : InputManager.state.pitch;
    // springs toward bank / pitch / yaw targets (render/mission/shipAttitude.ts, data FEEL); the
    // roll time is interpolated so the barrel roll is smooth above 60 Hz
    // the envelope the sim uses: the world path's (Phase 2R), else the level's segments
    const env = mission.env ? mission.env.path.envelopeAt(p.s, _env) : envelopeAt(sim.level.envelope, p.s, _env);
    const press = Math.max(0, ellipseR(x, y, env.a, env.b) - 1);
    const rollT = p.rollT >= 0 ? p.rollT + a * STEP : -1;
    const reduceLife = useSettings.getState().accessibility.reduceMotion ? 0.25 : 1;
    const att = mission.attitude;
    att.update(dt * mission.timeScale, p.vx, p.vy, sim.stats.lateralSpeed, aimYaw, aimPitch, rollT, PLAYER.roll.duration, p.rollDir, press, reduceLife);
    mission.rollVis = att.roll;
    pl.position.set(x, y + att.bob, 0);
    pl.rotation.set(att.pitch + att.noisePitch, -att.yaw, att.bank + att.roll + att.noiseBank, 'YXZ');
    if (mission.ship) {
      mission.ship.setEngineLevel(p.boosting ? 1 : p.braking ? 0.25 : 0.6);
      mission.ship.update(state.clock.elapsedTime);
    }

    // ---- world: mission space moves to the player (path frame), tiles stream + turn into it, sun
    mission.time += dt * mission.timeScale;
    const st = useSettings.getState();
    const reduce = st.accessibility.reduceMotion;
    const ps = p.prevS + (p.s - p.prevS) * a;
    const world = mission.env;
    world?.update(ps);
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
    if (world) CameraShaker.setRumble(world.def.weather.gusts * speed01 * SPEED_FX.rumble, SPEED_FX.rumbleHz);

    // ---- weapons / impacts / trails (after the attitude: ribbons sample the wing tips)
    mission.vfx?.frame(dt, sim, a, ps, mission.time);

    // ---- camera: the reticle the HUD shows is the raw (late-latched) one
    rigAim.yaw = aimYaw;
    rigAim.pitch = aimPitch;
    rigFlight.bank = att.bank;
    rigFlight.roll = att.roll;
    rigFlight.ax = att.ax;
    rigFlight.ay = att.ay;
    rigFlight.rollCoupling = useSettings.getState().camera.rollCoupling;
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
