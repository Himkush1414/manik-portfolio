// Mission flow (brief §14 / §17): drives the FSM through a mission and owns
// the frame swap. 2A: LAUNCH -> prepare -> swap straight into the mission
// frame (2B: catapult + flash; Phase 2R W5: orbit dive + cloud break); pause /
// resume; death -> failed -> retry and complete -> results are minimal until
// their screens land (2D / 2G); HANGAR leaves through the bulkhead sequence.
import gsap from 'gsap';
import type { Fog, WebGLRenderer } from 'three';
import { flow, useFlow } from '../flow';
import { Ev } from '../../game/core/events';
import { levelById } from '../../levels/registry';
import { MissionLoader } from '../../scenes/mission/MissionLoader';
import { mission, type MissionOptions } from '../../scenes/mission/missionRuntime';
import { whenWorldMounted } from '../../scenes/sceneBridge';
import { stage } from '../../scenes/Stage';
import { lightRig } from '../../render/lightRig';
import { InputManager } from '../../input/InputManager';
import { perfMon } from '../../render/perfMon';
import { CameraShaker } from '../../render/CameraShaker';
import { MISSION_VIEW } from '../../data/mission';
import { returnSequence } from '../choreo/launchTimeline';
import { cockpitFx } from '../../scenes/cockpit/displays';
import { useSettings } from '../../state/settings.store';
import { applyCockpitView, cycleCamera, followCameraSetting, missionMode } from '../../scenes/mission/missionCamera';
import { runLaunch, runFastLaunch, resetLaunchRig } from './launchSequence';
import { Color, type HemisphereLight, type Light, type PerspectiveCamera, type Scene } from 'three';
import type { WorldDef } from '../../data/worlds/types';

/** presentation beats (s) until the fail / results screens exist */
const BEAT = { death: 1.4, failedAutoRetry: 1.2, complete: 1.0, resultsAutoExit: 1.5 } as const;

let saved: { fog: [number, number, number]; shadowAuto: boolean; near: number; far: number; bg: Scene['background'] } | null = null;
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
  const cam = w.camera as PerspectiveCamera;
  saved = { fog: fog ? [fog.color.getHex(), fog.near, fog.far] : [0, 0, 0], shadowAuto: w.gl.shadowMap.autoUpdate, near: cam.near, far: cam.far, bg: w.scene.background };
  // shadows are off in missions (no casters; castShadow flags never toggled = no recompiles)
  w.gl.shadowMap.autoUpdate = false;
  lightRig.borrow();
  const env = mission.env;
  if (env) {
    applyWorldLights(env.def);
    // haze + sky colour of the world (W2: aerial-perspective chunk + sky dome replace these)
    const atm = env.def.atmosphere;
    if (fog) {
      fog.color.set(atm.hazeFar);
      fog.near = MISSION_VIEW.fogNear;
      fog.far = MISSION_VIEW.fogFar;
    }
    w.scene.background = new Color(env.def.sky.horizon);
    // the world needs a long far plane (two depth ranges arrive with the sky in W2)
    cam.near = MISSION_VIEW.near;
    cam.far = MISSION_VIEW.far;
    cam.updateProjectionMatrix();
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
      if (saved) {
        const cam = w.camera as PerspectiveCamera;
        cam.near = saved.near;
        cam.far = saved.far;
        cam.updateProjectionMatrix();
        w.scene.background = saved.bg;
      }
      saved = null;
    });
  }
  perfMon.reset('hangar');
}

/** The world's light set on the borrowed rig: the studio spots go dark (the sun replaces them), the
 *  hemisphere becomes the sky / ground fill; the sun itself (cockpit-key directional) is placed every
 *  frame by MissionWorld.applySun. Light count and types never change (no recompile). */
function applyWorldLights(def: WorldDef): void {
  for (const r of ['key', 'rimA', 'rimB', 'cockpitDash'] as const) {
    const l = lightRig.get<Light>(r);
    if (l) l.intensity = 0;
  }
  const hemi = lightRig.get<HemisphereLight>('hemi');
  if (hemi) {
    hemi.color.set(def.lighting.fillSky);
    hemi.groundColor.set(def.lighting.fillGround);
    hemi.intensity = def.lighting.fillIntensity;
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
