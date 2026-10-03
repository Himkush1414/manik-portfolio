// A minimal LevelDef for unit tests, the sim lab (?screen=simlab) and QA
// (?level=test): a ~4 km stretch of ARDEN valley at the L1 cruise speed,
// no timeline. Unit tests run the sim without the world (envelope segments).
import type { LevelDef } from './types';
import { RAIL, ENVELOPES } from '../data/mission';

// the world path flies the open-plains envelope (Creative Bible AC2.4); `envelope` below is for unit
// tests that run the sim without the world
const w = (x: number, z: number, clearance: number, floor: number) => ({ x, z, clearance, envA: ENVELOPES.plains.a, envB: ENVELOPES.plains.b, bank: 0, floor });

export const TEST_LEVEL: LevelDef = {
  id: 'test',
  levelNumber: 0,
  name: 'TEST VALLEY',
  worldId: 'arden',
  path: { datum: 40, waypoints: [w(0, 400, 40, 42), w(0, 0, 38, 40), w(90, -1300, 34, 36), w(-60, -2700, 40, 30), w(0, -4100, 36, 26), w(0, -4700, 40, 26)] },
  widthKeys: [[0, 200], [1500, 170], [2600, 120], [3400, 190], [6000, 200]],
  terrainSeed: 4321,
  seed: 1234,
  lengthM: 4000,
  cruiseSpeed: 58,
  speedCurve: [[0, 58]],
  envelope: [[0, RAIL.envelope.a, RAIL.envelope.b]],
  timeline: [],
  checkpoints: [],
  comms: [],
  tutorialHints: [],
  rewards: { base: 0, scoreRate: 0, firstClearMult: 1 },
  rankThresholds: { S: 1, A: 1, B: 1 },
  intensityCurve: [[0, 0]],
};
