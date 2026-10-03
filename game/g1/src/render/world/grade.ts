// Per-world colour grade (Phase 2R §6 GRADE): one effect in the mission's
// main post pass, AFTER the single AgX tone-map (display-referred linear):
// contrast around mid grey, saturation, and split toning (shadow tint ->
// highlight tint by luminance). Its uniforms are module-level objects shared
// by every rebuild of the chain, so a world change (or the neutral grade
// outside a world) is uniforms only — never a recompile. Exposure is applied
// before the tone-map by the existing ExposureEffect (missionGrade.exposure).
import { Effect } from 'postprocessing';
import { Color, Uniform, Vector3 } from 'three';
import type { WorldDef } from '../../data/worlds/types';

const U = {
  contrast: new Uniform(1),
  saturation: new Uniform(1),
  split: new Uniform(0),
  shadowTint: new Uniform(new Vector3(1, 1, 1)),
  highlightTint: new Uniform(new Vector3(1, 1, 1)),
};

/** pre-tone-map exposure of the current world x the time of day (MissionPostFX multiplies both in) */
export const missionGrade = { exposure: 1, tod: 1 };

const _c = new Color();
/** a tint as a unit-luminance multiplier (tints colour, never darken / brighten), clamped */
function tint(hex: string, out: Vector3): void {
  _c.set(hex);
  const l = Math.max(1e-4, 0.2126 * _c.r + 0.7152 * _c.g + 0.0722 * _c.b);
  out.set(Math.min(1.8, Math.max(0.4, _c.r / l)), Math.min(1.8, Math.max(0.4, _c.g / l)), Math.min(1.8, Math.max(0.4, _c.b / l)));
}

export function setWorldGrade(w: WorldDef | null): void {
  const g = w?.atmosphere.grade;
  if (!g) {
    U.contrast.value = 1;
    U.saturation.value = 1;
    U.split.value = 0;
    missionGrade.exposure = 1;
    return;
  }
  U.contrast.value = g.contrast;
  U.saturation.value = g.saturation;
  U.split.value = g.split;
  tint(g.shadowTint, U.shadowTint.value);
  tint(g.highlightTint, U.highlightTint.value);
  missionGrade.exposure = g.exposure;
}

export class GradeEffect extends Effect {
  constructor() {
    super(
      'GradeEffect',
      /* glsl */ `
        uniform float contrast, saturation, split;
        uniform vec3 shadowTint, highlightTint;
        void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
          vec3 c = max(inputColor.rgb, 0.0);
          // contrast around mid grey (a power curve keeps black at black)
          c = 0.18 * pow(c / 0.18, vec3(contrast));
          float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
          c = max(mix(vec3(l), c, saturation), 0.0);
          // split toning: cool shadows -> warm highlights (unit-luminance tints)
          vec3 t = mix(shadowTint, highlightTint, smoothstep(0.04, 0.55, l));
          c *= mix(vec3(1.0), t, split);
          outputColor = vec4(c, inputColor.a);
        }`,
      { uniforms: new Map<string, Uniform>(Object.entries(U)) },
    );
  }
}
