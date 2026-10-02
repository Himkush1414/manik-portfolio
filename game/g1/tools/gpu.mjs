// GPU selection for the QA / perf tools. `node` here is Windows node.exe
// behind a WSL shim: an env var only reaches it when listed in WSLENV, so
//   export WSLENV=G1_DGPU G1_DGPU=1
// before a run, else Chrome silently renders on the integrated GPU. The flag
// alone proved untrustworthy, so `assertGpu(page)` reads the real WebGL
// renderer and throws when the discrete GPU was asked for but not used.
//   node tools/gpu.mjs   -> prints the renderer this environment gets
import { chromium } from 'playwright';

export const wantDgpu = !!process.env.G1_DGPU;
export const gpuArgs = ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', ...(wantDgpu ? ['--force_high_performance_gpu'] : [])];

/** the unmasked WebGL renderer string of a fresh canvas in `page` */
export async function gpuRenderer(page) {
  return page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
    if (!gl) return 'no webgl';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const r = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return String(r);
  });
}

/** throws unless the renderer matches the requested GPU; returns a short label for perf rows */
export async function assertGpu(page) {
  const r = await gpuRenderer(page);
  const discrete = /NVIDIA|RTX|GeForce/i.test(r);
  if (wantDgpu && !discrete) throw new Error(`G1_DGPU set but rendering on: ${r}`);
  if (!wantDgpu && discrete) throw new Error(`integrated GPU expected (G1_DGPU unset) but rendering on: ${r}`);
  const label = discrete ? 'RTX 3050' : /UHD|Intel/i.test(r) ? 'UHD 770' : r;
  console.error('[gpu]', label, '|', r);
  return label;
}

if (import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, '/').split('/').pop() ?? '')) {
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: gpuArgs });
  const p = await b.newPage();
  await p.goto('about:blank');
  console.log(JSON.stringify({ G1_DGPU: process.env.G1_DGPU ?? null, renderer: await gpuRenderer(p) }));
  await b.close();
}
