// Level 1 — FIRST LIGHT (brief §14). 2C skeleton so the production launch
// path flies a real level: corridor 1, the L1 cruise speed and mood, ~9.3 km
// of the calm outer Veil, checkpoints for retries. The timeline (tutorial,
// KESTREL-9, first contacts), comms, rewards and rank thresholds arrive in
// 2G; until then the flight is the corridor itself.
import type { LevelDef } from './types';
import { RAIL } from '../data/mission';
import { MISSION_01 } from '../data/lore';

export const LEVEL_01: LevelDef = {
  id: 'l01',
  levelNumber: 1,
  name: MISSION_01.title,
  corridor: 1,
  seed: 101,
  lengthM: 9300,
  cruiseSpeed: 58,
  speedCurve: [[0, 58]],
  mood: { preset: 'l1', storm: [[0, 0]] },
  envelope: [[0, RAIL.envelope.a, RAIL.envelope.b]],
  pathParams: { amp: 9, freq: 0.0016, seed: 101 },
  radius: [[0, 1]],
  timeline: [],
  checkpoints: [3100, 6200],
  comms: [],
  tutorialHints: [],
  rewards: { base: 0, scoreRate: 0, firstClearMult: 1 },
  rankThresholds: { S: 1, A: 1, B: 1 },
  intensityCurve: [[0, 0]],
};
