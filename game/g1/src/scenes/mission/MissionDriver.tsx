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
import { rigAim, rigFlight } from '../../render/rigs/ThirdPersonRig';
import { PLAYER, RIGS } from '../../data/mission';
import type { EventReader } from '../../game/core/events';
import { curveAt } from '../../game/rail';
import { TUNNEL, SPEED_FX, STORM_FX } from '../../data/tunnel';
import { Rng } from '../../game/core/rng';
import { useSettings } from '../../state/settings.store';
import { missionPost } from '../../render/MissionPostFX';
import { CameraShaker } from '../../render/CameraShaker';

let reader: EventReader | null = null;
/** presentation-only randomness (brief §3: VFX never draw from the sim streams) */
const vfxRng = new Rng(0x7f4a7c15);
let stormFlash = 0, stormGap = 0;
let readerSim: unknown = null;

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
    reader?.drain(onSimEvent);

    // ---- player view (interpolated between the last two sim states)
    const p = sim.player, a = mission.stepper.alpha;
    const x = p.prevX + (p.x - p.prevX) * a, y = p.prevY + (p.y - p.prevY) * a;
    const pl = mission.player;
    pl.position.set(x, y, 0);
    // attitude: bank against lateral velocity, pitch with vertical, nose yaw toward the reticle, barrel roll
    const yaw = (mission.bot ? mission.input.aimYaw : InputManager.state.yaw) * PLAYER.aim.noseYaw;
    const pitchAim = (mission.bot ? mission.input.aimPitch : InputManager.state.pitch) * PLAYER.aim.noseYaw;
    mission.rollVis = p.rollT >= 0 ? -p.rollDir * (p.rollT / PLAYER.roll.duration) * Math.PI * 2 : 0;
    pl.rotation.set(p.vy * RIGS.pitchPerVy + pitchAim, -yaw, -p.vx * RIGS.bankPerVx + mission.rollVis, 'YXZ');
    if (mission.ship) {
      mission.ship.setEngineLevel(p.boosting ? 1 : p.braking ? 0.25 : 0.6);
      mission.ship.update(state.clock.elapsedTime);
    }

    // ---- wormhole: rail-locked scroll from the interpolated rail position
    mission.time += dt * mission.timeScale;
    const st = useSettings.getState();
    const reduce = st.accessibility.reduceMotion;
    const ps = p.prevS + (p.s - p.prevS) * a;
    const speed01 = Math.min(1.5, p.speed / TUNNEL.speedRef);
    if (mission.tunnel) {
      const storm = mission.qa.storm >= 0 ? mission.qa.storm : curveAt(sim.level.mood.storm, ps);
      // storm lightning: a vfx-RNG flash envelope (never the sim streams), inside the flash budget
      stormGap -= dt;
      if (!st.accessibility.reduceFlashing && storm > 0.05 && stormGap <= 0 && vfxRng.next() < storm * STORM_FX.rate * dt) {
        stormFlash = STORM_FX.peak;
        stormGap = STORM_FX.minGap;
      }
      stormFlash = Math.max(0, stormFlash - STORM_FX.decay * dt * stormFlash - dt);
      mission.tunnel.update(ps, speed01, mission.time, reduce ? storm * 0.5 : storm, st.accessibility.reduceFlashing ? 0 : stormFlash);
      // ---- speed sensation: streaks, radial blur + edge CA, FOV, turbulence rumble
      const cruise = curveAt(sim.level.speedCurve, p.s) || sim.level.cruiseSpeed;
      const ratio = p.speed / Math.max(1, cruise);
      mission.streaks?.update(ps, speed01, st.graphics.speedLines * (reduce ? 0.5 : 1), mission.tunnel.uniforms.uFil.value, state.camera.position.z - mission.root.position.z);
      missionPost.blur = reduce ? 0 : SPEED_FX.blur * Math.min(1, Math.max(0, (ratio - 1.05) / 0.4) + Math.max(0, speed01 - 0.85));
      missionPost.ca = SPEED_FX.caPerSpeed * speed01 * (reduce ? 0.3 : 1);
      rigFlight.speedRatio = ratio;
      rigFlight.boost = p.boosting;
      rigFlight.reduceMotion = reduce;
      CameraShaker.setRumble(mission.tunnel.moodDef.turbulence * speed01 * SPEED_FX.rumble, SPEED_FX.rumbleHz);
    }

    // ---- camera: the reticle the HUD shows is the raw (late-latched) one
    rigAim.yaw = mission.bot ? mission.input.aimYaw : InputManager.state.yaw;
    rigAim.pitch = mission.bot ? mission.input.aimPitch : InputManager.state.pitch;
    mission.rig.update(dt);
  }, -3);
  return null;
}
