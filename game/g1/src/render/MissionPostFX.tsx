// Mission post chain (brief §4 rule 2: no shader compile during play; the
// post composition is fixed per preset). A SEPARATE composer from the Phase 1
// PostFX (rebuilding that one at the launch = a synchronous EffectPass
// compile): built during MissionLoader.prepare and warmed by one off-screen
// render, then it owns the frame while stage.mission is on (PostFX yields).
// Chain: RenderPass -> [bloom (preset resolution), CA, exposure, AgX (the ONE
// tone-map), vignette, grain]. Speed blur / CA-by-speed land in 2B.
import { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  BlendFunction,
  BloomEffect,
  ChromaticAberrationEffect,
  EffectComposer,
  EffectPass,
  NoiseEffect,
  RenderPass,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
  type Effect,
} from 'postprocessing';
import { HalfFloatType, Vector2, type Camera, type Scene, type WebGLRenderer } from 'three';
import { POST } from '../data/render.config';
import { ExposureEffect, RadialBlurEffect, scaleBloom } from './effects';
import { SPEED_FX } from '../data/tunnel';
import { postfx } from './fxController';
import { CameraShaker } from './CameraShaker';
import { stage } from '../scenes/Stage';
import { perfMon } from './perfMon';
import { frameInfoBegin, frameInfoEnd } from '../debug/debugApi';
import { useSettings } from '../state/settings.store';
import { usePerf, resolveQuality, type EffectiveQuality } from './perf';

type Chain = { composer: EffectComposer; exposure: ExposureEffect; ca: ChromaticAberrationEffect | null; caOffset: Vector2; vignette: VignetteEffect | null; radial: RadialBlurEffect | null; radialPass: EffectPass | null; key: string };

let chain: Chain | null = null;

/** speed-driven post values, written by the mission loop each frame */
export const missionPost = { blur: 0, ca: 0 };

const keyOf = (q: EffectiveQuality, g: { bloom: boolean; chromatic: boolean; vignette: boolean; grain: boolean }) =>
  `${q.preset}|${q.multisampling}|${q.bloom.scale}|${q.bloom.levels}|${g.bloom}|${g.chromatic}|${g.vignette}|${g.grain}`;

/** Build (or reuse) the mission composer and warm every program off-screen. */
export function prepareMissionPost(gl: WebGLRenderer, scene: Scene, camera: Camera, width: number, height: number): void {
  const g = useSettings.getState().graphics;
  const q = resolveQuality(g, usePerf.getState().degrade);
  const key = keyOf(q, g);
  if (chain?.key === key) return;
  chain?.composer.dispose();
  const composer = new EffectComposer(gl, { frameBufferType: HalfFloatType, multisampling: q.multisampling });
  composer.addPass(new RenderPass(scene, camera));
  // radial speed blur (HIGH / ULTRA): its own pass (convolution), before the main pass
  let radial: RadialBlurEffect | null = null, radialPass: EffectPass | null = null;
  if (q.preset === 'high' || q.preset === 'ultra') {
    radial = new RadialBlurEffect(SPEED_FX.blurTaps);
    radialPass = new EffectPass(camera, radial);
    composer.addPass(radialPass);
  }
  const effects: Effect[] = [];
  if (g.bloom) effects.push(scaleBloom(new BloomEffect({ mipmapBlur: true, ...POST.bloom, levels: q.bloom.levels }), q.bloom.scale));
  const caOffset = new Vector2();
  const ca = g.chromatic ? new ChromaticAberrationEffect({ offset: caOffset, radialModulation: true, modulationOffset: 0.2 }) : null;
  if (ca) effects.push(ca);
  const exposure = new ExposureEffect();
  effects.push(exposure);
  effects.push(new ToneMappingEffect({ mode: POST.toneMapping === 'agx' ? ToneMappingMode.AGX : ToneMappingMode.NEUTRAL }));
  const vignette = g.vignette ? new VignetteEffect(POST.vignette) : null;
  if (vignette) effects.push(vignette);
  if (g.grain) {
    const noise = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: false });
    noise.blendMode.opacity.value = POST.grain;
    effects.push(noise);
  }
  const main = new EffectPass(camera, ...effects);
  main.dithering = true;
  composer.addPass(main);
  composer.setSize(width, height);
  // warm: one render into the composer's own buffers (never the screen), radial pass on
  main.renderToScreen = false;
  const exp = postfx.exposure;
  exposure.exposure = 0;
  if (radial) radial.strength = 0.01;
  composer.render(0);
  main.renderToScreen = true;
  exposure.exposure = exp;
  // the on-screen variant of the last pass differs (three keys programs on the output colour
  // space: sRGB to the canvas, linear into any target), so link it with the screen bound —
  // compile() draws nothing. Without this it compiled on the first mission frame (the breach).
  const prev = gl.getRenderTarget();
  gl.setRenderTarget(null);
  const fs = main as unknown as { scene: Scene; camera: Camera }; // the pass's fullscreen quad (protected)
  gl.compile(fs.scene, fs.camera);
  gl.setRenderTarget(prev);
  chain = { composer, exposure, ca, caOffset, vignette, radial, radialPass, key };
}

export function disposeMissionPost(): void {
  chain?.composer.dispose();
  chain = null;
}

export function missionPostReady(): boolean {
  return !!chain;
}

/** Renders the frame while the mission is live (priority 1, like PostFX). */
export function MissionPostFX() {
  const gl = useThree(s => s.gl);
  const size = useThree(s => s.size);
  // the DRS governor changes the DPR, not the CSS size: the chain's targets must follow both
  // (sized from the CSS size alone, DRS never reduced the scene fill in a mission)
  const dpr = useThree(s => s.viewport.dpr);
  const reduceMotion = useSettings(s => s.accessibility.reduceMotion);
  const shake = useSettings(s => s.camera.shake);
  useEffect(() => {
    chain?.composer.setSize(size.width, size.height);
  }, [size.width, size.height, dpr]);
  useFrame(({ camera }, dt) => {
    if (stage.mission < 0.5 || !chain) return;
    const c = chain;
    if (c.ca) {
      const o = POST.caBase + postfx.ca + missionPost.ca;
      c.caOffset.set(o, o * 0.6);
    }
    if (c.radial && c.radialPass) {
      // disabled below a visible strength: no fullscreen pass while cruising slowly (no recompile)
      c.radial.strength = missionPost.blur;
      c.radialPass.enabled = missionPost.blur > 0.002;
    }
    if (c.vignette) c.vignette.darkness = POST.vignette.darkness + postfx.vignette;
    c.exposure.exposure = postfx.exposure;
    CameraShaker.intensity = reduceMotion ? shake * 0.25 : shake;
    CameraShaker.update(dt);
    CameraShaker.apply(camera);
    frameInfoBegin(gl);
    perfMon.begin('render');
    c.composer.render(dt);
    perfMon.end('render');
    frameInfoEnd(gl);
    perfMon.frameEnd();
    CameraShaker.restore(camera);
  }, 1);
  return null;
}
