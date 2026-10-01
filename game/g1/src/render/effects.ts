// Custom postprocessing effects: exposure grade (before the single tone-map
// stage) and a separable-ish transition blur (its own pass; convolution).
import { Effect, EffectAttribute, BlendFunction, type BloomEffect } from 'postprocessing';
import { Uniform } from 'three';

export class ExposureEffect extends Effect {
  constructor() {
    super(
      'ExposureEffect',
      /* glsl */ `
        uniform float exposure;
        void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
          outputColor = vec4(inputColor.rgb * exposure, inputColor.a);
        }`,
      { blendFunction: BlendFunction.SET, uniforms: new Map([['exposure', new Uniform(1)]]) },
    );
  }
  set exposure(v: number) {
    this.uniforms.get('exposure')!.value = v;
  }
}

/** 13-tap golden-angle disc blur; radius in px scaled by `amount`. */
export class TransitionBlurEffect extends Effect {
  constructor() {
    super(
      'TransitionBlurEffect',
      /* glsl */ `
        uniform float amount;
        void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
          if (amount <= 0.001) { outputColor = inputColor; return; }
          vec2 px = amount * 28.0 * texelSize;
          vec4 acc = inputColor;
          float w = 1.0;
          for (int i = 1; i < 13; i++) {
            float fi = float(i);
            float r = sqrt(fi / 12.0);
            float a = fi * 2.39996323;
            vec2 o = vec2(cos(a), sin(a)) * r * px;
            acc += textureLod(inputBuffer, uv + o, 0.0);
            w += 1.0;
          }
          outputColor = acc / w;
        }`,
      { attributes: EffectAttribute.CONVOLUTION, uniforms: new Map([['amount', new Uniform(0)]]) },
    );
  }
  set amount(v: number) {
    this.uniforms.get('amount')!.value = v;
  }
}

/**
 * Bloom resolution (brief §4.10: LOW 1/4, MED/HIGH 1/2, ULTRA full).
 * postprocessing's BloomEffect ignores `resolutionScale` in mipmap-blur mode:
 * its luminance pass and the mip chain always start at full size. Measured on
 * the integrated GPU: bloom was the largest single post cost in the hangar.
 * This runs both at `scale` of the frame (the effect samples the result with
 * linear filtering, so the glow just gets softer).
 */
export function scaleBloom(bloom: BloomEffect, scale: number): BloomEffect {
  if (scale >= 1) return bloom;
  const base = bloom.setSize.bind(bloom);
  bloom.setSize = (width: number, height: number) => {
    base(width, height);
    const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
    bloom.luminancePass.setSize(w, h);
    bloom.mipmapBlurPass.setSize(w, h);
  };
  return bloom;
}

/**
 * Radial speed blur (brief §6 SPEED SENSATION, HIGH/ULTRA): samples toward the
 * screen centre, stronger at the edges and with speed. A CONVOLUTION effect,
 * so it runs in its own pass ahead of the main pass (HDR, pre-tone-map).
 */
export class RadialBlurEffect extends Effect {
  constructor(taps: number) {
    super(
      'RadialBlurEffect',
      /* glsl */ `
        uniform float strength;
        void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
          vec2 dir = uv - 0.5;
          float edge = smoothstep(0.12, 0.72, length(dir));
          vec3 acc = inputColor.rgb;
          for (int i = 1; i < ${taps}; i++) {
            float k = float(i) / float(${taps});
            acc += texture2D(inputBuffer, uv - dir * strength * edge * k).rgb;
          }
          outputColor = vec4(acc / float(${taps}), inputColor.a);
        }`,
      { attributes: EffectAttribute.CONVOLUTION, uniforms: new Map([['strength', new Uniform(0)]]) },
    );
  }
  set strength(v: number) {
    this.uniforms.get('strength')!.value = v;
  }
}
