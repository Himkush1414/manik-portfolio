// The GPU the LIVE renderer runs on (WEBGL_debug_renderer_info), for paths
// whose cheapest form differs by GPU class. Read from the real context: on a
// dual-GPU machine a throwaway context can land on the other adapter.
import type { WebGLRenderer } from 'three';

/** integrated GPUs by renderer string (Intel UHD / Iris, AMD APU "Radeon Graphics" / Vega N) */
export const INTEGRATED_GPU = /\b(intel|uhd|iris)\b|radeon\(tm\) graphics|radeon graphics|vega \d+ graphics/i;

export const gpuClass = {
  /** unmasked renderer string ('' until the world mounts / when the browser hides it) */
  renderer: '',
  integrated: false,
};

/** Called once with the world's renderer (sceneBridge.markWorldMounted). */
export function detectGpuClass(gl: WebGLRenderer): void {
  const ctx = gl.getContext();
  const ext = ctx.getExtension('WEBGL_debug_renderer_info');
  gpuClass.renderer = String(ext ? ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ctx.getParameter(ctx.RENDERER) ?? '');
  gpuClass.integrated = INTEGRATED_GPU.test(gpuClass.renderer);
}
