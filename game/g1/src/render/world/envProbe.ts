// World environment probe (Phase 2R §6 ENV PROBE; W2b keyframes): the world's
// sky (bodies, sun glow, ground bounce below the horizon) captured in prepare
// into a 256 cube and prefiltered to a PMREM in WORLD axes; as the time of day
// moves, it is RE-captured time-sliced (one cube face per frame, then the
// prefilter) into the spare of two ping-pong PMREMs and swapped in — the same size as the
// hangar's studio environment, so assigning it never changes a program key.
// Per frame the mission turns it into the path frame through
// scene.environmentRotation (a uniform). Ship, cockpit and terrain all take
// their sky ambient + reflections from it.
import { CubeCamera, Euler, HalfFloatType, Matrix4, Mesh, PMREMGenerator, Scene, WebGLCubeRenderTarget, type Camera, type ShaderMaterial, type Texture, type WebGLRenderer, type WebGLRenderTarget } from 'three';
import type { SkyDome } from './SkyDome';
import { missionSpace } from './missionSpace';

export const ENV_PROBE_SIZE = 256;

/** scene.environmentRotation for a world-axes environment seen from a frame with rows `r` = B^T */
export function envRotationFor(r: ArrayLike<number>, out: Euler, m = new Matrix4(), e = new Euler()): Euler {
  m.set(r[0], r[1], r[2], 0, r[3], r[4], r[5], 0, r[6], r[7], r[8], 0, 0, 0, 0, 1);
  e.setFromRotationMatrix(m, 'ZYX');
  return out.set(e.x, e.y, e.z, 'XYZ');
}

export class WorldEnvProbe {
  /** two PMREMs (ping-pong): the live one is scene.environment, the other takes the next capture */
  private targets: [WebGLRenderTarget | null, WebGLRenderTarget | null] = [null, null];
  private live = 0;
  /** persistent capture rig (built in prepare; nothing is allocated or compiled in play) */
  private cube: WebGLCubeRenderTarget | null = null;
  private cam: CubeCamera | null = null;
  private gen: PMREMGenerator | null = null;
  private scene: Scene | null = null;
  private mat: ShaderMaterial | null = null;
  /** time-sliced recapture: -1 idle, 0..5 = next cube face to render, 6 = prefilter + swap */
  private step = -1;
  /** a freshly prefiltered environment the mission should bind (taken once) */
  private fresh: Texture | null = null;
  /** completed recaptures since prepare (QA) */
  captures = 0;
  /** scene.environmentRotation while the mission runs (world env -> path frame) */
  readonly rotation = new Euler();
  private readonly m = new Matrix4();
  private readonly e = new Euler();

  get texture(): Texture | null {
    return this.targets[this.live]?.texture ?? null;
  }

  /** a recapture is in flight */
  get busy(): boolean {
    return this.step >= 0;
  }

  /**
   * Prepare: build the capture rig (the probe sky SHARES the live sky's uniforms, so a capture always
   * sees the current time of day; only uProbe / uPathB differ), render the sky in world axes and
   * prefilter it into BOTH ping-pong targets (allocating them + the generator's buffers now).
   */
  capture(gl: WebGLRenderer, sky: SkyDome): Texture {
    this.dispose();
    this.cube = new WebGLCubeRenderTarget(ENV_PROBE_SIZE, { type: HalfFloatType });
    this.cam = new CubeCamera(1, 20000, this.cube);
    this.mat = sky.material.clone() as ShaderMaterial;
    this.mat.uniforms = { ...sky.material.uniforms, uProbe: { value: 1 }, uPathB: { value: sky.material.uniforms.uPathB.value.clone().identity() } };
    this.scene = new Scene();
    this.scene.add(new Mesh(sky.mesh.geometry, this.mat), this.cam);
    const prev = gl.getRenderTarget();
    this.cam.update(gl, this.scene);
    gl.setRenderTarget(prev);
    this.gen = new PMREMGenerator(gl);
    this.targets = [this.gen.fromCubemap(this.cube.texture), this.gen.fromCubemap(this.cube.texture)];
    this.live = 0;
    this.step = -1;
    return this.texture!;
  }

  /** start a time-sliced recapture (ignored while one is in flight) */
  recapture(): void {
    if (this.cube && this.step < 0) this.step = 0;
  }

  /**
   * Per frame while a recapture is in flight: one cube face per frame, then the prefilter into the
   * spare target and the swap (the mission binds `takeFresh()`). Same size + format: binding it never
   * changes a program key.
   */
  advance(gl: WebGLRenderer): void {
    if (this.step < 0 || !this.cube || !this.cam || !this.scene || !this.gen) return;
    const prev = gl.getRenderTarget(), prevFace = gl.getActiveCubeFace(), prevMip = gl.getActiveMipmapLevel();
    if (this.step < 6) {
      gl.setRenderTarget(this.cube, this.step);
      gl.render(this.scene, this.cam.children[this.step] as Camera);
      this.step++;
    } else {
      const spare = 1 - this.live;
      this.gen.fromCubemap(this.cube.texture, this.targets[spare]!);
      this.live = spare;
      this.fresh = this.texture;
      this.step = -1;
      this.captures++;
    }
    gl.setRenderTarget(prev, prevFace, prevMip);
  }

  /** the environment to bind after a swap (null when nothing new) */
  takeFresh(): Texture | null {
    const t = this.fresh;
    this.fresh = null;
    return t;
  }

  /**
   * Per frame, after missionSpace.update: the shader turns local lookups into world ones with
   * envMapRotation = makeRotationFromEuler(-e) (three negates the angles). With order XYZ that is
   * R_ZYX(e)^T, so e = the ZYX angles of B^T and envMapRotation = B (local -> world).
   */
  update(): void {
    envRotationFor(missionSpace.r, this.rotation, this.m, this.e);
  }

  dispose(): void {
    for (const t of this.targets) t?.dispose();
    this.targets = [null, null];
    this.cube?.dispose();
    this.gen?.dispose();
    this.mat?.dispose();
    this.cube = null;
    this.cam = null;
    this.gen = null;
    this.mat = null;
    this.scene = null;
    this.step = -1;
    this.fresh = null;
  }
}
