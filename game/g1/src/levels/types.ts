import type { EnvelopeArchetype } from '../data/mission';
import type { PathDef } from '../game/world/pathDef';
// LevelDef (brief §14). Phase 3 GENERATES 50 of these, so everything is plain
// data: no functions, no class instances, numbers in metres along the rail
// (atM = the player's rail position when the event fires). Validated by
// levels/validate.ts; intensity estimated by levels/intensity.ts.

export type SpawnKind = 'enemy' | 'monster' | 'hazard' | 'pickup' | 'event';

export type SpawnEvent = {
  /** player rail position (m) at which it fires; timelines are sorted by atM */
  atM: number;
  kind: SpawnKind;
  /** registry id (enemies / creatures / hazards / pickups) or an event name */
  type: string;
  /** PatternLib id (game/patterns) for formations / paths */
  pattern?: string;
  /** pattern + behaviour parameters (numbers only: generator-friendly) */
  params?: Readonly<Record<string, number>>;
  count?: number;
  /** lateral anchor (x, y) in rail space */
  lane?: readonly [number, number];
  /** attack tokens this spawn needs to fire (fairness budget) */
  tokenCost?: number;
};

export type Speaker = 'SATO' | 'STATIC' | 'SEVEN' | 'KESTREL';
export type CommLine = { atM: number; speaker: Speaker; text: string; static?: boolean };

export type TutorialAction = 'move' | 'aim' | 'fire' | 'roll' | 'boost';
export type TutorialHint = { atM: number; action: TutorialAction; /** auto-dismiss distance if never performed */ untilM?: number };

/** Boss hook (2I extends this additively: phases, parts, attack scripts, telegraphs). */
export type BossDef = {
  type: string;
  /** rail position where the arena starts (also the retry checkpoint) */
  atM: number;
  /** arena envelope + hover speed */
  arena: { a: number; b: number; speed: number };
};

/** LevelDef version (Phase 2R: worlds replace the wormhole corridor) */
export const LEVEL_DEF_VERSION = 2;

export type LevelDef = {
  id: string;
  /** 1..50 */
  levelNumber: number;
  name: string;
  /** Phase 2R: the world this level flies (data/worlds), world = ceil(level * 12 / 50) */
  worldId: string;
  /** the authored flight path (game/world/pathDef) and the valley half-width keys [s, halfWidth] */
  path: PathDef;
  widthKeys?: readonly (readonly [number, number])[];
  /** TerrainField seed */
  terrainSeed: number;
  seed: number;
  lengthM: number;
  cruiseSpeed: number;
  /** [atM, u/s], sorted */
  speedCurve: readonly (readonly [number, number])[];
  /** [atM, a, b] envelope segments, sorted (used when the sim runs without the world path, e.g. unit
   *  tests; with the path the envelope comes from its waypoints) */
  envelope: readonly (readonly [number, number, number])[];
  timeline: readonly SpawnEvent[];
  /** atM of each checkpoint, sorted */
  checkpoints: readonly number[];
  comms: readonly CommLine[];
  tutorialHints: readonly TutorialHint[];
  boss?: BossDef;
  rewards: { base: number; scoreRate: number; firstClearMult: number };
  rankThresholds: { S: number; A: number; B: number };
  /** designed intensity [atM, 0..1] (the validator compares the estimate against it) */
  intensityCurve: readonly (readonly [number, number])[];
  /** time of day DURING the mission (Creative Bible AC5.1): keys by rail position, blended smoothly;
   *  a field left out falls back to the world's def. Uniforms only (no recompile). */
  todTimeline?: readonly TodKey[];
  /** authored sky moments (Creative Bible AC5.4 / AC6.2 / AC6.5), by rail position */
  skyEvents?: readonly SkyEvent[];
  /** the level as a JOURNEY of landscape chapters (Creative Bible §3, AC3.1 / AC3.2 / AC2.11): each
   *  sets the valley's floor half-width, wall height, steepness and minimum wall (from its archetype's
   *  preset, data/mission.ts CHAPTERS, unless overridden), blended into the next over `blend` m. When
   *  present it replaces widthKeys. */
  chapters?: readonly ChapterDef[];
};

/** one landscape chapter (C1) */
export type ChapterDef = {
  atM: number;
  kind: EnvelopeArchetype;
  name?: string;
  /** floor half-width (u), wall height (u), steepness 0 rolling .. 1 cliff, minimum wall share 0..1 */
  halfWidth?: number;
  wallHeight?: number;
  steep?: number;
  rim?: number;
  /** blend INTO this chapter over this many metres centred on atM (200-500) */
  blend?: number;
};

/** A sky moment: a world body moving (planet-rise over a ridge), shooting stars (fading with the stars),
 *  the ICS Meridian crossing in orbit (scale). Positions in deg (elevation, azimuth like the world defs). */
export type SkyEvent =
  | { kind: 'bodyMove'; body: string; atM: number; untilM: number; fromEl: number; fromAz: number; toEl: number; toAz: number }
  | { kind: 'meteors'; atM: number; untilM: number; perMinute: number }
  | { kind: 'meridian'; atM: number; untilM: number; fromEl: number; fromAz: number; toEl: number; toAz: number };

type HexColor = `#${string}`;
/** one time-of-day key (Creative Bible AC5.1): sun elevation / azimuth (deg) + optional colours,
 *  key-light intensity and pre-tone-map exposure */
export type TodKey = {
  atM: number;
  sunEl: number;
  sunAz: number;
  sunColor?: HexColor;
  zenith?: HexColor;
  mid?: HexColor;
  horizon?: HexColor;
  hazeNear?: HexColor;
  hazeFar?: HexColor;
  inscatter?: HexColor;
  key?: HexColor;
  keyIntensity?: number;
  exposure?: number;
  /** star field visibility multiplier (pre-dawn / dusk) */
  stars?: number;
  /** WEATHER (AC5.2): haze density multiplier (ground mist / clearing) and cumulus cover multiplier */
  hazeDensity?: number;
  cloudCover?: number;
};
