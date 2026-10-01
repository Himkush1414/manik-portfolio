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
import { rigAim } from '../../render/rigs/ThirdPersonRig';
import { PLAYER, RIGS } from '../../data/mission';
import type { EventReader } from '../../game/core/events';
import { curveAt } from '../../game/rail';
import { TUNNEL } from '../../data/tunnel';

let reader: EventReader | null = null;
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
    if (mission.tunnel) {
      const ps = p.prevS + (p.s - p.prevS) * a;
      const storm = mission.qa.storm >= 0 ? mission.qa.storm : curveAt(sim.level.mood.storm, ps);
      mission.tunnel.update(ps, Math.min(1.5, p.speed / TUNNEL.speedRef), mission.time, storm);
    }

    // ---- camera: the reticle the HUD shows is the raw (late-latched) one
    rigAim.yaw = mission.bot ? mission.input.aimYaw : InputManager.state.yaw;
    rigAim.pitch = mission.bot ? mission.input.aimPitch : InputManager.state.pitch;
    mission.rig.update(dt);
  }, -3);
  return null;
}
