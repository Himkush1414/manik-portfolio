// A minimal LevelDef for unit tests and the sim lab (?screen=simlab): a
// straight 4 km corridor at the L1 cruise speed, no timeline.
import type { LevelDef } from './types';
import { RAIL } from '../data/mission';

export const TEST_LEVEL: LevelDef = {
  id: 'test',
  levelNumber: 0,
  name: 'TEST CORRIDOR',
  corridor: 1,
  seed: 1234,
  lengthM: 4000,
  cruiseSpeed: 58,
  speedCurve: [[0, 58]],
  mood: { preset: 'l1', storm: [[0, 0]] },
  envelope: [[0, RAIL.envelope.a, RAIL.envelope.b]],
  pathParams: { amp: 9, freq: 0.0016, seed: 1 },
  // QA set pieces: a chamber (46 -> 110 u over 150 m) and a collapse
  radius: [[0, 1], [700, 1], [850, 110 / 46], [1500, 110 / 46], [1650, 0.65], [2100, 0.65], [2250, 1]],
  timeline: [],
  checkpoints: [],
  comms: [],
  tutorialHints: [],
  rewards: { base: 0, scoreRate: 0, firstClearMult: 1 },
  rankThresholds: { S: 1, A: 1, B: 1 },
  intensityCurve: [[0, 0]],
};
