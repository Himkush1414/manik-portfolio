// MirrorRig (brief §19 handoff): N rear-facing cameras rendered into their own
// HalfFloat targets at a capped rate, with a PLUGGABLE scene source (Phase 1:
// the launch bay; Phase 2: the live wormhole). The rig owns cameras + targets;
// whoever displays the textures (cockpit mirror surfaces) is separate.
//   const rig = new MirrorRig([{ size: [512, 256], fov: 34 }, ...]);
//   rig.setSource(scene); rig.attach(parent);  per frame: rig.render(gl, dt)
import { HalfFloatType, PerspectiveCamera, WebGLRenderTarget, type Object3D, type Texture, type WebGLRenderer } from 'three';

export type MirrorDef = {
  size: readonly [number, number];
  fov: number;
  aspect?: number;
  /** camera position + look target in the parent's local space */
  pos: readonly [number, number, number];
  look: readonly [number, number, number];
  layers?: number[];
};

export class MirrorRig {
  readonly cameras: PerspectiveCamera[];
  readonly targets: WebGLRenderTarget[];
  private source: Object3D | null = null;
  private acc = 0;
  /** frames per second the mirrors refresh at (brief: 30; LOW preset: 20) */
  fps = 30;
  enabled = true;
  /** refreshes so far (QA: proves the mirrors are live, and idle outside the cockpit) */
  renders = 0;

  constructor(defs: MirrorDef[]) {
    this.targets = defs.map(d => new WebGLRenderTarget(d.size[0], d.size[1], { type: HalfFloatType, samples: 2 }));
    this.cameras = defs.map(d => {
      const cam = new PerspectiveCamera(d.fov, d.aspect ?? d.size[0] / d.size[1], 0.1, 900);
      cam.layers.set(0);
      (d.layers ?? []).forEach(l => cam.layers.enable(l));
      cam.position.set(...d.pos);
      cam.lookAt(...d.look);
      return cam;
    });
  }

  get textures(): Texture[] {
    return this.targets.map(t => t.texture);
  }

  /** Re-size every target (quality preset change); one [w, h] per mirror. */
  resize(sizes: readonly (readonly [number, number])[]): void {
    sizes.forEach(([w, h], i) => this.targets[i]?.setSize(w, h));
  }

  /** What the mirrors see (any Object3D; usually the main scene). */
  setSource(source: Object3D | null): void {
    this.source = source;
  }

  /** Parent the cameras (e.g. to the cockpit root) so they ride along. */
  attach(parent: Object3D): void {
    this.cameras.forEach(c => parent.add(c));
  }

  detach(): void {
    this.cameras.forEach(c => c.removeFromParent());
  }

  /** Renders every mirror if its refresh slot came up. Returns true when it rendered. */
  render(gl: WebGLRenderer, dt: number): boolean {
    if (!this.enabled || !this.source) return false;
    this.acc += dt;
    if (this.acc < 1 / this.fps - 0.002) return false;
    this.acc = 0;
    this.renders++;
    const prevTarget = gl.getRenderTarget();
    const prevShadow = gl.shadowMap.autoUpdate;
    gl.shadowMap.autoUpdate = false; // the key's shadow map is reused, not re-rendered per mirror
    this.cameras.forEach((cam, i) => {
      cam.updateMatrixWorld();
      gl.setRenderTarget(this.targets[i]);
      gl.clear();
      gl.render(this.source as never, cam);
    });
    gl.setRenderTarget(prevTarget);
    gl.shadowMap.autoUpdate = prevShadow;
    return true;
  }

  dispose(): void {
    this.detach();
    this.targets.forEach(t => t.dispose());
  }
}
