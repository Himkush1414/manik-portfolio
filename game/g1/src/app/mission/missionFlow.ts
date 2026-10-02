// Mission flow (brief §14 / §17): drives the FSM through a mission and owns
// the frame swap. 2A: LAUNCH -> prepare -> swap straight into the mission
// frame (2B adds the catapult, Veil Gate and breach in front of it); pause /
// resume; death -> failed -> retry and complete -> results are minimal until
// their screens land (2D / 2G); HANGAR leaves through the bulkhead sequence.
import gsap from 'gsap';
import type { Fog, WebGLRenderer } from 'three';
import { flow, useFlow } from '../flow';
import { Ev } from '../../game/core/events';
import { levelById } from '../../levels/registry';
import { MissionLoader } from '../../scenes/mission/MissionLoader';
import { mission, type MissionOptions } from '../../scenes/mission/missionRuntime';
import { whenWorldMounted, MISSION_ORIGIN } from '../../scenes/sceneBridge';
import { stage } from '../../scenes/Stage';
import { lightRig } from '../../render/lightRig';
import { InputManager } from '../../input/InputManager';
import { perfMon } from '../../render/perfMon';
import { CameraShaker } from '../../render/CameraShaker';
import { MISSION_LIGHTS } from '../../data/mission';
import { returnSequence } from '../choreo/launchTimeline';
import { cockpitFx } from '../../scenes/cockpit/displays';
import { useSettings } from '../../state/settings.store';
import { applyCockpitView, cycleCamera, followCameraSetting, missionMode } from '../../scenes/mission/missionCamera';
import { runLaunch, runFastLaunch, resetLaunchRig } from './launchSequence';
import type { SpotLight, HemisphereLight, Light, Object3D } from 'three';

/** presentation beats (s) until the fail / results screens exist */
const BEAT = { death: 1.4, failedAutoRetry: 1.2, complete: 1.0, resultsAutoExit: 1.5 } as const;

let saved: { fog: [number, number, number]; shadowAuto: boolean } | null = null;
let gl: WebGLRenderer | null = null;
let unfollowCamera: (() => void) | null = null;

/** standby -> LAUNCH -> prepare -> launch sequence -> playing. Resolves true once playing.
 *  `skipLaunch` (QA): cut straight into the corridor. */
export async function enterMission(levelId: string, opts: MissionOptions = {}, skipLaunch = false): Promise<boolean> {
  const level = levelById(levelId);
  if (!level) return false;
  if (!flow.send('LAUNCH')) return false;
  await MissionLoader.prepare(level, opts);
  if (!flow.send('PREPARED')) return false;
  if (skipLaunch) beginFrame();
  else await runLaunch(beginFrame);
  return flow.send('LAUNCHED');
}

/** Warm the mission while the player reads the briefing (brief §14 MISSION PREPARE). */
export function prewarmMission(levelId: string, opts: MissionOptions = {}): void {
  const level = levelById(levelId);
  if (level) void MissionLoader.prepare(level, opts);
}

/** the cut into the mission frame (at the breach flash peak) */
function beginFrame(): void {
  const w = mission.world;
  if (!w) return;
  gl = w.gl;
  const fog = w.scene.fog as Fog | null;
  saved = { fog: fog ? [fog.color.getHex(), fog.near, fog.far] : [0, 0, 0], shadowAuto: w.gl.shadowMap.autoUpdate };
  // shadows are off in missions (no casters; castShadow flags never toggled = no recompiles)
  w.gl.shadowMap.autoUpdate = false;
  lightRig.borrow();
  applyLights();
  if (fog) {
    // enemies emerge from haze the colour of the corridor's mid tones
    fog.color.copy(mission.tunnel?.uniforms.uMid.value ?? fog.color.set(MISSION_LIGHTS.fog.color));
    fog.near = MISSION_LIGHTS.fog.near;
    fog.far = MISSION_LIGHTS.fog.far;
  }
  stage.cockpit = 0;
  stage.mission = 1;
  // the combiner + MFDs switch from launch / standby to live flight data at the breach
  cockpitFx.hudMode = 'mission';
  mission.root.visible = true;
  // the saved camera mode; Cycle Camera / Settings blend between rigs while flying
  mission.rig.onView = applyCockpitView;
  mission.rig.attach(w.camera, mission.player, missionMode(useSettings.getState().camera.mode));
  unfollowCamera?.();
  unfollowCamera = followCameraSetting();
  mission.vfx?.reset();
  mission.attitude.reset();
  mission.hands.reset();
  mission.stepper.resync();
  InputManager.attach(w.gl.domElement);
  InputManager.playing = true;
  InputManager.hooks = { pause: pauseMission, cycleCamera };
  perfMon.reset(`mission:${mission.level?.id ?? '?'}`);
}

function endFrame(): void {
  CameraShaker.setRumble(0);
  resetLaunchRig();
  InputManager.detach();
  InputManager.hooks = {};
  stage.mission = 0;
  mission.root.visible = false;
  unfollowCamera?.();
  unfollowCamera = null;
  mission.rig.detach();
  mission.hands.reset(); // the driver stops with the frame: hands back at rest for the Phase 1 cockpit
  cockpitFx.hudMode = 'off'; // MFDs / combiner leave live flight data
  lightRig.restore();
  if (gl && saved) {
    gl.shadowMap.autoUpdate = saved.shadowAuto;
    void whenWorldMounted().then(w => {
      const fog = w.scene.fog as Fog | null;
      if (fog && saved) {
        fog.color.setHex(saved.fog[0]);
        fog.near = saved.fog[1];
        fog.far = saved.fog[2];
      }
      saved = null;
    });
  }
  perfMon.reset('hangar');
}

function applyLights(): void {
  const O = MISSION_ORIGIN, L = MISSION_LIGHTS;
  const place = (o: Object3D | null, p: readonly [number, number, number]) => o?.position.set(O[0] + p[0], O[1] + p[1], O[2] + p[2]);
  const spot = (role: 'key' | 'rimA' | 'rimB', d: { pos: readonly [number, number, number]; color: string; intensity: number; angle: number; penumbra: number }) => {
    const l = lightRig.get<SpotLight>(role);
    if (!l) return;
    place(l, d.pos);
    l.color.set(d.color);
    l.intensity = d.intensity;
    l.angle = d.angle;
    l.penumbra = d.penumbra;
    l.updateMatrixWorld();
  };
  place(lightRig.get('target'), L.target);
  lightRig.get('target')?.updateMatrixWorld();
  spot('key', L.key);
  spot('rimA', L.rimA);
  spot('rimB', L.rimB);
  const hemi = lightRig.get<HemisphereLight>('hemi');
  if (hemi) {
    hemi.color.set(L.hemi.sky);
    hemi.groundColor.set(L.hemi.ground);
    hemi.intensity = L.hemi.intensity;
  }
  for (const r of ['cockpitKey', 'cockpitDash'] as const) {
    const l = lightRig.get<Light>(r);
    if (l) l.intensity = 0;
  }
}

/** Esc / blur / pointer-lock loss while playing */
export function pauseMission(): void {
  if (!flow.send('PAUSE')) return;
  InputManager.playing = false;
  InputManager.clear();
  InputManager.releaseLock();
  // 2A: click to resume (re-locks the pointer: a click is a user gesture). 2D adds the pause menu.
  const resume = () => {
    window.removeEventListener('mousedown', resume, true);
    resumeMission();
  };
  window.addEventListener('mousedown', resume, true);
}

export function resumeMission(): void {
  if (!flow.send('RESUME')) return;
  mission.stepper.resync();
  InputManager.playing = true;
  InputManager.requestLock();
}

/** HANGAR from pause / failed / results: reverse bulkhead sequence, mission torn down while sealed. */
export function missionToHangar(): boolean {
  if (!flow.send('HANGAR')) return false;
  InputManager.playing = false;
  InputManager.releaseLock();
  returnSequence(endFrame);
  return true;
}

/** Sim events that move the flow (called by MissionDriver for each new event). */
export function onSimEvent(slot: number): void {
  const sim = mission.sim;
  if (!sim) return;
  const type = sim.events.type[slot];
  if (type === Ev.PlayerDied) {
    if (!flow.send('PLAYER_DIED')) return;
    InputManager.playing = false;
    gsap.delayedCall(BEAT.death, () => {
      if (!flow.send('DEATH_DONE')) return;
      gsap.delayedCall(BEAT.failedAutoRetry, retryMission);
    });
  } else if (type === Ev.LevelComplete) {
    if (!flow.send('LEVEL_COMPLETE')) return;
    InputManager.playing = false;
    gsap.delayedCall(BEAT.complete, () => {
      if (!flow.send('COMPLETE_DONE')) return;
      gsap.delayedCall(BEAT.resultsAutoExit, () => void missionToHangar());
    });
  }
}

/** failed -> RETRY: sim state only (pools + compiled programs persist), from the last checkpoint. */
export function retryMission(): void {
  const sim = mission.sim;
  if (!sim || !flow.send('RETRY')) return;
  const cps = sim.level.checkpoints;
  let at = 0;
  for (const c of cps) if (c <= sim.player.s) at = c;
  sim.reset(at);
  mission.vfx?.reset();
  mission.attitude.reset();
  mission.stepper.resync();
  void runFastLaunch().then(() => {
    InputManager.playing = true;
    flow.send('LAUNCHED');
  });
}

/** QA: current flow state (debug API) */
export const missionDebug = { state: () => useFlow.getState().state };
