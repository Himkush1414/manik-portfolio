// Terrain material (Phase 2R §5 MATERIAL), colour pass: MeshStandardMaterial
// extended through onBeforeCompile so it keeps the fixed light rig + fog.
// Surface layers are blended per fragment from slope (world normal), the
// worker's attributes (rock exposure, moisture, wet, wall), altitude above
// the valley floor and world-space macro noise — no tiling texture yet (CC0
// detail layers arrive with the rock kit in W3). Every colour / threshold is
// a uniform, so world changes never recompile. World-space noise needs true
// world positions: the mission scene is the path frame around the player, so
// world = P0 + B (scene - missionOrigin) with the shared missionSpace uniforms.
import { Color, MeshStandardMaterial, Vector3, Vector4 } from 'three';
import { missionSpace } from './missionSpace';
import { AP_GLSL, AP_UNIFORMS } from './atmosphere';
import { CLOUD_SHADOW_GLSL, CLOUD_SHADOW_UNIFORMS } from './clouds';
import { MISSION_ORIGIN } from '../../scenes/sceneBridge';
import { MORPH_LOD_PACK } from '../../game/world/tiles';
import type { WorldDef } from '../../data/worlds/types';

export type TerrainUniforms = ReturnType<typeof createUniforms>;

function createUniforms(w: WorldDef) {
  const surf = (id: string, fallback: string) => new Color(w.terrain.surfaces.find(s => s.id === id)?.color ?? fallback);
  return {
    uPathP0: missionSpace.uniforms.uPathP0,
    uPathB: missionSpace.uniforms.uPathB,
    uMissionO: { value: new Vector3(...MISSION_ORIGIN) },
    uGrass: { value: surf('grass', '#4F7A3A') },
    uMeadow: { value: surf('meadow', '#8C9A45') },
    uSoil: { value: surf('soil', '#6B5238') },
    uRock: { value: new Color(w.rocks.base) },
    uStrata: { value: new Color(w.rocks.strata) },
    uScree: { value: surf('scree', w.rocks.strata) },
    uSnow: { value: surf('snow', '#EEF2F6') },
    uWetTint: { value: new Color(w.water.deep) },
    uSnowLine: { value: w.terrain.peaks.snowLine ?? 99999 },
    uStrataBand: { value: 14 },
    /** geomorph: the viewer's path distance + the LOD0->1 / LOD1->2 blend ranges (start, end; u along s) */
    uViewS: { value: 0 },
    uMorph: { value: new Vector4(40, 86, 476, 636) },
  };
}

export function createTerrainMaterial(w: WorldDef): { material: MeshStandardMaterial; uniforms: TerrainUniforms } {
  const uniforms = createUniforms(w);
  const material = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.92, metalness: 0, envMapIntensity: 0.8 });
  material.name = 'terrain';
  material.customProgramCacheKey = () => 'terrain-v5';
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms, AP_UNIFORMS, CLOUD_SHADOW_UNIFORMS);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec4 terrainAttrib;
attribute vec4 terrainMorph;
attribute vec4 terrainMorphAttrib;
uniform float uViewS;
uniform vec4 uMorph;
uniform vec3 uPathP0, uMissionO;
uniform mat3 uPathB;
varying vec4 vTerr;
varying vec3 vWorldP;
varying vec3 vWorldN;
varying float vAlt;`,
      )
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
// geomorph toward the next LOD's surface with path distance: fully morphed before the tile's
// coarser neighbour can begin (tiles.ts), so LOD switches and LOD borders are seamless
float tLod = floor(terrainMorph.y / ${MORPH_LOD_PACK.toFixed(1)});
float tDist = abs(terrainMorph.y - tLod * ${MORPH_LOD_PACK.toFixed(1)} - uViewS);
vec2 tR = tLod < 0.5 ? uMorph.xy : uMorph.zw;
float tM = tLod > 1.5 ? 0.0 : clamp((tDist - tR.x) / max(tR.y - tR.x, 1e-3), 0.0, 1.0);
vec3 tN = vec3(terrainMorph.z, sqrt(max(0.0, 1.0 - dot(terrainMorph.zw, terrainMorph.zw))), terrainMorph.w);
objectNormal = normalize(mix(objectNormal, tN, tM));`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
transformed.y += terrainMorph.x * tM;
vTerr = mix(terrainAttrib, terrainMorphAttrib, tM);
vec4 wp4 = modelMatrix * vec4(transformed, 1.0);
// scene -> world: uPathB is B^T (world -> local), so B = transpose(uPathB)
mat3 toWorld = transpose(uPathB);
vWorldP = uPathP0 + toWorld * (wp4.xyz - uMissionO);
vWorldN = normalize(toWorld * (mat3(modelMatrix) * objectNormal));
vAlt = transformed.y; // relative to the tile origin = the valley floor at the tile start`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform vec3 uGrass, uMeadow, uSoil, uRock, uStrata, uScree, uSnow, uWetTint;
uniform float uSnowLine, uStrataBand;
${AP_GLSL}
varying vec4 vTerr;
varying vec3 vWorldP;
varying vec3 vWorldN;
varying float vAlt;
// a NaN / Inf never leaves the terrain: in the HDR buffer one such pixel is smeared over the whole frame by
// bloom (late Level 1 rendered black frames, 2026-10-03). Bit test: isnan() is folded away by the D3D
// compiler's fast math, and instrumenting the stages perturbs codegen enough to hide the source op.
bool tBad(float x) { return (floatBitsToUint(x) & 0x7fffffffu) >= 0x7f800000u; }
float tHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float tNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(tHash(i), tHash(i + vec2(1, 0)), u.x), mix(tHash(i + vec2(0, 1)), tHash(i + vec2(1, 1)), u.x), u.y);
}
float tFbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * tNoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s;
}
${CLOUD_SHADOW_GLSL}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  vec2 wp = vWorldP.xz;
  float slope = 1.0 - clamp(vWorldN.y, 0.0, 1.0);
  float macro = tFbm(wp * 0.0021);
  float meso = tFbm(wp * 0.017 + 3.7);
  float micro = tFbm(wp * 0.11);
  float rockA = vTerr.r, moist = vTerr.g, wet = vTerr.b;
  // grass <-> meadow by moisture + macro patches; soil shows through on the steeper grass
  vec3 col = mix(uMeadow, uGrass, smoothstep(0.35, 0.75, moist * 0.7 + macro * 0.6));
  col *= 0.86 + 0.28 * meso;
  col = mix(col, uSoil, smoothstep(0.22, 0.42, slope + (micro - 0.5) * 0.2) * 0.75);
  // rock: exposure attribute + steep slopes; limestone with strata bands
  float rockW = clamp(max(rockA * 1.1, smoothstep(0.42, 0.62, slope + (meso - 0.5) * 0.18)), 0.0, 1.0);
  float band = tNoise(vec2(vWorldP.y / uStrataBand + macro * 2.0, 0.5));
  vec3 rock = mix(uRock, uStrata, smoothstep(0.35, 0.65, band));
  rock *= 0.78 + 0.34 * micro;
  col = mix(col, rock, rockW);
  // scree aprons: below the rock, moderate slopes
  col = mix(col, uScree * (0.85 + 0.3 * micro), smoothstep(0.25, 0.45, slope) * (1.0 - rockW) * rockA * 0.8);
  // snow above the snow line on the gentler slopes
  float snow = smoothstep(uSnowLine - 40.0, uSnowLine + 60.0, vAlt + (macro - 0.5) * 160.0) * (1.0 - smoothstep(0.55, 0.75, slope));
  col = mix(col, uSnow, snow);
  // wet banks darken toward the river colour
  col = mix(col, col * 0.55 + uWetTint * 0.25, clamp(wet * 1.5, 0.0, 1.0));
  diffuseColor.rgb = col;
}`,
      )
      .replace(
        '#include <fog_fragment>',
        `{
  // aerial perspective (shared chunk) instead of the scene's linear fog
  vec4 ap = aerial(vWorldP);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, ap.rgb, ap.a);
  if (tBad(gl_FragColor.r) || tBad(gl_FragColor.g) || tBad(gl_FragColor.b)) gl_FragColor.rgb = ap.rgb;
}`,
      )
      .replace(
        '#include <lights_fragment_begin>',
        `#include <lights_fragment_begin>
{
  // drifting cloud shadows dim the sun (the only direct light on the ground in a mission)
  float cs = cloudShade(vWorldP, uSunW, uApH0);
  reflectedLight.directDiffuse *= cs;
  reflectedLight.directSpecular *= cs;
}`,
      )
      .replace(
        '#include <lights_fragment_maps>',
        `#include <lights_fragment_maps>
// rough ground: the sky probe lights it (irradiance) but its mirror term only veils the grass blue
radiance *= mix(0.2, 1.0, clamp(vTerr.b * 2.0, 0.0, 1.0));`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
roughnessFactor = mix(0.95, 0.72, clamp(vTerr.b * 2.0, 0.0, 1.0));`,
      );
  };
  return { material, uniforms };
}
