// Mission runtime (non-React): the live sim, its stepper, the player view
// objects and options. MissionLoader fills it; MissionDriver steps it;
// missionFlow moves it through the FSM.
import { Group } from 'three';
import { FixedStepper } from '../../game/core/step';
import { emptyInput } from '../../game/input';
import type { Sim } from '../../game/sim';
import type { Bot } from '../../game/bot/bot';
import type { LevelDef } from '../../levels/types';
import type { BuiltShip } from '../../ships/ShipFactory';
import type { SpeedStreaks } from '../../render/mission/vfx/SpeedStreaks';
import type { MissionWorld } from '../../render/world/MissionWorld';
import type { MissionVfx } from '../../render/mission/vfx/MissionVfx';
import type { WorldHandles } from '../sceneBridge';
import type { BotSkillId } from '../../data/bot';
import { RigSwitcher } from '../../render/rigs/RigSwitcher';
import { ShipAttitude } from '../../render/mission/shipAttitude';
import { CockpitHands } from './cockpitHands';
import { MISSION_ORIGIN } from '../sceneBridge';

export type MissionOptions = { bot?: BotSkillId | null; god?: boolean; seed?: number };

/** the mission frame: everything mission-side hangs under this group */
const root = new Group();
root.name = 'mission-root';
root.position.set(...MISSION_ORIGIN);
root.visible = false;
/** player attitude wrapper (position x/y, bank / pitch / roll); the ship model sits inside */
const player = new Group();
player.name = 'mission-player';
root.add(player);

export const mission = {
  root,
  player,
  level: null as LevelDef | null,
  sim: null as Sim | null,
  bot: null as Bot | null,
  ship: null as BuiltShip | null,
  /** Phase 2R: the world this level flies (path, terrain, streaming, sun) */
  env: null as MissionWorld | null,
  /** level id + preset the env was built for */
  envKey: '',
  streaks: null as SpeedStreaks | null,
  /** weapons / impacts / trails (render/mission/vfx) */
  vfx: null as MissionVfx | null,
  sky: null as import('three').Mesh | null,
  world: null as WorldHandles | null,
  /** QA: input fields forced on top of the pilot each step (__G1__.sim.force) */
  qaForce: null as null | Partial<import('../../game/input').SimInput>,
  /** presentation clock for shaders (never the sim clock) */
  time: 0,
  shipKey: '',
  opts: {} as MissionOptions,
  input: emptyInput(),
  stepper: new FixedStepper(),
  /** the three camera rigs + blend (brief §8) */
  rig: new RigSwitcher(),
  /** presentation time scale (hit-stop / slow-mo); the sim always steps at 60 Hz */
  timeScale: 1,
  prepared: false,
  /** 0..1 SYSTEMS SYNC progress (HUD) */
  progress: 0,
  /** visual roll angle (barrel roll animation) */
  rollVis: 0,
  /** the flown ship's visual attitude springs (presentation only) */
  attitude: new ShipAttitude(),
  /** cockpit view: stick / throttle follow the pilot's input */
  hands: new CockpitHands(),
};
