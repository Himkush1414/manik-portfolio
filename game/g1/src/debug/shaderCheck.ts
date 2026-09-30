// Link-status watchdog replacing three's checkShaderErrors (see CanvasRoot).
// Checks each newly created program once and logs real failures with both
// shader logs. It must NOT block: querying LINK_STATUS before the driver has
// finished forces a synchronous link and defeats KHR_parallel_shader_compile
// (measured: a 3.2 s main-thread stall during boot). With the extension, a
// program is only inspected once COMPLETION_STATUS_KHR reports it done.
import type { WebGLRenderer } from 'three';

type ProgramInfo = { program: WebGLProgram; vertexShader: WebGLShader; fragmentShader: WebGLShader; name?: string };

export function watchShaderLinks(renderer: WebGLRenderer): void {
  const checked = new WeakSet<WebGLProgram>();
  const gl = renderer.getContext();
  const ext = gl.getExtension('KHR_parallel_shader_compile') as { COMPLETION_STATUS_KHR: number } | null;
  const tick = () => {
    const programs = (renderer.info.programs ?? []) as unknown as ProgramInfo[];
    for (const p of programs) {
      if (!p.program || checked.has(p.program)) continue;
      if (ext && !gl.getProgramParameter(p.program, ext.COMPLETION_STATUS_KHR)) continue; // still compiling: look again next frame
      checked.add(p.program);
      if (!gl.getProgramParameter(p.program, gl.LINK_STATUS)) {
        console.error(
          `[g1] shader program "${p.name ?? 'unnamed'}" failed to link`,
          gl.getProgramInfoLog(p.program),
          gl.getShaderInfoLog(p.vertexShader),
          gl.getShaderInfoLog(p.fragmentShader),
        );
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
