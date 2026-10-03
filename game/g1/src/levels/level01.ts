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
  // Creative Bible §5 L1: pre-dawn blue -> sunrise gold -> bright morning (the sun climbs over the
  // eastern range as the convoy flies; stars fade out; the haze warms then clears)
  todTimeline: [
    { atM: 0, sunEl: 1.5, sunAz: 72, sunColor: '#FF9A5A', zenith: '#16264A', mid: '#3E5585', horizon: '#E59866', hazeNear: '#8C8AA0', hazeFar: '#4E6488', inscatter: '#FF9A5A', key: '#FFB27A', keyIntensity: 2.4, exposure: 1.25, stars: 1, hazeDensity: 1.8, cloudCover: 0.7 },
    { atM: 2600, sunEl: 6, sunAz: 75, sunColor: '#FFB26E', zenith: '#1F3F7A', mid: '#6A89BE', horizon: '#F4B47C', hazeNear: '#B8A6A0', hazeFar: '#7C8EB2', inscatter: '#FFB26E', key: '#FFC58C', keyIntensity: 2.9, exposure: 1.12, stars: 0.3, hazeDensity: 1.3, cloudCover: 0.9 },
    { atM: 6000, sunEl: 14, sunAz: 78, exposure: 1, stars: 0, hazeDensity: 1, cloudCover: 1.1 },
    { atM: 10200, sunEl: 22, sunAz: 82, zenith: '#1A56A8', mid: '#63A6E0', horizon: '#EAD2A8', key: '#FFE6C0', keyIntensity: 3.4, exposure: 0.98, stars: 0, cloudCover: 1.1 },
  ],
  // the sky's moments: shooting stars before dawn, the Meridian crossing high in orbit, ORRIN sinking
  // toward the range in the gorge and RISING over the ridge into the hidden valley (AC6.5). Azimuths are
  // world; the path flies az -9..+8 deg, so the tracks sit in front of the pilot (third person sees ~+-50)
  skyEvents: [
    { kind: 'meteors', atM: 0, untilM: 2600, perMinute: 7 },
    { kind: 'meridian', atM: 1200, untilM: 4600, fromEl: 30, fromAz: -42, toEl: 21, toAz: 38 },
    { kind: 'bodyMove', body: 'orrin', atM: 2600, untilM: 4400, fromEl: 24, fromAz: -55, toEl: 4, toAz: -40 },
    { kind: 'bodyMove', body: 'orrin', atM: 5600, untilM: 8400, fromEl: 4, fromAz: -40, toEl: 27, toAz: -30 },
  ],
};
