// Level 1 — FIRST LIGHT (Phase 2R §12): ARDEN, Marrow Valley. W1 wires the
// world (path + terrain); the timeline (tutorial, KESTREL-9, REAVER waves),
// comms, rewards and rank thresholds are authored in W6.
import type { LevelDef } from './types';
import { RAIL } from '../data/mission';
import { MISSION_01 } from '../data/lore';
import { ARDEN_01_PATH, ARDEN_01_WIDTH } from './paths/arden01';

export const LEVEL_01: LevelDef = {
  id: 'l01',
  levelNumber: 1,
  name: MISSION_01.title,
  worldId: 'arden',
  path: ARDEN_01_PATH,
  widthKeys: ARDEN_01_WIDTH,
  terrainSeed: 101,
  seed: 101,
  // the path is ~10.8 km incl. the 600 m lead-in and the lead-out over the basin
  lengthM: 10200,
  cruiseSpeed: 58,
  speedCurve: [[0, 58]],
  envelope: [[0, RAIL.envelope.a, RAIL.envelope.b]],
  timeline: [],
  checkpoints: [3100, 6200],
  comms: [],
  // first flight teaches itself (prompts from the real bindings, each retired once performed)
  tutorialHints: [
    { atM: 60, action: 'move', untilM: 900 },
    { atM: 320, action: 'aim', untilM: 1100 },
    { atM: 560, action: 'fire', untilM: 1300 },
    { atM: 900, action: 'boost', untilM: 1700 },
    { atM: 1300, action: 'roll', untilM: 2100 },
  ],
  rewards: { base: 0, scoreRate: 0, firstClearMult: 1 },
  rankThresholds: { S: 1, A: 1, B: 1 },
  intensityCurve: [[0, 0]],
};
