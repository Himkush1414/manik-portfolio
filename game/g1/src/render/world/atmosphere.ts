// Aerial perspective (Phase 2R §6): ONE shared GLSL chunk for the world
// materials (terrain now; water, vegetation, rocks, clouds as they land):
// exp2 distance haze with a height falloff (valleys hold the haze, ridges
// poke out of it), near -> far haze colour, and sun-direction in-scatter
// (the haze glows toward the sun). Uniforms are shared objects updated once
// per frame by MissionWorld, so a world change never recompiles. Positions
// are WORLD positions (the materials reconstruct them from mission space).
// Actor materials (ship, enemies, VFX) keep the scene's single linear Fog,
// tuned per world to match this within their working range (a fog-type
// change would recompile every program — Phase 2 decision 2).
import { Color, Vector3 } from 'three';
import type { WorldDef } from '../../data/worlds/types';

export const AP_UNIFORMS = {
  uApNear: { value: new Color() },
  uApFar: { value: new Color() },
  uApInscatter: { value: new Color() },
  /** exp2 density (1/u), height falloff (1/u), reference height (world y of the valley floor) */
  uApDensity: { value: 0.0004 },
  uApFalloff: { value: 0.001 },
  uApH0: { value: 0 },
  /** world camera position + world sun direction (toward the sun) */
  uCamW: { value: new Vector3() },
  uSunW: { value: new Vector3(0, 1, 0) },
};

const DEG = Math.PI / 180;
/** world direction toward a sky object from elevation / azimuth (deg; azimuth clockwise from -z toward +x) */
export function sunDirection(el: number, az: number, out = new Vector3()): Vector3 {
  return out.set(Math.sin(az * DEG) * Math.cos(el * DEG), Math.sin(el * DEG), -Math.cos(az * DEG) * Math.cos(el * DEG));
}

export function setAtmosphere(w: WorldDef): void {
  const a = w.atmosphere;
  AP_UNIFORMS.uApNear.value.set(a.hazeNear);
  AP_UNIFORMS.uApFar.value.set(a.hazeFar);
  AP_UNIFORMS.uApInscatter.value.set(a.inscatter.color).multiplyScalar(a.inscatter.strength);
  AP_UNIFORMS.uApDensity.value = a.density;
  AP_UNIFORMS.uApFalloff.value = a.heightFalloff;
}

export const AP_GLSL = /* glsl */ `
uniform vec3 uApNear, uApFar, uApInscatter, uCamW, uSunW;
uniform float uApDensity, uApFalloff, uApH0;
// haze amount (0..1) and colour for a world-space point seen from the camera
vec4 aerial(vec3 worldP) {
  vec3 d = worldP - uCamW;
  float dist = length(d);
  vec3 v = d / max(dist, 1e-3);
  // density thins with altitude above the valley floor: integrate exp(-k h) along the ray (analytic)
  float h0 = max(uCamW.y - uApH0, 0.0), h1 = max(worldP.y - uApH0, 0.0);
  float dh = h1 - h0;
  float k = uApFalloff;
  float avg = abs(dh) > 1.0 ? (exp(-k * h0) - exp(-k * h1)) / (k * dh) : exp(-k * h0);
  float od = uApDensity * dist * max(avg, 0.02);
  float f = 1.0 - exp(-od * od);
  // colour: near haze -> far haze with distance, glowing toward the sun
  vec3 col = mix(uApNear, uApFar, smoothstep(300.0, 4000.0, dist));
  float sun = max(dot(v, uSunW), 0.0);
  col += uApInscatter * (pow(sun, 6.0) * 0.9 + pow(sun, 48.0) * 1.6);
  return vec4(col, clamp(f, 0.0, 1.0));
}
`;
