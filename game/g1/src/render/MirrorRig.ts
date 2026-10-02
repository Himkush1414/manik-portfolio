// MirrorRig (brief §19 handoff): N rear-facing cameras rendered into their own
// HalfFloat targets at a capped rate, with a PLUGGABLE scene source (Phase 1:
// the launch bay; Phase 2: the live wormhole). The rig owns cameras + targets;
// whoever displays the textures (cockpit mirror surfaces) is separate.
//   const rig = new MirrorRig([{ size: [512, 256], fov: 34 }, ...]);
//   rig.setSource(scene); rig.attach(parent);  per frame: rig.render(gl, dt)
import { HalfFloatType, PerspectiveCamera, Vector3, Vector4, WebGLRenderTarget, type Object3D, type Texture, type WebGLRenderer } from 'three';

export type MirrorDef = {
  size: readonly [number, number];
  fov: number;
  aspect?: number;
  /** camera position + look target in the parent's local space */
  pos: readonly [number, number, number];
  look: readonly [number, number, number];
  layers?: number[];
};

const _v = new Vector3();

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
  /** shared mode: ONE wide rear camera + target covering every mirror's view; each mirror samples
   *  its UV window (x0, y0, w, h) of it. One pass instead of N (the per-pass cost dominated on the
   *  integrated GPU); the parallax between mirror positions is dropped (the world is far). */
  readonly sharedCamera: PerspectiveCamera;
  readonly sharedTarget: WebGLRenderTarget;
  readonly windows: Vector4[];
  private shared = false;
  /** shared-frustum half extents in tangent space (x, y), and the centre mirror's (sizing) */
  private sharedTan = [1, 1];
  private firstTan = [1, 1];

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
    // shared camera at the first (centre) mirror, looking where it looks; its symmetric frustum is the
    // union of every mirror's corner rays (tangent space), each mirror's window is its ray box in it
    const c0 = this.cameras[0];
    const inv = c0.quaternion.clone().invert();
    const boxes = defs.map((_d, i) => {
      const cam = this.cameras[i];
      const ty = Math.tan((cam.fov * Math.PI) / 360), tx = ty * cam.aspect;
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const v = _v.set(sx * tx, sy * ty, -1).applyQuaternion(cam.quaternion).applyQuaternion(inv);
        const px = v.x / -v.z, py = v.y / -v.z;
        x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
      }
      return [x0, x1, y0, y1];
    });
    const TX = Math.max(...boxes.map(b => Math.max(-b[0], b[1]))) * 1.02;
    const TY = Math.max(...boxes.map(b => Math.max(-b[2], b[3]))) * 1.02;
    this.sharedTan = [TX, TY];
    this.firstTan = [(boxes[0][1] - boxes[0][0]) / 2, (boxes[0][3] - boxes[0][2]) / 2];
    this.windows = boxes.map(([x0, x1, y0, y1]) => new Vector4(0.5 + x0 / (2 * TX), 0.5 + y0 / (2 * TY), (x1 - x0) / (2 * TX), (y1 - y0) / (2 * TY)));
    this.sharedCamera = new PerspectiveCamera((Math.atan(TY) * 360) / Math.PI, TX / TY, 0.1, 900);
    this.sharedCamera.position.copy(c0.position);
    this.sharedCamera.quaternion.copy(c0.quaternion);
    this.sharedCamera.layers.mask = c0.layers.mask;
    // no MSAA: on the UHD 770 (MEDIUM) the multisampled HalfFloat resolve was most of the cost
    // (5.3 -> 0.8 ms per frame); the surfaces' barrel + scanlines hide the difference
    this.sharedTarget = new WebGLRenderTarget(...this.sharedSize(defs[0].size), { type: HalfFloatType, samples: 0 });
  }

  /** shared target size for a given centre-mirror size: the same pixel density over the wider frustum */
  private sharedSize(first: readonly [number, number]): [number, number] {
    return [Math.round((first[0] * this.sharedTan[0]) / this.firstTan[0]), Math.round((first[1] * this.sharedTan[1]) / this.firstTan[1])];
  }

  /** Shared mode on / off (see `sharedCamera`). */
  setShared(on: boolean): void {
    this.shared = on;
  }

  get isShared(): boolean {
    return this.shared;
  }

  get textures(): Texture[] {
    return this.targets.map(t => t.texture);
  }

  /** What the cameras see (layer numbers); e.g. the mission's reduced mirror set. */
  setLayers(layers: readonly number[]): void {
    for (const cam of [...this.cameras, this.sharedCamera]) {
      cam.layers.disableAll();
      layers.forEach(l => cam.layers.enable(l));
    }
  }

  /** Re-size every target (quality preset change); one [w, h] per mirror. */
  resize(sizes: readonly (readonly [number, number])[]): void {
    sizes.forEach(([w, h], i) => this.targets[i]?.setSize(w, h));
    if (sizes[0]) this.sharedTarget.setSize(...this.sharedSize(sizes[0]));
  }

  /** What the mirrors see (any Object3D; usually the main scene). */
  setSource(source: Object3D | null): void {
    this.source = source;
  }

  /** Parent the cameras (e.g. to the cockpit root) so they ride along. */
  attach(parent: Object3D): void {
    this.cameras.forEach(c => parent.add(c));
    parent.add(this.sharedCamera);
  }

  detach(): void {
    this.cameras.forEach(c => c.removeFromParent());
    this.sharedCamera.removeFromParent();
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
    if (this.shared) {
      this.sharedCamera.updateMatrixWorld();
      gl.setRenderTarget(this.sharedTarget);
      gl.clear();
      gl.render(this.source as never, this.sharedCamera);
    } else
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
    this.sharedTarget.dispose();
  }
}
