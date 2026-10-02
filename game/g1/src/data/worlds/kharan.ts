// WORLD 03 KHARAN — "THE GREAT CUT" (Phase 2R §3). Red-sandstone mesa
// canyons under late-afternoon TWIN SUNS: dune seas, ancient dry canals and
// aqueducts, wind arches, hoodoos, thorn trees. Moons KHEM + TIR, a faint
// ring arc, dust haze. Levels 9-12; L10 = THE WARDEN in the Great Cut.
import type { WorldDef } from './types';

export const KHARAN: WorldDef = {
  id: 'kharan',
  number: 3,
  name: 'KHARAN',
  region: 'THE GREAT CUT',
  climate: ['ARID', 'MESA CANYONS', 'TWIN SUNS'],
  levels: [9, 12],
  terrain: {
    floorHalfWidth: [120, 220],
    gorgeHalfWidth: [55, 85],
    wallHeight: [300, 700],
    meander: { amplitude: 90, wavelength: 1800 },
    ridges: { amplitude: 380, wavelength: 3200, octaves: 5, warp: 0.25 },
    peaks: { height: [700, 1000], distance: [2000, 6000] },
    erosion: 0.35,
    cliffs: { sharpen: 0.92, screeApron: 55 },
    relief: [700, 1300],
    modifiers: [
      { kind: 'strata', bands: 22, sharpness: 0.9, tilt: 0.02 },
      { kind: 'terraces', step: 34, smooth: 0.25 },
      { kind: 'dunes', wavelength: 60, height: 9, coverage: 0.45 },
      { kind: 'canals', width: [40, 70], depth: 9, spacing: 900 },
      { kind: 'hoodoos', density: 0.25, height: [40, 140] },
      { kind: 'arches', count: 5 },
    ],
    surfaces: [
      { id: 'sandstone', color: '#B5532F', roughness: 0.85, triplanarSlope: 0.5 },
      { id: 'ochre', color: '#D08A4A', roughness: 0.85 },
      { id: 'dune', color: '#E4C28F', roughness: 0.95 },
      { id: 'varnish', color: '#4B2C25', roughness: 0.6 },
      { id: 'canal-stone', color: '#9A8B76', roughness: 0.8 },
      { id: 'scrub', color: '#6F7A3B', roughness: 0.95 },
    ],
    infestation: { color: '#3A1E2A', vein: '#FF2D55' },
  },
  sky: {
    zenith: '#3E5F8E',
    mid: '#5A7BA8',
    horizon: '#E9B27A',
    suns: [
      { name: 'ARKA', elevation: 22, azimuth: -20, color: '#FFB35C', discDeg: 1.2, glow: 1.2, intensity: 3.4 },
      { name: 'VESS', elevation: 16, azimuth: -27, color: '#CFE3FF', discDeg: 0.45, glow: 0.6, intensity: 0.9 },
    ],
    haze: '#E0A272',
    groundBounce: '#B5532F',
    stars: { density: 0.05, milkyWay: 0 },
    bodies: [
      { id: 'khem', name: 'KHEM', kind: 'moon', angularDeg: 9, elevation: 38, azimuth: 120, palette: ['#C98A4A', '#9A6236', '#6E3E24'], surface: 'rocky', rotation: 0 },
      { id: 'tir', name: 'TIR', kind: 'moon', angularDeg: 3, elevation: 26, azimuth: 150, palette: ['#E4EEF6', '#B8C8D8', '#8AA0B8'], surface: 'icyCracked', rotation: 0 },
    ],
    clouds: [
      { kind: 'cirrus', coverage: 0.25, altitude: 7000, color: '#FFE0C0', shadow: 0 },
      { kind: 'dust', coverage: 0.3, altitude: 400, color: '#E0A272', shadow: 0.15 },
    ],
  },
  atmosphere: {
    hazeNear: '#E0A272',
    hazeFar: '#8A5A6A',
    density: 0.00055,
    heightFalloff: 0.0009,
    inscatter: { color: '#FFB35C', strength: 0.75 },
    emergeAt: 280,
    grade: { exposure: 1.02, contrast: 1.1, saturation: 1.05, shadowTint: '#4A2E5A', highlightTint: '#FFD0A0', split: 0.22 },
  },
  water: { kind: 'canal', shallow: '#5E8A7A', deep: '#3E6A62', foam: '#E8E0CC', flowSpeed: 0.4, waves: { amplitude: 0.05, wavelength: 4, choppiness: 0.1 }, waterfalls: 0 },
  flora: [
    { id: 'kharan-thorn', name: 'Umbrella thorn', kind: 'thornUmbrella', generator: 'spaceColonisation', variants: 6, height: [6, 12], bark: '#4A3328', leaf: '#6F7A3B', leafAlt: '#8A8A44', density: 0.35, slopeMax: 15, altitude: [0, 120], moisture: [0.5, 1] },
    { id: 'kharan-thorn-dry', name: 'Dry thorn', kind: 'thornUmbrella', generator: 'spaceColonisation', variants: 6, height: [4, 9], bark: '#5A3E2E', leaf: '#8A7A44', leafAlt: '#A08A4A', density: 0.25, slopeMax: 20, altitude: [0, 300], moisture: [0.2, 0.7] },
    { id: 'kharan-acacia', name: 'Canal acacia', kind: 'thornUmbrella', generator: 'spaceColonisation', variants: 6, height: [7, 13], bark: '#3E2C22', leaf: '#5E7A36', leafAlt: '#76863E', density: 0.3, slopeMax: 12, altitude: [0, 80], moisture: [0.65, 1] },
    { id: 'kharan-candle', name: 'Candle cactus', kind: 'cactus', generator: 'lsystem', variants: 6, height: [3, 9], bark: '#5E7A44', leaf: '#6E8A4E', leafAlt: '#C9A24A', density: 0.4, slopeMax: 28, altitude: [0, 400], moisture: [0, 0.5] },
    { id: 'kharan-organ', name: 'Organ cactus', kind: 'cactus', generator: 'lsystem', variants: 6, height: [4, 11], bark: '#55703E', leaf: '#6A8448', leafAlt: '#D07A4A', density: 0.25, slopeMax: 25, altitude: [0, 350], moisture: [0, 0.4] },
    { id: 'kharan-spire-cactus', name: 'Spire cactus', kind: 'cactus', generator: 'lsystem', variants: 6, height: [2, 6], bark: '#4E6A3E', leaf: '#5E7A46', leafAlt: '#E4C28F', density: 0.3, slopeMax: 30, altitude: [0, 500], moisture: [0, 0.35] },
    { id: 'kharan-scrub', name: 'Rust scrub', kind: 'bush', generator: 'procedural', variants: 6, height: [0.8, 2.2], bark: '#5A3E2E', leaf: '#6F7A3B', leafAlt: '#8A6E3A', density: 1, slopeMax: 35, altitude: [0, 600], moisture: [0, 0.8] },
  ],
  rocks: { base: '#B5532F', strata: '#D08A4A', varnish: '#4B2C25', variants: 8, scatter: 0.5, heroes: ['wind-arch', 'aqueduct-colonnade', 'canal-junction', 'great-cut-dam', 'statue-wall', 'crumbling-statue', 'hoodoo'] },
  groundCover: [
    { id: 'kharan-tufts', kind: 'tufts', color: '#A89A5A', density: 0.6, height: [0.3, 0.8] },
    { id: 'kharan-scrubgrass', kind: 'grass', color: '#8A8A4A', density: 0.35, height: [0.2, 0.5] },
  ],
  life: [
    { id: 'carrion-kites', name: 'Carrion-kites on thermals', kind: 'thermalKites', count: [6, 18], reacts: 'scatter', color: '#2A1E1A' },
    { id: 'beetle-herds', name: 'Scuttling beetle herds', kind: 'beetles', count: [20, 60], reacts: 'stampede', color: '#3A2A22' },
    { id: 'skybeasts', name: 'Migrating skybeasts', kind: 'skybeast', count: [2, 5], reacts: 'ignore', color: '#7A5A4A' },
    { id: 'dust-motes', name: 'Dust motes', kind: 'motes', count: [200, 500], reacts: 'ignore', color: '#F0C890' },
  ],
  weather: { base: 'dust', intensity: 0.45, wind: 0.55, gusts: 0.3, precipitation: undefined, events: ['dust-devils', 'sandstorm-wall', 'heat-shimmer'] },
  strains: [
    { id: 'kharan-reaver', family: 'REAVER', name: 'REAVER', context: 'sky', palette: ['#3A2620', '#5B2A6E'], vein: '#FF2D55', scale: 1, finish: 'dust-caked hull, sand-blasted edges', phase: 2 },
    { id: 'kharan-lancer', family: 'LANCER', name: 'LANCER', context: 'sky', palette: ['#34221E', '#5B2A6E'], vein: '#FF4D6E', scale: 1, finish: 'dust-caked hull', phase: 2 },
    { id: 'sand-skimmer', family: 'SWARM', name: 'SAND SKIMMER', context: 'ground', palette: ['#8A5A3A', '#4B2A3E'], vein: '#FF2D55', scale: 0.8, finish: 'flat ray body, sand-coloured back, violet belly', phase: 2 },
    { id: 'sandwyrm', family: 'WYRM', name: 'SANDWYRM', context: 'burrow', palette: ['#6E3E2A', '#3A1E2A'], vein: '#FF2D55', scale: 1, finish: 'wet chitin under sand crust, maw weak point', phase: 2 },
    { id: 'mesa-titan', family: 'TITAN', name: 'MESA TITAN', context: 'ridge', palette: ['#4B2C25', '#2A1E2A'], vein: '#7B5BFF', scale: 1, finish: 'stone-crusted colossus', phase: 2 },
  ],
  ambience: { beds: ['wind-dry', 'dust', 'canyon-echo', 'distant-rumble', 'warden-groans'], music: { key: 'A phrygian dominant', tempo: 104, mood: 'heat and dread' } },
  lighting: { key: '#FFB35C', keyIntensity: 3.4, fillSky: '#7A96C0', fillGround: '#B5532F', fillIntensity: 0.6, rim: '#CFE3FF', rimIntensity: 1.6 },
  landmarks: [
    { id: 'great-cut', name: 'The Great Cut', kind: 'dam', distance: [3000, 6000], note: 'mile-wide canyon basin, ancient dam + statue wall (L10 arena)' },
    { id: 'mesa-titans', name: 'Titans on the rim', kind: 'titan', distance: [3000, 7000], note: 'colossus silhouettes striding the mesa rims' },
    { id: 'kharan-gate', name: 'The open gate', kind: 'arch', distance: [5000, 8000], note: 'the Veil gate glow above the Great Cut' },
  ],
  planet: { seed: 3303, ocean: '#5A3E3A', land: ['#B5532F', '#D08A4A', '#E4C28F', '#8A5A6A'], ice: 0.05, clouds: { coverage: 0.15, color: '#F0D8B8' }, cityLights: 0.02, atmosphere: '#F0B880' },
  implemented: false,
};
