// WORLD 06 STORMWARD — "THE LONG FJORD" (Phase 2R §3). Drowned glacial
// fjords under a permanent storm at dusk: black cliffs, sea-level valleys,
// waterfalls, sea stacks, dark conifers, rain sheets, lightning. Giant
// cracked ice moon THALASSA through the cloud breaks. Levels 21-25; L22 =
// STORMFRONT (relay beacon on the headland).
import type { WorldDef } from './types';

export const STORMWARD: WorldDef = {
  id: 'stormward',
  number: 6,
  name: 'STORMWARD',
  region: 'THE LONG FJORD',
  climate: ['STORM', 'DROWNED FJORDS', 'COLD SEA'],
  levels: [21, 25],
  terrain: {
    floorHalfWidth: [110, 240],
    gorgeHalfWidth: [45, 70],
    wallHeight: [300, 800],
    meander: { amplitude: 140, wavelength: 2000 },
    ridges: { amplitude: 600, wavelength: 2400, octaves: 6, warp: 0.4 },
    peaks: { height: [900, 1300], distance: [2000, 5000], snowLine: 1000 },
    erosion: 0.7,
    cliffs: { sharpen: 0.95, screeApron: 25 },
    relief: [700, 1300],
    modifiers: [
      { kind: 'iceU', profile: 0.85, crevasses: 0 },
      { kind: 'fjord', seaLevel: 0, drownDepth: 40 },
      { kind: 'strata', bands: 6, sharpness: 0.3, tilt: 0.25 },
    ],
    surfaces: [
      { id: 'basalt', color: '#2A2F36', roughness: 0.55, triplanarSlope: 0.45 },
      { id: 'wet-moss', color: '#2F4A3A', roughness: 0.7 },
      { id: 'grass', color: '#3A5440', roughness: 0.8 },
      { id: 'shingle', color: '#4A5058', roughness: 0.6 },
      { id: 'snow', color: '#DCE4EA', roughness: 0.6 },
    ],
    infestation: { color: '#1E2A3A', vein: '#7B5BFF' },
  },
  sky: {
    zenith: '#20262E',
    mid: '#3A4652',
    horizon: '#5E7282',
    suns: [{ name: 'HIDDEN SUN', elevation: 4, azimuth: 200, color: '#E8B26A', discDeg: 0.8, glow: 0.4, intensity: 1.1 }],
    haze: '#5E7282',
    groundBounce: '#243846',
    stars: { density: 0, milkyWay: 0 },
    bodies: [
      { id: 'thalassa', name: 'THALASSA', kind: 'shatteredMoon', angularDeg: 20, elevation: 34, azimuth: 160, palette: ['#CFE6F4', '#8FB4CC', '#3E6E8E'], surface: 'icyCracked', atmosphere: { color: '#BFE0F0', thickness: 0.02 }, rings: { inner: 1.6, outer: 2.6, tilt: 22, color: '#9FD4B8', opacity: 0.35 }, rotation: 0.2 },
    ],
    clouds: [
      { kind: 'storm', coverage: 0.85, altitude: 900, color: '#3E4A56', shadow: 0.5 },
      { kind: 'sea', coverage: 0.5, altitude: 120, color: '#7C8E9C', shadow: 0.2 },
    ],
    lightning: { color: '#CFE6FF', rate: 0.12 },
  },
  atmosphere: {
    hazeNear: '#5E7282',
    hazeFar: '#3E4E5C',
    density: 0.0008,
    heightFalloff: 0.0015,
    inscatter: { color: '#E8B26A', strength: 0.25 },
    emergeAt: 260,
    grade: { exposure: 0.98, contrast: 1.12, saturation: 0.82, shadowTint: '#1E2E3E', highlightTint: '#E8C89A', split: 0.25 },
  },
  water: { kind: 'sea', shallow: '#36505E', deep: '#243846', foam: '#D4E2EA', flowSpeed: 0.8, waves: { amplitude: 1.6, wavelength: 34, choppiness: 0.7 }, seaLevel: -30, waterfalls: 6 },
  flora: [
    { id: 'storm-fir', name: 'Black fir', kind: 'conifer', generator: 'lsystem', variants: 6, height: [16, 30], bark: '#2A221E', leaf: '#17312A', leafAlt: '#1E3A30', density: 0.9, slopeMax: 45, altitude: [0, 700], moisture: [0.4, 1] },
    { id: 'storm-spruce', name: 'Wind spruce', kind: 'conifer', generator: 'lsystem', variants: 6, height: [10, 22], bark: '#2E2620', leaf: '#1A3530', leafAlt: '#24403A', density: 0.6, slopeMax: 50, altitude: [40, 800], moisture: [0.3, 1] },
    { id: 'storm-pine', name: 'Leaning shore pine', kind: 'conifer', generator: 'lsystem', variants: 6, height: [8, 16], bark: '#3A2E26', leaf: '#21402F', leafAlt: '#2C4A36', density: 0.35, slopeMax: 40, altitude: [0, 200], moisture: [0.5, 1] },
    { id: 'storm-dead', name: 'Storm-killed snag', kind: 'deadTree', generator: 'spaceColonisation', variants: 6, height: [8, 18], bark: '#4A4440', leaf: '#4A4440', leafAlt: '#3A3632', density: 0.12, slopeMax: 40, altitude: [0, 600], moisture: [0, 1] },
    { id: 'storm-juniper', name: 'Cliff juniper', kind: 'bush', generator: 'procedural', variants: 6, height: [1, 3], bark: '#3A2E26', leaf: '#2F4A3A', leafAlt: '#3A5440', density: 0.8, slopeMax: 60, altitude: [0, 900], moisture: [0.3, 1] },
  ],
  rocks: { base: '#2A2F36', strata: '#3A4048', varnish: '#1E2228', variants: 8, scatter: 0.7, heroes: ['sea-stack', 'ruined-platform', 'lighthouse', 'relay-beacon', 'driftwood-pile', 'rockslide'] },
  groundCover: [
    { id: 'storm-moss', kind: 'moss', color: '#2F4A3A', density: 1, height: [0.1, 0.3] },
    { id: 'storm-grass', kind: 'grass', color: '#3E5A44', density: 0.6, height: [0.3, 0.7] },
    { id: 'storm-seagrass', kind: 'seaGrass', color: '#4A6A4E', density: 0.5, height: [0.5, 1.2] },
  ],
  life: [
    { id: 'seabirds', name: 'Seabird flocks', kind: 'flock', count: [20, 50], reacts: 'scatter', color: '#D8DCE0' },
    { id: 'whale-backs', name: 'Breaching whale-backs', kind: 'whale', count: [1, 3], reacts: 'dive', color: '#2A3440' },
    { id: 'jelly-drifters', name: 'Glowing jelly drifters', kind: 'jelly', count: [20, 60], reacts: 'ignore', color: '#7FD1FF' },
  ],
  weather: { base: 'storm', intensity: 0.8, wind: 0.8, gusts: 0.5, lightning: { rate: 0.12, thunderDelay: [0.6, 3] }, precipitation: { kind: 'rain', density: 0.9 }, events: ['rain-sheets', 'sea-spray', 'lightning-pillar', 'rockslide'] },
  strains: [
    { id: 'storm-reaver', family: 'REAVER', name: 'REAVER', context: 'sky', palette: ['#1E2630', '#3A2A5E'], vein: '#7B5BFF', scale: 1, finish: 'sea-slicked hull, salt crust', phase: 2 },
    { id: 'storm-lancer', family: 'LANCER', name: 'LANCER', context: 'sky', palette: ['#1A222C', '#3A2A5E'], vein: '#9A7BFF', scale: 1, finish: 'sea-slicked hull', phase: 2 },
    { id: 'storm-eel', family: 'SWARM', name: 'STORM EEL', context: 'sky', palette: ['#1E3040', '#4B2A9E'], vein: '#CFE6FF', scale: 0.9, finish: 'eel swarm with arcing lightning', phase: 2 },
    { id: 'kraken-tendriller', family: 'TENDRILLER', name: 'KRAKEN-TENDRILLER', context: 'water', palette: ['#2A2236', '#5B2A6E'], vein: '#FF2D55', scale: 1.6, finish: 'barnacled tentacles rising from the sea', phase: 2 },
    { id: 'storm-manta', family: 'HOLLOW MANTA', name: 'STORM MANTA', context: 'sky', palette: ['#20283A', '#4B2A9E'], vein: '#7B5BFF', scale: 1.2, finish: 'rain-sheened wings', phase: 2 },
    { id: 'stack-bulwark', family: 'BULWARK', name: 'BULWARK (sea stack)', context: 'water', palette: ['#2A2F36', '#3A2A5E'], vein: '#FF2D55', scale: 1, finish: 'grown into a basalt sea stack', phase: 2 },
  ],
  ambience: { beds: ['rain', 'sea', 'thunder', 'wind-howl'], music: { key: 'C minor (dorian)', tempo: 118, mood: 'relentless storm' } },
  lighting: { key: '#7C93A8', keyIntensity: 1.6, fillSky: '#5E7282', fillGround: '#243846', fillIntensity: 0.7, rim: '#E8B26A', rimIntensity: 1.2 },
  landmarks: [
    { id: 'beacon-headland', name: 'Relay beacon headland', kind: 'lighthouse', distance: [3000, 6000], note: 'ruined platform + lighthouse at the end of the Long Fjord (L22 finish)' },
    { id: 'fjord-falls', name: 'Hanging valley falls', kind: 'waterfall', distance: [2000, 4000], note: 'waterfalls pouring off the cliff tops into the sea' },
    { id: 'stormward-spire', name: 'Drowned hive-spire', kind: 'spire', distance: [4000, 7000], note: 'Umbra spire rising from the sea, lit by lightning' },
  ],
  planet: { seed: 6606, ocean: '#243846', land: ['#2A2F36', '#2F4A3A', '#4A5058'], ice: 0.35, clouds: { coverage: 0.85, color: '#9AA8B4' }, cityLights: 0.03, atmosphere: '#9FB8C8' },
  implemented: false,
};
