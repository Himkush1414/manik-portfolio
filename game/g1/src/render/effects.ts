// Custom postprocessing effects: exposure grade (before the single tone-map
// stage) and a separable-ish transition blur (its own pass; convolution).
import { Effect, EffectAttribute, BlendFunction } from 'postprocessing';
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
