// window.__G1__ — QA + dev API (brief §18). Enabled in dev or with ?debug=1.
// Slices register their own namespaces (boot, hangar, ...) as they land.
import type { WebGLRenderer } from 'three';
import { IS_DEV, DEBUG } from '../core/constants';

type Api = Record<string, unknown> & {
  gl(): WebGLRenderer | null;
  fps(): number;
  info(): { drawCalls: number; triangles: number; textures: number; geometries: number; programs: number } | null;
  register(ns: string, api: Record<string, unknown>): void;
};

let renderer: WebGLRenderer | null = null;
let frames = 0;
let fps = 0;
let last = performance.now();

function tick() {
  frames++;
  const now = performance.now();
  if (now - last >= 500) {
    fps = (frames * 1000) / (now - last);
    frames = 0;
    last = now;
  }
  requestAnimationFrame(tick);
}

export const debugEnabled = IS_DEV || DEBUG;

const api: Api = {
  fps: () => Math.round(fps * 10) / 10,
  info: () => (renderer ? snapshot : null),
  gl: () => renderer,
  register(ns, value) {
    api[ns] = { ...(api[ns] as object | undefined), ...value };
  },
};

/** Top-level QA functions (brief §18 contract: __G1__.setShip(...) etc.). */
export function registerDebugFn(name: string, fn: (...args: never[]) => unknown): void {
  if (debugEnabled) api[name] = fn;
}

export function installDebugApi(): void {
  if (!debugEnabled) return;
  (window as unknown as { __G1__: Api }).__G1__ = api;
  requestAnimationFrame(tick);
}

export function registerRenderer(gl: WebGLRenderer): void {
  renderer = gl;
  // The composer renders several passes per frame, so renderer.info must not
  // auto-reset per render() call: PostFX brackets each frame with
  // frameInfoBegin/End and info() returns the last complete frame.
  gl.info.autoReset = false;
}

let snapshot: ReturnType<Api['info']> = null;

export function frameInfoBegin(gl: WebGLRenderer): void {
  gl.info.reset();
}

export function frameInfoEnd(gl: WebGLRenderer): void {
  const i = gl.info;
  snapshot = {
    drawCalls: i.render.calls,
    triangles: i.render.triangles,
    textures: i.memory.textures,
    geometries: i.memory.geometries,
    programs: i.programs?.length ?? 0,
  };
}

export function registerDebug(ns: string, value: Record<string, unknown>): void {
  if (debugEnabled) api.register(ns, value);
}
