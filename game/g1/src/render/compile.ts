// Parallel (KHR_parallel_shader_compile) program compile against an HDR
// target. Program variants are keyed on the output colour space, and the
// world always renders into the composer's linear HalfFloat buffer —
// compiling for the screen (sRGB) produced the wrong variants and a 3.3 s
// synchronous recompile later (DEV_NOTES §8).
import { HalfFloatType, WebGLRenderTarget, type Camera, type Object3D, type Scene, type WebGLRenderer } from 'three';

export async function compileHdr(gl: WebGLRenderer, scene: Scene, camera: Camera, forceVisible: Object3D[] = []): Promise<void> {
  const mask = camera.layers.mask;
  camera.layers.enableAll();
  // hidden subtrees (e.g. the pre-warmed cockpit) compile too
  const prevVis = forceVisible.map(o => o.visible);
  forceVisible.forEach(o => (o.visible = true));
  const probe = new WebGLRenderTarget(4, 4, { type: HalfFloatType });
  const prevTarget = gl.getRenderTarget();
  gl.setRenderTarget(probe);
  const done = safeCompileAsync(gl, scene, camera);
  gl.setRenderTarget(prevTarget);
  camera.layers.mask = mask;
  forceVisible.forEach((o, i) => (o.visible = prevVis[i]));
  await done;
  probe.dispose();
}

/**
 * renderer.compileAsync, hardened: three's version polls every compiled
 * material's program and THROWS (uncaught, in a setTimeout) when one was
 * disposed meanwhile — its promise then never resolves (would hang the
 * cockpit-ready wait). Disposed / program-less materials count as done, and
 * a time cap resolves regardless.
 */
export function safeCompileAsync(gl: WebGLRenderer, scene: Object3D, camera: Camera, capMs = 8000): Promise<void> {
  const materials = gl.compile(scene, camera) as unknown as Set<object>;
  const props = (gl as unknown as { properties: { get(m: object): { currentProgram?: { isReady(): boolean } } } }).properties;
  const t0 = performance.now();
  return new Promise(resolve => {
    const check = () => {
      for (const m of Array.from(materials)) {
        const program = props.get(m)?.currentProgram;
        if (!program || program.isReady()) materials.delete(m);
      }
      if (materials.size === 0 || performance.now() - t0 > capMs) resolve();
      else setTimeout(check, 10);
    };
    check();
  });
}
