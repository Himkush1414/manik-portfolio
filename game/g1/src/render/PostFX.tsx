// Post stack (brief §2): HalfFloat HDR composer, N8AO, DOF, mipmap Bloom,
// chromatic aberration, exposure grade -> ONE tone-mapping stage (AgX, see
// DEV_NOTES A/B) -> vignette -> film grain, plus a transition-blur pass that
// only runs while a transition is blurring. Owns the render call (useFrame
// priority 1), so R3F's own auto-render is off. Rebuilt only when the effect
// set changes; per-frame values flow in through uniforms.
import { useEffect, useLayoutEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  BloomEffect,
  ChromaticAberrationEffect,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
  NoiseEffect,
  DepthOfFieldEffect,
  BlendFunction,
  type Effect,
} from 'postprocessing';
import { N8AOPostPass } from 'n8ao';
import { HalfFloatType, Vector2, Vector3 } from 'three';
import { useSettings } from '../state/settings.store';
import { usePerf, resolveQuality } from './perf';
import { postfx } from './fxController';
import { CameraShaker } from './CameraShaker';
import { ExposureEffect, TransitionBlurEffect } from './effects';
import { POST } from '../data/render.config';
import { frameInfoBegin, frameInfoEnd, registerDebug } from '../debug/debugApi';

export type PostFXProps = {
  /** scene allows AO (hangar, cockpit) */
  ao?: boolean;
  /** scene allows DOF; focus follows this world point */
  dofTarget?: Vector3 | null;
  dofRange?: number;
};

type Chain = {
  bloom: BloomEffect | null;
  ca: ChromaticAberrationEffect | null;
  exposure: ExposureEffect;
  vignette: VignetteEffect | null;
  dof: DepthOfFieldEffect | null;
  blur: TransitionBlurEffect;
  blurPass: EffectPass;
  n8: N8AOPostPass | null;
};

export function PostFX({ ao = false, dofTarget = null, dofRange = POST.dof.range }: PostFXProps) {
  const gl = useThree(s => s.gl);
  const scene = useThree(s => s.scene);
  const camera = useThree(s => s.camera);
  const size = useThree(s => s.size);
  const graphics = useSettings(s => s.graphics);
  const reduceMotion = useSettings(s => s.accessibility.reduceMotion);
  const reduceFlashing = useSettings(s => s.accessibility.reduceFlashing);
  const shake = useSettings(s => s.camera.shake);
  const degrade = usePerf(s => s.degrade);
  const q = resolveQuality(graphics, degrade);

  const composerRef = useRef<EffectComposer | null>(null);
  const chainRef = useRef<Chain | null>(null);
  const caBase = useRef(new Vector2());
  const lastRender = useRef(0);

  const useAO = ao && q.ao;
  const useDOF = !!dofTarget && q.dof;

  useLayoutEffect(() => {
    const composer = new EffectComposer(gl, { frameBufferType: HalfFloatType, multisampling: q.multisampling });
    composer.addPass(new RenderPass(scene, camera));

    let n8: N8AOPostPass | null = null;
    if (useAO) {
      n8 = new N8AOPostPass(scene, camera, size.width, size.height);
      Object.assign(n8.configuration, POST.ao);
      n8.setQualityMode(POST.aoQuality);
      composer.addPass(n8);
    }

    const effects: Effect[] = [];
    let dof: DepthOfFieldEffect | null = null;
    if (useDOF) {
      dof = new DepthOfFieldEffect(camera, { worldFocusDistance: 20, worldFocusRange: dofRange, bokehScale: POST.dof.bokeh });
      dof.target = dofTarget;
      effects.push(dof);
    }
    const bloom = graphics.bloom ? new BloomEffect({ mipmapBlur: true, ...POST.bloom }) : null;
    if (bloom) effects.push(bloom);
    const ca = graphics.chromatic
      ? new ChromaticAberrationEffect({ offset: caBase.current, radialModulation: true, modulationOffset: 0.2 })
      : null;
    if (ca) effects.push(ca);
    const exposure = new ExposureEffect();
    effects.push(exposure);
    effects.push(new ToneMappingEffect({ mode: POST.toneMapping === 'agx' ? ToneMappingMode.AGX : ToneMappingMode.NEUTRAL }));
    const vignette = graphics.vignette ? new VignetteEffect(POST.vignette) : null;
    if (vignette) effects.push(vignette);
    if (graphics.grain) {
      const noise = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: false });
      noise.blendMode.opacity.value = POST.grain;
      effects.push(noise);
    }
    // Transition blur runs BEFORE the main pass (in HDR, pre-tone-map) so the
    // main pass is always the chain's last pass: postprocessing only sends
    // the final pass to screen, and this one is disabled while blur == 0.
    const blur = new TransitionBlurEffect();
    const blurPass = new EffectPass(camera, blur);
    blurPass.enabled = false;
    composer.addPass(blurPass);

    const mainPass = new EffectPass(camera, ...effects);
    mainPass.dithering = true; // kills banding in the dark gradients
    composer.addPass(mainPass);

    composer.setSize(size.width, size.height);
    composerRef.current = composer;
    registerDebug('post', { composer: () => composer });
    chainRef.current = { bloom, ca, exposure, vignette, dof, blur, blurPass, n8 };
    return () => {
      composerRef.current = null;
      chainRef.current = null;
      composer.dispose();
    };
    // size handled separately below; dofTarget identity is stable per scene
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera, useAO, useDOF, q.multisampling, graphics.bloom, graphics.chromatic, graphics.vignette, graphics.grain]);

  useEffect(() => {
    composerRef.current?.setSize(size.width, size.height);
  }, [size.width, size.height, q.dpr]);

  useEffect(() => {
    postfx.reduceFlashing = reduceFlashing;
  }, [reduceFlashing]);

  useFrame((_, dt) => {
    const composer = composerRef.current;
    const chain = chainRef.current;
    if (!composer || !chain) return;

    // FPS cap (Uncapped / 60 / 30): skip frames rather than fight rAF
    const cap = graphics.fpsCap;
    const now = performance.now();
    if (cap > 0 && now - lastRender.current < 1000 / cap - 1.5) return;
    lastRender.current = now;

    if (chain.ca) {
      const o = POST.caBase + postfx.ca;
      caBase.current.set(o, o * 0.6);
    }
    if (chain.vignette) chain.vignette.darkness = POST.vignette.darkness + postfx.vignette;
    chain.exposure.exposure = postfx.exposure;
    if (chain.dof) chain.dof.bokehScale = POST.dof.bokeh * postfx.dof;
    if (chain.n8) {
      // uniforms only (no recompile): intensity + near-field radius scale
      // intensity 0 made N8AO output NaN (pow(0,0)) -> black frame through bloom:
      // below a floor the pass is disabled instead (postprocessing skips it)
      chain.n8.enabled = postfx.ao > 0.02;
      const c = chain.n8.configuration as { intensity: number; aoRadius: number; distanceFalloff: number };
      const I = POST.ao.intensity * Math.max(0.02, postfx.ao), R = POST.ao.aoRadius * postfx.aoRadius, F = POST.ao.distanceFalloff * postfx.aoRadius;
      if (c.intensity !== I) c.intensity = I;
      if (c.aoRadius !== R) c.aoRadius = R;
      if (c.distanceFalloff !== F) c.distanceFalloff = F;
    }
    chain.blur.amount = postfx.blur;
    chain.blurPass.enabled = postfx.blur > 0.002;

    CameraShaker.intensity = reduceMotion ? 0 : shake;
    CameraShaker.update(dt);
    CameraShaker.apply(camera);
    frameInfoBegin(gl);
    composer.render(dt);
    frameInfoEnd(gl);
    CameraShaker.restore(camera);
  }, 1);

  return null;
}
