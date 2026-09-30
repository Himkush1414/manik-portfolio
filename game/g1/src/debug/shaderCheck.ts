// Link-status watchdog replacing three's checkShaderErrors (see CanvasRoot).
// Checks each newly created program once; logs real failures with both
// shader logs. Cost: a few GL queries per new program, zero per frame.
import type { WebGLRenderer } from 'three';

type ProgramInfo = { program: WebGLProgram; vertexShader: WebGLShader; fragmentShader: WebGLShader; name?: string };

export function watchShaderLinks(renderer: WebGLRenderer): void {
  const seen = new WeakSet<WebGLProgram>();
  let lastCount = -1;
  const check = () => {
    const programs = (renderer.info.programs ?? []) as unknown as ProgramInfo[];
    if (programs.length !== lastCount) {
      lastCount = programs.length;
      const gl = renderer.getContext();
      for (const p of programs) {
        if (!p.program || seen.has(p.program)) continue;
        seen.add(p.program);
        if (!gl.getProgramParameter(p.program, gl.LINK_STATUS)) {
          console.error(
            `[g1] shader program "${p.name ?? 'unnamed'}" failed to link`,
            gl.getProgramInfoLog(p.program),
            gl.getShaderInfoLog(p.vertexShader),
            gl.getShaderInfoLog(p.fragmentShader),
          );
        }
      }
    }
    requestAnimationFrame(check);
  };
  requestAnimationFrame(check);
}
