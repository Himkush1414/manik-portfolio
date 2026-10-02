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
};
