// World bible schemas (Phase 2R §3): one WorldDef per world, pure data
// (numbers, hex colours, ids) so sim, render, workers, the Phase 3 generator
// and tests all read the same thing. Angles in degrees, distances in world
// units (u ~ 1 m), colours '#rrggbb'. Render-side code turns these into
// uniforms; nothing here imports three.js.

export type Hex = `#${string}`;
export type Range = readonly [number, number];

/** Terrain modifiers layered on the shared valley composition (§5). */
export type TerrainModifier =
  | { kind: 'strata'; bands: number; sharpness: number; tilt: number }
  | { kind: 'terraces'; step: number; smooth: number }
  | { kind: 'dunes'; wavelength: number; height: number; coverage: number }
  | { kind: 'canals'; width: Range; depth: number; spacing: number }
  | { kind: 'hoodoos'; density: number; height: Range }
  | { kind: 'arches'; count: number }
  | { kind: 'iceU'; profile: number; crevasses: number }
  | { kind: 'fjord'; seaLevel: number; drownDepth: number }
  | { kind: 'lavaChannels'; width: Range; glow: number }
  | { kind: 'crystalShards'; density: number; height: Range }
  | { kind: 'fleshRibs'; spacing: number; height: Range }
  | { kind: 'floatingIslands'; density: number; size: Range };

export type TerrainDef = {
  /** valley floor half-width (u) and its sections (gorges) */
  floorHalfWidth: Range;
  gorgeHalfWidth: Range;
  /** valley walls rising from the floor edge */
  wallHeight: Range;
  /** gentle S-meanders of the valley axis around the path */
  meander: { amplitude: number; wavelength: number };
  /** low-frequency ridgelines / far peaks */
  ridges: { amplitude: number; wavelength: number; octaves: number; warp: number };
  peaks: { height: Range; distance: Range; snowLine?: number };
  /** derivative-damped erosion gullies 0..1 */
  erosion: number;
  /** slope sharpening for clean cliff faces 0..1 + scree apron width (u) */
  cliffs: { sharpen: number; screeApron: number };
  river?: { width: Range; depth: number; meander: number };
  /** total relief above the path (u) */
  relief: Range;
  modifiers: readonly TerrainModifier[];
  /** surface layers (splat) in blend order */
  surfaces: readonly { id: string; color: Hex; roughness: number; triplanarSlope?: number }[];
  /** infestation ground layer tint */
  infestation: { color: Hex; vein: Hex };
};

export type SunDef = { name: string; elevation: number; azimuth: number; color: Hex; discDeg: number; glow: number; intensity: number };

export type SkyBodyDef = {
  id: string;
  name: string;
  kind: 'moon' | 'planet' | 'gasGiant' | 'station' | 'shatteredMoon' | 'blackSun';
  /** angular diameter (deg): gas giants 12-18, moons 3-9 */
  angularDeg: number;
  elevation: number;
  azimuth: number;
  /** surface palette: base, mid, accent (bands / maria / cracks) */
  palette: readonly [Hex, Hex, Hex];
  surface: 'banded' | 'cratered' | 'icyCracked' | 'rocky' | 'cloudy' | 'void';
  atmosphere?: { color: Hex; thickness: number };
  rings?: { inner: number; outer: number; tilt: number; color: Hex; opacity: number };
  /** deg / minute (slow, cosmetic) */
  rotation: number;
};

export type CloudLayerDef = { kind: 'cumulus' | 'cirrus' | 'storm' | 'ash' | 'dust' | 'mist' | 'sea'; coverage: number; altitude: number; color: Hex; shadow: number };

export type SkyDef = {
  zenith: Hex;
  mid: Hex;
  horizon: Hex;
  suns: readonly SunDef[];
  haze: Hex;
  groundBounce: Hex;
  stars: { density: number; milkyWay: number };
  bodies: readonly SkyBodyDef[];
  clouds: readonly CloudLayerDef[];
  aurora?: { colors: readonly Hex[]; intensity: number };
  lightning?: { color: Hex; rate: number };
};

export type AtmosphereDef = {
  hazeNear: Hex;
  hazeFar: Hex;
  /** exp2 density (per u) and height falloff (per u) */
  density: number;
  heightFalloff: number;
  /** sun-direction in-scatter tint + strength */
  inscatter: { color: Hex; strength: number };
  /** enemies emerge from the haze at this distance (u) */
  emergeAt: number;
  grade: { exposure: number; contrast: number; saturation: number; shadowTint: Hex; highlightTint: Hex; split: number };
};

export type WaterDef = {
  kind: 'river' | 'sea' | 'canal' | 'lava' | 'frozen' | 'none';
  shallow: Hex;
  deep: Hex;
  foam: Hex;
  flowSpeed: number;
  waves: { amplitude: number; wavelength: number; choppiness: number };
  /** sea worlds: water plane height relative to the path datum */
  seaLevel?: number;
  waterfalls: number;
  emissive?: number;
};

export type FloraSpeciesDef = {
  id: string;
  name: string;
  kind: 'conifer' | 'broadleaf' | 'birch' | 'bush' | 'cactus' | 'thornUmbrella' | 'deadTree' | 'buttress' | 'fern' | 'crystal' | 'fungus';
  generator: 'eztree' | 'lsystem' | 'spaceColonisation' | 'procedural';
  variants: number;
  height: Range;
  bark: Hex;
  leaf: Hex;
  leafAlt: Hex;
  /** placement rules */
  density: number;
  slopeMax: number;
  altitude: Range;
  moisture: Range;
  emissive?: number;
};

export type GroundCoverDef = { id: string; kind: 'grass' | 'meadow' | 'flowers' | 'reeds' | 'tufts' | 'moss' | 'seaGrass' | 'ashTufts' | 'glowMoss' | 'snowTufts'; color: Hex; density: number; height: Range };

export type RockKitDef = { base: Hex; strata: Hex; varnish: Hex; variants: number; scatter: number; heroes: readonly string[] };

export type AmbientLifeDef = {
  id: string;
  name: string;
  kind: 'flock' | 'herd' | 'fish' | 'motes' | 'skybeast' | 'whale' | 'jelly' | 'beetles' | 'thermalKites';
  count: Range;
  /** how it reacts to the ship / explosions */
  reacts: 'scatter' | 'stampede' | 'dive' | 'ignore';
  color: Hex;
};

export type WeatherDef = {
  base: 'clear' | 'mist' | 'dust' | 'rain' | 'storm' | 'snow' | 'blizzard' | 'ash' | 'spores' | 'embers';
  intensity: number;
  wind: number;
  gusts: number;
  lightning?: { rate: number; thunderDelay: Range };
  precipitation?: { kind: 'rain' | 'snow' | 'ash' | 'embers' | 'spores'; density: number };
  /** set-piece weather events (ids) */
  events: readonly string[];
};

export type StrainDef = {
  id: string;
  /** Phase 2 family it re-skins (or WYRM / TITAN) */
  family: 'REAVER' | 'LANCER' | 'SPORE-CARRIER' | 'BULWARK' | 'SKITTERLING' | 'TENDRILLER' | 'HOLLOW MANTA' | 'WYRM' | 'TITAN' | 'SWARM';
  name: string;
  context: 'sky' | 'ground' | 'water' | 'burrow' | 'ridge';
  palette: readonly [Hex, Hex];
  /** emissive vein colour (hostile language: Nebula -> Danger) */
  vein: Hex;
  scale: number;
  /** finish: dust-caked / frost-rimed / sea-slicked / ... */
  finish: string;
  /** shipped in this pass (else Phase 3) */
  phase: 2 | 3;
};

export type AmbienceDef = { beds: readonly string[]; music: { key: string; tempo: number; mood: string } };

export type LightingDef = { key: Hex; keyIntensity: number; fillSky: Hex; fillGround: Hex; fillIntensity: number; rim: Hex; rimIntensity: number; /** sky environment (probe) intensity; default 1 */ envIntensity?: number };

export type LandmarkDef = { id: string; name: string; kind: 'mountain' | 'waterfall' | 'volcano' | 'spire' | 'titan' | 'city' | 'lighthouse' | 'dam' | 'statue' | 'arch' | 'wreck'; distance: Range; note: string };

export type PlanetGenDef = {
  seed: number;
  ocean: Hex;
  land: readonly Hex[];
  ice: number;
  clouds: { coverage: number; color: Hex };
  cityLights: number;
  lava?: number;
  atmosphere: Hex;
  bands?: readonly Hex[];
};

export type WorldDef = {
  id: string;
  number: number;
  name: string;
  /** the flown region of the implemented level(s) */
  region: string;
  climate: readonly string[];
  levels: Range;
  terrain: TerrainDef;
  sky: SkyDef;
  atmosphere: AtmosphereDef;
  water: WaterDef;
  flora: readonly FloraSpeciesDef[];
  rocks: RockKitDef;
  groundCover: readonly GroundCoverDef[];
  life: readonly AmbientLifeDef[];
  weather: WeatherDef;
  strains: readonly StrainDef[];
  ambience: AmbienceDef;
  lighting: LightingDef;
  landmarks: readonly LandmarkDef[];
  planet: PlanetGenDef;
  /** built to full quality in this pass (W1 / W3 / W6 flip as their slices land) */
  implemented: boolean;
};
