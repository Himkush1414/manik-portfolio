// The nine worlds DESIGNED in Phase 2R and built in Phase 3 from the same
// systems (§3 roster): CINDER, HALDERN, SPOREFALL, OSSUARY, AURELIA,
// GLASSFIELD, VANTA, MAW, THE HOLLOW CROWN. Identity data (palette, sky
// bodies, terrain modifiers, flora, life, weather, strains, landmarks,
// planet) is final design; the mechanical fields `world()` fills (surface
// roughness, generator choice, placement ranges) are Phase 3 tuning.
import type { AmbientLifeDef, FloraSpeciesDef, Hex, LandmarkDef, SkyBodyDef, StrainDef, WorldDef } from './types';

type Spec = Omit<WorldDef, 'flora' | 'groundCover' | 'implemented' | 'terrain' | 'life' | 'strains' | 'landmarks'> & {
  terrain: Omit<WorldDef['terrain'], 'surfaces'> & { surfaces: readonly (readonly [string, Hex])[] };
  flora: readonly (readonly [string, string, FloraSpeciesDef['kind'], Hex, Hex, Hex?])[];
  cover: readonly (readonly [WorldDef['groundCover'][number]['kind'], Hex])[];
  life: readonly (readonly [string, AmbientLifeDef['kind'], AmbientLifeDef['reacts'], Hex])[];
  strains: readonly (readonly [string, StrainDef['family'], StrainDef['context'], Hex, Hex, Hex, string])[];
  landmarks: readonly (readonly [string, LandmarkDef['kind'], string])[];
};

const GEN: Record<FloraSpeciesDef['kind'], FloraSpeciesDef['generator']> = {
  conifer: 'lsystem', broadleaf: 'eztree', birch: 'eztree', bush: 'procedural', cactus: 'lsystem', thornUmbrella: 'spaceColonisation',
  deadTree: 'spaceColonisation', buttress: 'spaceColonisation', fern: 'procedural', crystal: 'procedural', fungus: 'procedural',
};

function world(s: Spec): WorldDef {
  const { flora, cover, life, strains, landmarks, terrain, ...rest } = s;
  return {
    ...rest,
    terrain: { ...terrain, surfaces: terrain.surfaces.map(([id, color], i) => ({ id, color, roughness: 0.85, ...(i === 0 ? { triplanarSlope: 0.5 } : {}) })) },
    flora: flora.map(([id, name, kind, bark, leaf, leafAlt]) => ({ id, name, kind, generator: GEN[kind], variants: 6, height: kind === 'bush' || kind === 'fern' || kind === 'fungus' ? [1, 3.5] : [6, 24], bark, leaf, leafAlt: leafAlt ?? leaf, density: 0.6, slopeMax: 35, altitude: [0, 700], moisture: [0, 1] })),
    groundCover: cover.map(([kind, color], i) => ({ id: `${s.id}-${kind}-${i}`, kind, color, density: 0.6, height: [0.2, 0.8] })),
    life: life.map(([name, kind, reacts, color], i) => ({ id: `${s.id}-life-${i}`, name, kind, count: kind === 'motes' ? [200, 500] : [6, 40], reacts, color })),
    strains: strains.map(([name, family, context, a, b, vein, finish], i) => ({ id: `${s.id}-strain-${i}`, family, name, context, palette: [a, b], vein, scale: 1, finish, phase: 3 })),
    landmarks: landmarks.map(([name, kind, note], i) => ({ id: `${s.id}-lm-${i}`, name, kind, distance: [3000, 8000], note })),
    implemented: false,
  };
}

const moon = (id: string, name: string, deg: number, el: number, az: number, p: readonly [Hex, Hex, Hex], surface: SkyBodyDef['surface'] = 'cratered'): SkyBodyDef => ({ id, name, kind: 'moon', angularDeg: deg, elevation: el, azimuth: az, palette: p, surface, rotation: 0 });

export const CINDER = world({
  id: 'cinder', number: 2, name: 'CINDER', region: 'THE ASHWAYS', climate: ['VOLCANIC', 'LAVA RIVERS', 'ASH STORMS'], levels: [5, 8],
  terrain: { floorHalfWidth: [100, 200], gorgeHalfWidth: [50, 80], wallHeight: [300, 650], meander: { amplitude: 100, wavelength: 1500 }, ridges: { amplitude: 520, wavelength: 2400, octaves: 6, warp: 0.5 }, peaks: { height: [900, 1400], distance: [2500, 6000] }, erosion: 0.4, cliffs: { sharpen: 0.85, screeApron: 30 }, relief: [700, 1300],
    modifiers: [{ kind: 'lavaChannels', width: [14, 30], glow: 2.4 }, { kind: 'strata', bands: 9, sharpness: 0.5, tilt: 0.15 }],
    surfaces: [['basalt', '#1E1C1E'], ['ash', '#4A4442'], ['scoria', '#5E2A22'], ['cooled-lava', '#2A2224'], ['sulphur', '#B8A23A']], infestation: { color: '#2A1018', vein: '#FF2D55' } },
  sky: { zenith: '#1A1012', mid: '#4A2018', horizon: '#C2502A', suns: [{ name: 'EMBERHEART', elevation: 10, azimuth: 20, color: '#FF5A2A', discDeg: 4, glow: 2, intensity: 2.2 }], haze: '#6A2A1E', groundBounce: '#FF5A1F', stars: { density: 0, milkyWay: 0 },
    bodies: [moon('cinder-m', 'SOT', 4, 30, 140, ['#5A4A44', '#3A2E2A', '#FF8A3D'])], clouds: [{ kind: 'ash', coverage: 0.7, altitude: 1100, color: '#3A2A26', shadow: 0.45 }], lightning: { color: '#FFC8A0', rate: 0.08 } },
  atmosphere: { hazeNear: '#6A2A1E', hazeFar: '#3A1A1A', density: 0.0009, heightFalloff: 0.001, inscatter: { color: '#FF5A2A', strength: 0.8 }, emergeAt: 260, grade: { exposure: 1, contrast: 1.15, saturation: 1.1, shadowTint: '#2A0E14', highlightTint: '#FFB070', split: 0.3 } },
  water: { kind: 'lava', shallow: '#FF8A3D', deep: '#C2301A', foam: '#FFE1C2', flowSpeed: 0.6, waves: { amplitude: 0.3, wavelength: 8, choppiness: 0.2 }, waterfalls: 3, emissive: 3 },
  flora: [['cinder-snag', 'Scorched snag', 'deadTree', '#1E1A18', '#2A2422'], ['cinder-ashpine', 'Ash pine', 'conifer', '#2A2220', '#3A3634'], ['cinder-ember-bush', 'Ember bush', 'bush', '#2A1E1A', '#7A2A1E', '#FF5A1F']],
  cover: [['ashTufts', '#5A5250']], rocks: { base: '#1E1C1E', strata: '#3A3032', varnish: '#5E2A22', variants: 8, scatter: 0.7, heroes: ['lava-fall', 'obsidian-arch', 'vent-stack'] },
  life: [['Ember motes', 'motes', 'ignore', '#FF8A3D'], ['Ash vultures', 'flock', 'scatter', '#1A1414']], weather: { base: 'embers', intensity: 0.7, wind: 0.4, gusts: 0.3, lightning: { rate: 0.08, thunderDelay: [0.5, 2] }, precipitation: { kind: 'embers', density: 0.6 }, events: ['ash-plume', 'ash-lightning', 'lava-burst'] },
  strains: [['EMBER MOTH', 'SWARM', 'sky', '#3A1A14', '#FF5A1F', '#FF2D55', 'cinder wings shedding sparks'], ['LAVA WYRM', 'WYRM', 'burrow', '#2A1A18', '#5E2A22', '#FF8A3D', 'magma-veined chitin'], ['MAGMA STRIDER', 'TITAN', 'ground', '#1E1C1E', '#5E2A22', '#FF5A1F', 'magma-hide strider']],
  ambience: { beds: ['lava-roar', 'ash-wind', 'vent-hiss'], music: { key: 'E minor', tempo: 112, mood: 'furnace' } },
  lighting: { key: '#FF7A3A', keyIntensity: 2.4, fillSky: '#4A2018', fillGround: '#FF5A1F', fillIntensity: 0.8, rim: '#FFB070', rimIntensity: 1.5 },
  landmarks: [['Mount Pyrr', 'volcano', 'erupting volcano plume on the horizon'], ['Lava falls', 'waterfall', 'lava pouring off a basalt shelf']],
  planet: { seed: 2202, ocean: '#2A1A18', land: ['#1E1C1E', '#4A4442', '#C2301A'], ice: 0, clouds: { coverage: 0.5, color: '#3A2A26' }, cityLights: 0, lava: 0.5, atmosphere: '#FF7A3A' },
});

export const HALDERN = world({
  id: 'haldern', number: 4, name: 'HALDERN', region: 'THE BLUE REACH', climate: ['GLACIAL', 'ICE CANYONS', 'AURORA'], levels: [13, 16],
  terrain: { floorHalfWidth: [110, 220], gorgeHalfWidth: [50, 80], wallHeight: [300, 700], meander: { amplitude: 110, wavelength: 1700 }, ridges: { amplitude: 560, wavelength: 2600, octaves: 6, warp: 0.3 }, peaks: { height: [1000, 1500], distance: [2500, 6000], snowLine: 200 }, erosion: 0.3, cliffs: { sharpen: 0.8, screeApron: 20 }, relief: [700, 1300],
    modifiers: [{ kind: 'iceU', profile: 0.9, crevasses: 0.6 }], surfaces: [['blue-ice', '#7FB8D8'], ['snow', '#EEF4F8'], ['rock', '#4A505A'], ['frozen-river', '#A8D4E8']], infestation: { color: '#1E2A3E', vein: '#7B5BFF' } },
  sky: { zenith: '#0E1A30', mid: '#24406A', horizon: '#8FB8D8', suns: [{ name: 'PALE SUN', elevation: 8, azimuth: 60, color: '#E8F0FF', discDeg: 0.7, glow: 0.6, intensity: 1.8 }], haze: '#A8C8E0', groundBounce: '#C8E0F0', stars: { density: 0.5, milkyWay: 0.4 },
    bodies: [{ id: 'haldern-shard', name: 'SKARN', kind: 'shatteredMoon', angularDeg: 9, elevation: 28, azimuth: -60, palette: ['#C8CCD4', '#8A909C', '#5A606C'], surface: 'rocky', rings: { inner: 1.2, outer: 2.4, tilt: 30, color: '#B8BCC4', opacity: 0.5 }, rotation: 0.1 }],
    clouds: [{ kind: 'cirrus', coverage: 0.3, altitude: 5000, color: '#DCE8F4', shadow: 0 }], aurora: { colors: ['#4DFFB0', '#7FD1FF', '#7B5BFF'], intensity: 0.8 } },
  atmosphere: { hazeNear: '#A8C8E0', hazeFar: '#5E7EA8', density: 0.0005, heightFalloff: 0.0012, inscatter: { color: '#E8F0FF', strength: 0.4 }, emergeAt: 300, grade: { exposure: 1.02, contrast: 1.05, saturation: 0.9, shadowTint: '#1E3050', highlightTint: '#F0F8FF', split: 0.15 } },
  water: { kind: 'frozen', shallow: '#A8D4E8', deep: '#5E9ABE', foam: '#F0F8FF', flowSpeed: 0, waves: { amplitude: 0, wavelength: 1, choppiness: 0 }, waterfalls: 2 },
  flora: [['haldern-fir', 'Snow fir', 'conifer', '#2E2A26', '#2A4A44', '#E8F0F4'], ['haldern-spruce', 'Rime spruce', 'conifer', '#2A2622', '#24403C', '#DCE8EC'], ['haldern-scrub', 'Frost scrub', 'bush', '#3A3432', '#5A6E6A']],
  cover: [['snowTufts', '#DCE8EE']], rocks: { base: '#4A505A', strata: '#6A707A', varnish: '#2A2E36', variants: 8, scatter: 0.4, heroes: ['ice-arch', 'crevasse-bridge', 'frozen-falls'] },
  life: [['Snow geese', 'flock', 'scatter', '#E8ECF0'], ['Tusked grazers', 'herd', 'stampede', '#6A5E52']], weather: { base: 'blizzard', intensity: 0.5, wind: 0.6, gusts: 0.4, precipitation: { kind: 'snow', density: 0.6 }, events: ['blizzard-band', 'avalanche', 'aurora'] },
  strains: [['FROST WISP', 'SWARM', 'sky', '#C8E0F0', '#4B2A9E', '#7FD1FF', 'frost-rimed wisps'], ['GLACIER WYRM', 'WYRM', 'burrow', '#5E7EA8', '#2A2A4E', '#7B5BFF', 'ice-plated chitin'], ['ICE COLOSSUS', 'TITAN', 'ridge', '#8AA0B8', '#2A2A4E', '#7B5BFF', 'ice-hide colossus']],
  ambience: { beds: ['wind-ice', 'creak', 'blizzard'], music: { key: 'F# minor', tempo: 96, mood: 'cold vastness' } },
  lighting: { key: '#E8F0FF', keyIntensity: 2, fillSky: '#5E7EA8', fillGround: '#C8E0F0', fillIntensity: 0.8, rim: '#7FD1FF', rimIntensity: 1.2 },
  landmarks: [['Shattered moon debris', 'mountain', 'the ring of SKARN fragments'], ['Frozen falls', 'waterfall', 'a waterfall frozen mid-fall']],
  planet: { seed: 4404, ocean: '#2E4E6E', land: ['#EEF4F8', '#7FB8D8', '#4A505A'], ice: 0.85, clouds: { coverage: 0.4, color: '#F0F4F8' }, cityLights: 0.02, atmosphere: '#BFE0FF' },
});

export const SPOREFALL = world({
  id: 'sporefall', number: 5, name: 'SPOREFALL', region: 'THE LUMEN CANOPY', climate: ['RAINFOREST', 'BIOLUMINESCENT', 'TWILIGHT'], levels: [17, 20],
  terrain: { floorHalfWidth: [90, 180], gorgeHalfWidth: [45, 70], wallHeight: [200, 450], meander: { amplitude: 120, wavelength: 1200 }, ridges: { amplitude: 400, wavelength: 2000, octaves: 6, warp: 0.5 }, peaks: { height: [600, 900], distance: [2000, 5000] }, erosion: 0.6, cliffs: { sharpen: 0.5, screeApron: 15 }, relief: [500, 900],
    modifiers: [{ kind: 'terraces', step: 12, smooth: 0.8 }], surfaces: [['loam', '#2A2030'], ['moss', '#2E4A3A'], ['glow-moss', '#3AE0B0'], ['root-mat', '#3A2A22']], infestation: { color: '#2A1030', vein: '#FF2D55' } },
  sky: { zenith: '#1A0E2E', mid: '#3A2060', horizon: '#9A5AB8', suns: [{ name: 'DUSKSTAR', elevation: 3, azimuth: 250, color: '#FFB0D0', discDeg: 0.8, glow: 0.8, intensity: 1.2 }], haze: '#5A3A7A', groundBounce: '#3AE0B0', stars: { density: 0.4, milkyWay: 0.3 },
    bodies: [{ id: 'sporefall-giant', name: 'MOTHERLIGHT', kind: 'planet', angularDeg: 26, elevation: 24, azimuth: 90, palette: ['#C88AE0', '#6A3A9A', '#2A1A4A'], surface: 'cloudy', atmosphere: { color: '#E0B0FF', thickness: 0.06 }, rotation: 0.2 }],
    clouds: [{ kind: 'mist', coverage: 0.6, altitude: 150, color: '#8A6AB0', shadow: 0.2 }] },
  atmosphere: { hazeNear: '#5A3A7A', hazeFar: '#2A1A4A', density: 0.0009, heightFalloff: 0.002, inscatter: { color: '#FFB0D0', strength: 0.4 }, emergeAt: 240, grade: { exposure: 1, contrast: 1.08, saturation: 1.2, shadowTint: '#1A0E2E', highlightTint: '#B0FFE0', split: 0.3 } },
  water: { kind: 'river', shallow: '#2A6A6A', deep: '#1A3A4A', foam: '#B0FFE0', flowSpeed: 1.2, waves: { amplitude: 0.1, wavelength: 5, choppiness: 0.2 }, waterfalls: 4, emissive: 0.6 },
  flora: [['sporefall-buttress', 'Buttress giant', 'buttress', '#3A2A22', '#2E4A3A', '#3AE0B0'], ['sporefall-vine', 'Vine curtain', 'broadleaf', '#2A2A22', '#2A5A3E', '#4DFFB0'], ['sporefall-fungus', 'Lantern fungus', 'fungus', '#4A3A5A', '#C88AE0', '#3AE0B0'], ['sporefall-fern', 'Glow fern', 'fern', '#2A3A2A', '#2E6A4A', '#4DFFB0']],
  cover: [['glowMoss', '#3AE0B0'], ['moss', '#2E4A3A']], rocks: { base: '#3A3044', strata: '#4A3E54', varnish: '#2A2230', variants: 6, scatter: 0.3, heroes: ['canopy-tunnel', 'mist-falls', 'root-arch'] },
  life: [['Fireflies', 'motes', 'ignore', '#E0FF8A'], ['Glider monkeys', 'flock', 'scatter', '#4A3A2E']], weather: { base: 'spores', intensity: 0.5, wind: 0.1, gusts: 0.05, precipitation: { kind: 'spores', density: 0.5 }, events: ['spore-bloom', 'mist-falls'] },
  strains: [['GLOWFLY SWARM', 'SWARM', 'sky', '#2A3A2A', '#4B2A9E', '#4DFFB0', 'bioluminescent swarm'], ['VINE-STALKER', 'TENDRILLER', 'ground', '#2A3A22', '#5B2A6E', '#FF2D55', 'vine-wrapped stalker']],
  ambience: { beds: ['jungle-night', 'drip', 'chorus'], music: { key: 'B lydian', tempo: 88, mood: 'eerie wonder' } },
  lighting: { key: '#FFB0D0', keyIntensity: 1.2, fillSky: '#5A3A7A', fillGround: '#3AE0B0', fillIntensity: 0.9, rim: '#4DFFB0', rimIntensity: 1.4 },
  landmarks: [['Motherlight rising', 'mountain', 'giant half-lit planet over the canopy'], ['The Spore Throne', 'spire', 'boss L20 nest tree']],
  planet: { seed: 5505, ocean: '#1A3A4A', land: ['#2E4A3A', '#3AE0B0', '#2A2030'], ice: 0.05, clouds: { coverage: 0.7, color: '#C8B0E0' }, cityLights: 0, atmosphere: '#C88AE0' },
});

export const OSSUARY = world({
  id: 'ossuary', number: 7, name: 'OSSUARY', region: 'THE DROWNED ARCOLOGIES', climate: ['DEAD MEGACITY', 'RAIN', 'NEON RUIN'], levels: [26, 29],
  terrain: { floorHalfWidth: [90, 170], gorgeHalfWidth: [45, 70], wallHeight: [300, 800], meander: { amplitude: 60, wavelength: 1600 }, ridges: { amplitude: 500, wavelength: 1800, octaves: 4, warp: 0.1 }, peaks: { height: [900, 1500], distance: [2000, 5000] }, erosion: 0.2, cliffs: { sharpen: 1, screeApron: 10 }, relief: [700, 1500],
    modifiers: [{ kind: 'terraces', step: 40, smooth: 0.05 }], surfaces: [['concrete', '#4A4C52'], ['rust', '#6A3A2A'], ['wet-asphalt', '#22242A'], ['algae', '#2E4A3A']], infestation: { color: '#2A1A2A', vein: '#FF2D55' } },
  sky: { zenith: '#101218', mid: '#22262E', horizon: '#4A5A6A', suns: [{ name: 'SMOG SUN', elevation: 6, azimuth: 100, color: '#C8B8A0', discDeg: 0.8, glow: 0.3, intensity: 1 }], haze: '#3A4450', groundBounce: '#22242A', stars: { density: 0, milkyWay: 0 },
    bodies: [moon('ossuary-m', 'GRAVE', 6, 32, -100, ['#8A8C92', '#5A5C62', '#FF2D55'])], clouds: [{ kind: 'storm', coverage: 0.8, altitude: 1000, color: '#2A2E36', shadow: 0.4 }] },
  atmosphere: { hazeNear: '#3A4450', hazeFar: '#22262E', density: 0.0009, heightFalloff: 0.001, inscatter: { color: '#C8B8A0', strength: 0.2 }, emergeAt: 250, grade: { exposure: 0.95, contrast: 1.15, saturation: 0.8, shadowTint: '#101828', highlightTint: '#FFB0C8', split: 0.3 } },
  water: { kind: 'canal', shallow: '#2A3A3E', deep: '#1A2228', foam: '#A8B4BC', flowSpeed: 0.3, waves: { amplitude: 0.1, wavelength: 5, choppiness: 0.2 }, waterfalls: 4 },
  flora: [['ossuary-weed', 'Rebar weed', 'bush', '#3A3432', '#2E4A3A'], ['ossuary-dead', 'Dead street tree', 'deadTree', '#2A2624', '#2A2624']],
  cover: [['moss', '#2E4A3A']], rocks: { base: '#4A4C52', strata: '#5A5C62', varnish: '#22242A', variants: 6, scatter: 0.6, heroes: ['arcology-tower', 'skybridge', 'neon-sign'] },
  life: [['Carrion swarms', 'flock', 'scatter', '#1A1A1E'], ['Rain motes', 'motes', 'ignore', '#A8B4BC']], weather: { base: 'rain', intensity: 0.7, wind: 0.3, gusts: 0.2, precipitation: { kind: 'rain', density: 0.7 }, events: ['neon-flicker', 'tower-collapse'] },
  strains: [['CARRION SWARM', 'SWARM', 'sky', '#1A1A1E', '#5B2A6E', '#FF2D55', 'scrap-feathered swarm'], ['STEEL-HIDE WYRM', 'WYRM', 'burrow', '#3A3C42', '#2A1A2A', '#FF2D55', 'plated in salvaged steel']],
  ambience: { beds: ['rain-city', 'groan', 'neon-buzz'], music: { key: 'D minor', tempo: 120, mood: 'industrial grief' } },
  lighting: { key: '#C8B8A0', keyIntensity: 1.2, fillSky: '#22262E', fillGround: '#22242A', fillIntensity: 0.7, rim: '#FF2D55', rimIntensity: 1 },
  landmarks: [['The Ossuary spire', 'city', 'tallest dead arcology'], ['Neon remnant', 'city', 'a flickering colony sign']],
  planet: { seed: 7707, ocean: '#1A2228', land: ['#4A4C52', '#22242A', '#6A3A2A'], ice: 0.1, clouds: { coverage: 0.75, color: '#5A5E66' }, cityLights: 0.6, atmosphere: '#8A9AAA' },
});

export const AURELIA = world({
  id: 'aurelia', number: 8, name: 'AURELIA', region: 'THE HIGH ARCHIPELAGO', climate: ['SKY ISLANDS', 'CLOUD SEA', 'GOLDEN'], levels: [30, 33],
  terrain: { floorHalfWidth: [150, 300], gorgeHalfWidth: [60, 90], wallHeight: [200, 500], meander: { amplitude: 150, wavelength: 1600 }, ridges: { amplitude: 300, wavelength: 2200, octaves: 5, warp: 0.4 }, peaks: { height: [600, 1000], distance: [2000, 6000] }, erosion: 0.5, cliffs: { sharpen: 0.85, screeApron: 10 }, relief: [500, 1000],
    modifiers: [{ kind: 'floatingIslands', density: 0.4, size: [80, 400] }], surfaces: [['gold-grass', '#C8A848'], ['rock', '#A8907A'], ['moss', '#6A8A4A']], infestation: { color: '#3A2A1E', vein: '#7B5BFF' } },
  sky: { zenith: '#3A6AB0', mid: '#8AB0E0', horizon: '#FFE0A0', suns: [{ name: 'AUREL', elevation: 30, azimuth: 40, color: '#FFE8B0', discDeg: 1, glow: 1.2, intensity: 3.6 }], haze: '#F0D8A8', groundBounce: '#FFF0D0', stars: { density: 0, milkyWay: 0 },
    bodies: [moon('aurelia-m1', 'CORA', 7, 40, -80, ['#F0E8D8', '#C8B8A0', '#A89880']), moon('aurelia-m2', 'PIM', 3, 20, -110, ['#D8E8F0', '#A8B8C8', '#8898A8'])], clouds: [{ kind: 'cumulus', coverage: 0.5, altitude: 900, color: '#FFF8E8', shadow: 0.3 }, { kind: 'sea', coverage: 1, altitude: -300, color: '#FFF0D8', shadow: 0 }] },
  atmosphere: { hazeNear: '#F0D8A8', hazeFar: '#A8C0E0', density: 0.0003, heightFalloff: 0.0008, inscatter: { color: '#FFE8B0', strength: 0.7 }, emergeAt: 320, grade: { exposure: 1.08, contrast: 1.02, saturation: 1.1, shadowTint: '#4A5A8A', highlightTint: '#FFF0C8', split: 0.15 } },
  water: { kind: 'river', shallow: '#6AB0C8', deep: '#3A8AA8', foam: '#FFFFFF', flowSpeed: 2.5, waves: { amplitude: 0.1, wavelength: 5, choppiness: 0.2 }, waterfalls: 8 },
  flora: [['aurelia-cloudpine', 'Cloud pine', 'conifer', '#5A4030', '#4A7A4A'], ['aurelia-goldleaf', 'Goldleaf', 'broadleaf', '#6A5040', '#C8A848', '#E8C860']],
  cover: [['grass', '#C8A848'], ['flowers', '#F0E0A0']], rocks: { base: '#A8907A', strata: '#C8B098', variants: 6, varnish: '#6A5A4A', scatter: 0.4, heroes: ['island-falls', 'chain-bridge'] },
  life: [['Sky whales', 'whale', 'ignore', '#8A9AB8'], ['Gold finches', 'flock', 'scatter', '#E8C860']], weather: { base: 'clear', intensity: 0.2, wind: 0.5, gusts: 0.2, events: ['cloud-sea-surge'] },
  strains: [['GILDED REAVER', 'REAVER', 'sky', '#3A3020', '#4B2A9E', '#7B5BFF', 'gold-leaf corrosion'], ['SKY LEVIATHAN', 'TITAN', 'sky', '#4A4A5A', '#2A1A3A', '#7B5BFF', 'turned sky whale (boss L30)']],
  ambience: { beds: ['high-wind', 'falls', 'whale-song'], music: { key: 'G major', tempo: 100, mood: 'soaring' } },
  lighting: { key: '#FFE8B0', keyIntensity: 3.6, fillSky: '#8AB0E0', fillGround: '#FFF0D0', fillIntensity: 0.6, rim: '#FFF0C8', rimIntensity: 1.2 },
  landmarks: [['The Hanging Isle', 'waterfall', 'island pouring into the cloud sea'], ['Leviathan roost', 'spire', 'boss L30 lair']],
  planet: { seed: 8808, ocean: '#FFF0D8', land: ['#C8A848', '#A8907A'], ice: 0.1, clouds: { coverage: 0.9, color: '#FFFFFF' }, cityLights: 0, atmosphere: '#FFE0A0' },
});

export const GLASSFIELD = world({
  id: 'glassfield', number: 9, name: 'GLASSFIELD', region: 'THE PRISM WASTES', climate: ['CRYSTAL DESERT', 'REFRACTION', 'HALO SKY'], levels: [34, 37],
  terrain: { floorHalfWidth: [120, 220], gorgeHalfWidth: [50, 80], wallHeight: [250, 600], meander: { amplitude: 100, wavelength: 1500 }, ridges: { amplitude: 400, wavelength: 2400, octaves: 5, warp: 0.3 }, peaks: { height: [700, 1100], distance: [2000, 6000] }, erosion: 0.2, cliffs: { sharpen: 0.95, screeApron: 30 }, relief: [600, 1100],
    modifiers: [{ kind: 'crystalShards', density: 0.5, height: [20, 160] }, { kind: 'dunes', wavelength: 50, height: 6, coverage: 0.4 }], surfaces: [['white-sand', '#E8E4DC'], ['glass', '#A8D8E8'], ['quartz', '#D8C8F0']], infestation: { color: '#2A1A3A', vein: '#FF2D55' } },
  sky: { zenith: '#3A5A9A', mid: '#7AA0D8', horizon: '#E8F0FF', suns: [{ name: 'PRISM', elevation: 40, azimuth: 0, color: '#FFFFFF', discDeg: 0.8, glow: 1.5, intensity: 3.8 }], haze: '#E0E8F8', groundBounce: '#E8E4DC', stars: { density: 0, milkyWay: 0 },
    bodies: [moon('glass-m', 'FACET', 5, 30, 120, ['#E8E8F8', '#B8B8D8', '#8888B8'], 'icyCracked')], clouds: [{ kind: 'cirrus', coverage: 0.4, altitude: 7000, color: '#FFFFFF', shadow: 0 }] },
  atmosphere: { hazeNear: '#E0E8F8', hazeFar: '#A0B8E0', density: 0.0003, heightFalloff: 0.001, inscatter: { color: '#FFFFFF', strength: 0.6 }, emergeAt: 320, grade: { exposure: 1, contrast: 1.05, saturation: 1.05, shadowTint: '#3A4A8A', highlightTint: '#FFF8F0', split: 0.12 } },
  water: { kind: 'none', shallow: '#A8D8E8', deep: '#6AA8C8', foam: '#FFFFFF', flowSpeed: 0, waves: { amplitude: 0, wavelength: 1, choppiness: 0 }, waterfalls: 0 },
  flora: [['glass-cactus', 'Glass cactus', 'crystal', '#A8D8E8', '#D8C8F0'], ['glass-shrub', 'Prism shrub', 'crystal', '#C8E8F0', '#E8D8FF']],
  cover: [['tufts', '#C8C0B0']], rocks: { base: '#E8E4DC', strata: '#D8D0C8', varnish: '#A8A0B8', variants: 6, scatter: 0.5, heroes: ['prism-spire', 'mirror-canyon'] },
  life: [['Glint motes', 'motes', 'ignore', '#FFFFFF'], ['Mirror lizards', 'beetles', 'stampede', '#C8D8E8']], weather: { base: 'clear', intensity: 0.3, wind: 0.4, gusts: 0.2, events: ['refraction-flare', 'glass-storm'] },
  strains: [['CRYSTAL SWARM', 'SWARM', 'sky', '#A8D8E8', '#4B2A9E', '#FF2D55', 'glass-winged swarm'], ['SHARD WYRM', 'WYRM', 'burrow', '#D8C8F0', '#2A1A3A', '#FF2D55', 'crystal-spined']],
  ambience: { beds: ['glass-chime', 'wind-hiss'], music: { key: 'E lydian', tempo: 108, mood: 'brilliant unease' } },
  lighting: { key: '#FFFFFF', keyIntensity: 3.8, fillSky: '#7AA0D8', fillGround: '#E8E4DC', fillIntensity: 0.7, rim: '#D8C8F0', rimIntensity: 1.3 },
  landmarks: [['The Halo', 'mountain', '22-degree halo around the sun'], ['Prism spire', 'spire', 'crystal mountain splitting light']],
  planet: { seed: 9909, ocean: '#A8C8E8', land: ['#E8E4DC', '#D8C8F0'], ice: 0.1, clouds: { coverage: 0.2, color: '#FFFFFF' }, cityLights: 0, atmosphere: '#E8F0FF' },
});

export const VANTA = world({
  id: 'vanta', number: 10, name: 'VANTA', region: 'THE TERMINATOR', climate: ['TIDALLY LOCKED', 'TWILIGHT', 'BIOLUMINESCENT DARK'], levels: [38, 41],
  terrain: { floorHalfWidth: [120, 240], gorgeHalfWidth: [50, 80], wallHeight: [300, 700], meander: { amplitude: 120, wavelength: 1800 }, ridges: { amplitude: 500, wavelength: 2600, octaves: 6, warp: 0.35 }, peaks: { height: [900, 1300], distance: [2500, 6000] }, erosion: 0.5, cliffs: { sharpen: 0.8, screeApron: 30 }, relief: [700, 1300],
    modifiers: [{ kind: 'strata', bands: 10, sharpness: 0.6, tilt: 0.1 }], surfaces: [['dark-rock', '#22222A'], ['frost', '#8A9AB8'], ['biolum-moss', '#3A6AE0']], infestation: { color: '#1A1030', vein: '#FF2D55' } },
  sky: { zenith: '#06060E', mid: '#1A1A3A', horizon: '#C87A4A', suns: [{ name: 'LOW SUN', elevation: 1, azimuth: 270, color: '#FF9A5A', discDeg: 1.5, glow: 1.5, intensity: 1.6 }], haze: '#2A2A4A', groundBounce: '#3A6AE0', stars: { density: 1, milkyWay: 0.8 },
    bodies: [{ id: 'vanta-giant', name: 'THE WATCHER', kind: 'planet', angularDeg: 40, elevation: 25, azimuth: 90, palette: ['#4A5A8A', '#2A3A6A', '#1A1A3A'], surface: 'banded', atmosphere: { color: '#7A9AE0', thickness: 0.04 }, rotation: 0.1 }], clouds: [{ kind: 'mist', coverage: 0.3, altitude: 100, color: '#3A4A7A', shadow: 0 }] },
  atmosphere: { hazeNear: '#2A2A4A', hazeFar: '#10102A', density: 0.0006, heightFalloff: 0.0015, inscatter: { color: '#FF9A5A', strength: 0.6 }, emergeAt: 260, grade: { exposure: 0.95, contrast: 1.12, saturation: 1.05, shadowTint: '#0A0A2A', highlightTint: '#FFB080', split: 0.35 } },
  water: { kind: 'river', shallow: '#2A3A6A', deep: '#10183A', foam: '#7FD1FF', flowSpeed: 1, waves: { amplitude: 0.1, wavelength: 5, choppiness: 0.2 }, waterfalls: 2, emissive: 0.5 },
  flora: [['vanta-lampwood', 'Lampwood', 'broadleaf', '#2A2A3A', '#3A6AE0', '#7FD1FF'], ['vanta-frostpine', 'Frost pine', 'conifer', '#2A2630', '#3A4A6A']],
  cover: [['glowMoss', '#3A6AE0']], rocks: { base: '#22222A', strata: '#32323C', varnish: '#14141A', variants: 6, scatter: 0.5, heroes: ['terminator-arch', 'glow-falls'] },
  life: [['Lantern moths', 'motes', 'ignore', '#7FD1FF'], ['Night herds', 'herd', 'stampede', '#3A3A4A']], weather: { base: 'clear', intensity: 0.2, wind: 0.3, gusts: 0.1, events: ['terminator-line', 'biolum-wave'] },
  strains: [['DARKWING', 'REAVER', 'sky', '#14141A', '#4B2A9E', '#FF2D55', 'light-absorbing hull'], ['THE WATCHER\'S EYE', 'TITAN', 'sky', '#1A1A2A', '#4B2A9E', '#FF2D55', 'boss L40']],
  ambience: { beds: ['night-wind', 'glow-hum'], music: { key: 'C# minor', tempo: 92, mood: 'held breath' } },
  lighting: { key: '#FF9A5A', keyIntensity: 1.6, fillSky: '#1A1A3A', fillGround: '#3A6AE0', fillIntensity: 0.9, rim: '#7FD1FF', rimIntensity: 1.5 },
  landmarks: [['The Watcher', 'mountain', 'giant planet filling half the sky'], ['The Line', 'mountain', 'the day-night terminator across the valley']],
  planet: { seed: 10010, ocean: '#10183A', land: ['#22222A', '#C87A4A'], ice: 0.4, clouds: { coverage: 0.3, color: '#8A9AB8' }, cityLights: 0.05, atmosphere: '#FF9A5A' },
});

export const MAW = world({
  id: 'maw', number: 11, name: 'MAW', region: 'THE GULLET', climate: ['CORRUPTED', 'FLESH', 'SPORE CLOUDS'], levels: [42, 45],
  terrain: { floorHalfWidth: [90, 180], gorgeHalfWidth: [40, 65], wallHeight: [250, 600], meander: { amplitude: 140, wavelength: 1200 }, ridges: { amplitude: 400, wavelength: 1800, octaves: 5, warp: 0.6 }, peaks: { height: [700, 1100], distance: [2000, 5000] }, erosion: 0.3, cliffs: { sharpen: 0.4, screeApron: 10 }, relief: [600, 1100],
    modifiers: [{ kind: 'fleshRibs', spacing: 120, height: [60, 220] }], surfaces: [['tissue', '#5A2030'], ['sinew', '#8A3A4A'], ['bone', '#D8C8B0'], ['vein', '#3A0A2A']], infestation: { color: '#3A0A2A', vein: '#FF2D55' } },
  sky: { zenith: '#1A0610', mid: '#4A1020', horizon: '#9A3A4A', suns: [{ name: 'BLOOD SUN', elevation: 12, azimuth: 0, color: '#FF4A5A', discDeg: 2, glow: 1.5, intensity: 1.8 }], haze: '#5A1A2A', groundBounce: '#8A3A4A', stars: { density: 0, milkyWay: 0 },
    bodies: [moon('maw-m', 'CYST', 8, 30, 140, ['#8A5A6A', '#5A2A3A', '#FF2D55'], 'rocky')], clouds: [{ kind: 'mist', coverage: 0.6, altitude: 200, color: '#6A2A3A', shadow: 0.2 }] },
  atmosphere: { hazeNear: '#5A1A2A', hazeFar: '#2A0A14', density: 0.0009, heightFalloff: 0.0015, inscatter: { color: '#FF4A5A', strength: 0.5 }, emergeAt: 240, grade: { exposure: 0.98, contrast: 1.15, saturation: 1.1, shadowTint: '#1A0610', highlightTint: '#FFB0B0', split: 0.3 } },
  water: { kind: 'river', shallow: '#6A1A2A', deep: '#3A0A14', foam: '#C88A8A', flowSpeed: 1, waves: { amplitude: 0.2, wavelength: 6, choppiness: 0.3 }, waterfalls: 2, emissive: 0.4 },
  flora: [['maw-polyp', 'Polyp stalk', 'fungus', '#5A2030', '#8A3A4A', '#FF2D55'], ['maw-coral', 'Bone coral', 'deadTree', '#D8C8B0', '#D8C8B0']],
  cover: [['moss', '#6A2A3A']], rocks: { base: '#5A2030', strata: '#8A3A4A', varnish: '#3A0A2A', variants: 6, scatter: 0.5, heroes: ['rib-arch', 'heart-chamber'] },
  life: [['Spore puffs', 'motes', 'ignore', '#C88A8A'], ['Parasite flocks', 'flock', 'scatter', '#3A0A14']], weather: { base: 'spores', intensity: 0.7, wind: 0.2, gusts: 0.3, precipitation: { kind: 'spores', density: 0.7 }, events: ['pulse-quake', 'spore-burst'] },
  strains: [['FLESH REAVER', 'REAVER', 'sky', '#5A2030', '#3A0A2A', '#FF2D55', 'grown, not built'], ['GULLET WYRM', 'WYRM', 'burrow', '#8A3A4A', '#3A0A2A', '#FF2D55', 'peristaltic lunge']],
  ambience: { beds: ['heartbeat', 'wet-wind', 'whispers'], music: { key: 'Bb locrian', tempo: 126, mood: 'revulsion' } },
  lighting: { key: '#FF4A5A', keyIntensity: 1.8, fillSky: '#4A1020', fillGround: '#8A3A4A', fillIntensity: 0.8, rim: '#FFB0B0', rimIntensity: 1.2 },
  landmarks: [['The Heart', 'spire', 'a pulsing mountain of tissue'], ['Rib canyon', 'arch', 'ribs arching over the valley']],
  planet: { seed: 11011, ocean: '#3A0A14', land: ['#5A2030', '#8A3A4A', '#D8C8B0'], ice: 0, clouds: { coverage: 0.5, color: '#8A4A5A' }, cityLights: 0, atmosphere: '#FF4A5A' },
});

export const HOLLOW_CROWN = world({
  id: 'hollow-crown', number: 12, name: 'THE HOLLOW CROWN', region: 'THE SHATTER', climate: ['SHATTERED WORLD', 'BLACK SUN', 'INVERTED GRAVITY'], levels: [46, 50],
  terrain: { floorHalfWidth: [120, 240], gorgeHalfWidth: [50, 80], wallHeight: [300, 800], meander: { amplitude: 160, wavelength: 1500 }, ridges: { amplitude: 600, wavelength: 2200, octaves: 6, warp: 0.6 }, peaks: { height: [900, 1500], distance: [2000, 6000] }, erosion: 0.4, cliffs: { sharpen: 0.9, screeApron: 10 }, relief: [700, 1500],
    modifiers: [{ kind: 'floatingIslands', density: 0.6, size: [60, 600] }, { kind: 'strata', bands: 12, sharpness: 0.7, tilt: 0.6 }], surfaces: [['void-rock', '#1A1622'], ['ash-glass', '#3A3048'], ['veil-scar', '#4B2A9E']], infestation: { color: '#1A0A2A', vein: '#FF2D55' } },
  sky: { zenith: '#04030A', mid: '#120A24', horizon: '#4B2A9E', suns: [{ name: 'THE BLACK SUN', elevation: 25, azimuth: 0, color: '#7B5BFF', discDeg: 6, glow: 2, intensity: 1.4 }], haze: '#1A0E30', groundBounce: '#4B2A9E', stars: { density: 1, milkyWay: 1 },
    bodies: [{ id: 'black-sun', name: 'THE CROWN', kind: 'blackSun', angularDeg: 14, elevation: 25, azimuth: 0, palette: ['#000000', '#4B2A9E', '#FF2D55'], surface: 'void', atmosphere: { color: '#7B5BFF', thickness: 0.2 }, rings: { inner: 1.2, outer: 3, tilt: 8, color: '#7B5BFF', opacity: 0.6 }, rotation: 1 }], clouds: [{ kind: 'mist', coverage: 0.3, altitude: 300, color: '#2A1A4A', shadow: 0.1 }] },
  atmosphere: { hazeNear: '#1A0E30', hazeFar: '#08040F', density: 0.0005, heightFalloff: 0.0008, inscatter: { color: '#7B5BFF', strength: 0.8 }, emergeAt: 280, grade: { exposure: 0.95, contrast: 1.2, saturation: 1.1, shadowTint: '#04030A', highlightTint: '#C8B0FF', split: 0.35 } },
  water: { kind: 'none', shallow: '#4B2A9E', deep: '#1A0E30', foam: '#C8B0FF', flowSpeed: 0, waves: { amplitude: 0, wavelength: 1, choppiness: 0 }, waterfalls: 3, emissive: 1 },
  flora: [['crown-thorn', 'Void thorn', 'deadTree', '#1A1622', '#3A3048'], ['crown-crystal', 'Veil crystal', 'crystal', '#4B2A9E', '#7B5BFF']],
  cover: [['tufts', '#2A2236']], rocks: { base: '#1A1622', strata: '#2A2236', varnish: '#0A0810', variants: 8, scatter: 0.6, heroes: ['upside-down-valley', 'veil-source', 'fragment-bridge'] },
  life: [['Veil motes', 'motes', 'ignore', '#7B5BFF'], ['Echo flocks', 'flock', 'scatter', '#C8B0FF']], weather: { base: 'storm', intensity: 0.6, wind: 0.5, gusts: 0.5, lightning: { rate: 0.1, thunderDelay: [0.3, 1.5] }, events: ['gravity-rupture', 'fragment-fall', 'veil-surge'] },
  strains: [['ECHO OF HALCYON', 'REAVER', 'sky', '#1A1622', '#4B2A9E', '#FF2D55', 'wearing the Halcyon wing\'s colours'], ['THE HOLLOW KING', 'TITAN', 'sky', '#04030A', '#4B2A9E', '#FF2D55', 'final boss L50']],
  ambience: { beds: ['void-drone', 'whispers', 'fragment-grind'], music: { key: 'atonal over C', tempo: 132, mood: 'the end of the line' } },
  lighting: { key: '#7B5BFF', keyIntensity: 1.4, fillSky: '#120A24', fillGround: '#4B2A9E', fillIntensity: 0.9, rim: '#FF2D55', rimIntensity: 1.6 },
  landmarks: [['The Black Sun', 'mountain', 'the Veil source'], ['The Shatter', 'mountain', 'continents floating in pieces']],
  planet: { seed: 12012, ocean: '#08040F', land: ['#1A1622', '#4B2A9E'], ice: 0, clouds: { coverage: 0.2, color: '#4B2A9E' }, cityLights: 0, atmosphere: '#7B5BFF' },
});
