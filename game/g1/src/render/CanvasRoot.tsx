// The app's single WebGL canvas (brief §2/§17). WebGL2, no R3F tone mapping
// (`flat`: the ONE tone-map stage lives in PostFX), sRGB output, soft shadows,
// DPR from the resolved quality, render paused while the tab is hidden, and
// automatic re-init after a lost context.
import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { Color, PCFSoftShadowMap, type WebGLRenderer } from 'three';
import { useSettings } from '../state/settings.store';
import { usePerf, resolveQuality } from './perf';
import { DrsDriver } from './DrsDriver';
import { perfMon } from './perfMon';
import { CLEAR_COLOR } from '../data/render.config';
import { registerRenderer } from '../debug/debugApi';
import { watchShaderLinks } from '../debug/shaderCheck';
import styles from './CanvasRoot.module.css';

type Props = { children: ReactNode };

export function CanvasRoot({ children }: Props) {
  const graphics = useSettings(s => s.graphics);
  const degrade = usePerf(s => s.degrade);
  const q = resolveQuality(graphics, degrade);
  const [hidden, setHidden] = useState(document.hidden);
  const [lost, setLost] = useState(false);

  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  return (
    <div className={styles.root}>
      <Canvas
        className={styles.canvas}
        dpr={q.dpr}
        flat
        shadows={{ type: PCFSoftShadowMap }}
        frameloop={hidden ? 'never' : 'always'}
        gl={{ antialias: false, alpha: false, stencil: false, depth: true, powerPreference: 'high-performance' }}
        camera={{ fov: 30, near: 0.15, far: 1000, position: [0, 3, 34] }}
        onCreated={({ gl, scene }) => {
          gl.setClearColor(CLEAR_COLOR, 1);
          // The void colour MUST be scene.background, not only the clear
          // colour: postprocessing's RenderPass clears its linear HDR buffer
          // with a bare renderer.clear(), which reuses the GL clear value
          // three last set for the SCREEN (already sRGB-encoded) — the final
          // pass then encodes it again and every empty pixel reads navy.
          // scene.background is cleared per-target in the right colour space.
          scene.background = new Color(CLEAR_COLOR);
          installShaderErrorFilter(gl);
          registerRenderer(gl);
          perfMon.install(gl);
          const canvas = gl.domElement;
          canvas.addEventListener('webglcontextlost', e => {
            e.preventDefault();
            setLost(true);
          });
          // restore IN PLACE: three's renderer rebuilds its GL state on
          // 'webglcontextrestored' and re-uploads every geometry / texture /
          // program lazily. (Remounting the Canvas instead created a second
          // renderer while module caches still held the first one's objects:
          // "object does not belong to this context".)
          canvas.addEventListener('webglcontextrestored', () => setLost(false));
        }}
      >
        <DrsDriver />
        <Suspense fallback={null}>{children}</Suspense>
      </Canvas>
      {lost && (
        <div className={styles.lost} role="status" aria-live="polite">
          <span>GRAPHICS LINK LOST — RESTORING</span>
        </div>
      )}
    </div>
  );
}

/**
 * three.js dumps every non-empty program info log to console.warn when
 * `checkShaderErrors` is on — including ANGLE/D3D's benign compiler notes for
 * third-party shaders (N8AO's X3595 "gradient instruction used in a loop").
 * three's docs recommend disabling the check in production; we disable it
 * everywhere and run our own check that reports only programs that actually
 * FAIL to link (see debug/shaderCheck.ts), so real breakage is never silent.
 */
function installShaderErrorFilter(gl: WebGLRenderer): void {
  gl.debug.checkShaderErrors = false;
  watchShaderLinks(gl);
}

/** WebGL2 capability check, run before mounting anything 3D. */
// cached: App renders on every flow change, and each probe created a WebGL
// context (a 66 ms long task per call, found profiling the hangar)
let webgl2: boolean | null = null;
export function hasWebGL2(): boolean {
  if (webgl2 !== null) return webgl2;
  try {
    const c = document.createElement('canvas');
    const ctx = c.getContext('webgl2');
    webgl2 = !!ctx;
    (ctx?.getExtension('WEBGL_lose_context') as { loseContext(): void } | null)?.loseContext();
  } catch {
    webgl2 = false;
  }
  return webgl2;
}
