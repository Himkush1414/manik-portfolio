// World environment probe (Phase 2R §6 ENV PROBE): the world's sky (bodies,
// sun glow, ground bounce below the horizon) captured ONCE in prepare into a
// 256 cube and prefiltered to a PMREM in WORLD axes — the same size as the
// hangar's studio environment, so assigning it never changes a program key.
// Per frame the mission turns it into the path frame through
// scene.environmentRotation (a uniform). Ship, cockpit and terrain all take
// their sky ambient + reflections from it.
import { CubeCamera, Euler, HalfFloatType, Matrix4, Mesh, PMREMGenerator, Scene, WebGLCubeRenderTarget, type ShaderMaterial, type Texture, type WebGLRenderer, type WebGLRenderTarget } from 'three';
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
  private pmrem: WebGLRenderTarget | null = null;
  /** scene.environmentRotation while the mission runs (world env -> path frame) */
  readonly rotation = new Euler();
  private readonly m = new Matrix4();
  private readonly e = new Euler();

  get texture(): Texture | null {
    return this.pmrem?.texture ?? null;
  }

  /** render the sky in world axes (probe mode) into the cube and prefilter it */
  capture(gl: WebGLRenderer, sky: SkyDome): Texture {
    this.dispose();
    const cube = new WebGLCubeRenderTarget(ENV_PROBE_SIZE, { type: HalfFloatType });
    const cam = new CubeCamera(1, 20000, cube);
    const mat = sky.material.clone() as ShaderMaterial;
    mat.uniforms.uProbe.value = 1;
    mat.uniforms.uPathB = { value: mat.uniforms.uPathB.value.clone().identity() };
    const scene = new Scene();
    scene.add(new Mesh(sky.mesh.geometry, mat), cam);
    const prev = gl.getRenderTarget();
    cam.update(gl, scene);
    gl.setRenderTarget(prev);
    const gen = new PMREMGenerator(gl);
    this.pmrem = gen.fromCubemap(cube.texture);
    gen.dispose();
    mat.dispose();
    cube.dispose();
    return this.pmrem.texture;
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
    this.pmrem?.dispose();
    this.pmrem = null;
  }
}
