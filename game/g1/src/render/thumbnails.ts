// Offscreen ship thumbnails for the hangar selector (brief §10: 304x192 @2x).
// Rendered with the MAIN renderer (no second context: that would recompile
// every ship program) into a HalfFloat MSAA target, tone-mapped (AgX, same as
// the post chain) by a fullscreen pass into an 8-bit target, read back and
// encoded as PNG blob URLs. One ship per idle slot; cached per ship/livery/
// lock state. `silhouette` renders flat black on white for the §10
// silhouette test.
import {
  Box3,
  Color,
  DirectionalLight,
  HalfFloatType,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  NoToneMapping,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Sphere,
  UnsignedByteType,
  Vector3,
  WebGLRenderTarget,
} from 'three';
import { ShipFactory } from '../ships/ShipFactory';
import type { ShipId } from '../data/ships';
import { whenWorldMounted } from '../scenes/sceneBridge';
import { HEX } from './palette';
import { bakeClient } from '../workers/bakeClient';
import { safeCompileAsync } from './compile';

export const THUMB = { w: 304, h: 192, dpr: 2 } as const;
const FILL = 0.9; // box corners are conservative; the hull itself lands ~0.8

export type ThumbOptions = { livery?: number; locked?: boolean; silhouette?: boolean };

const cache = new Map<string, Promise<string>>();
let queue: Promise<unknown> = Promise.resolve();

const tonemap = new ShaderMaterial({
  uniforms: { tSrc: { value: null }, toneMappingExposure: { value: 1 }, uRaw: { value: 0 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: /* glsl */ `
    #include <tonemapping_pars_fragment>
    uniform sampler2D tSrc;
    uniform float uRaw; // silhouettes: exact black/white, no tone curve
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tSrc, vUv);
      // MSAA edges resolve premultiplied; canvas ImageData is straight alpha
      vec3 m = uRaw > 0.5 ? c.rgb : AgXToneMapping(c.rgb / max(c.a, 1e-4));
      gl_FragColor = vec4(sRGBTransferOETF(vec4(m, 1.0)).rgb, clamp(c.a, 0.0, 1.0));
    }`,
  depthTest: false,
  depthWrite: false,
});

/** Blob URL of a ship thumbnail (queued: one render at a time). */
export function shipThumbnail(id: ShipId, opts: ThumbOptions = {}): Promise<string> {
  const key = `${id}:${opts.livery ?? 0}:${opts.locked ? 1 : 0}:${opts.silhouette ? 1 : 0}`;
  let p = cache.get(key);
  if (!p) {
    // the queue itself never rejects (one failed render must not skip every
    // later one); a failure is not cached, so the next request retries. three's
    // async readback rejects with NO reason when its fence fails (context
    // lost): give callers a real Error.
    const job = queue.then(() => render(id, opts));
    queue = job.catch(() => undefined);
    p = job.catch(err => {
      cache.delete(key);
      throw err instanceof Error ? err : new Error('thumbnail render failed (graphics context lost?)');
    });
    cache.set(key, p);
  }
  return p;
}

export function clearThumbnails(): void {
  for (const p of cache.values()) void p.then(url => URL.revokeObjectURL(url), () => undefined);
  cache.clear();
}

async function render(id: ShipId, opts: ThumbOptions): Promise<string> {
  const { gl, scene: world } = await whenWorldMounted();
  const W = THUMB.w * THUMB.dpr, H = THUMB.h * THUMB.dpr;
  const ship = ShipFactory.build(id, { livery: opts.livery, lod: 1, hologram: opts.locked && !opts.silhouette });
  ship.update(1.2);

  const scene = new Scene();
  scene.add(ship.group);
  if (opts.silhouette) {
    scene.background = new Color('#ffffff');
    scene.overrideMaterial = new MeshBasicMaterial({ color: '#000000' });
  } else {
    scene.environment = world.environment;
    scene.environmentIntensity = world.environmentIntensity;
    const key = new DirectionalLight('#ffe9d8', 2.2);
    key.position.set(-6, 9, 10);
    const rim = new DirectionalLight(HEX.nebula, 1.4);
    rim.position.set(8, 3, -10);
    scene.add(key, rim, new HemisphereLight('#8c9ac0', '#080b18', 0.25));
  }

  // 3/4 front framing: start from the bounding sphere, then tighten until the
  // projected box corners fill FILL of the frame
  const box = new Box3().setFromObject(ship.group);
  const sphere = box.getBoundingSphere(new Sphere());
  const cam = new PerspectiveCamera(26, W / H, 0.1, 400);
  const dir = new Vector3(-0.78, 0.42, 1).normalize();
  let dist = sphere.radius / Math.sin((cam.fov * Math.PI) / 360);
  const corners = [0, 1, 2, 3, 4, 5, 6, 7].map(i => new Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z));
  const v = new Vector3();
  for (let pass = 0; pass < 3; pass++) {
    cam.position.copy(sphere.center).addScaledVector(dir, dist);
    cam.lookAt(sphere.center);
    cam.updateMatrixWorld();
    let ext = 0;
    for (const c of corners) {
      v.copy(c).project(cam);
      ext = Math.max(ext, Math.abs(v.x), Math.abs(v.y));
    }
    dist *= ext / FILL;
  }
  cam.position.copy(sphere.center).addScaledVector(dir, dist);
  cam.lookAt(sphere.center);
  cam.updateMatrixWorld();

  const hdrRT = new WebGLRenderTarget(W, H, { type: HalfFloatType, samples: 4 });
  const ldrRT = new WebGLRenderTarget(W, H, { type: UnsignedByteType });
  const prev = { target: gl.getRenderTarget(), color: gl.getClearColor(new Color()), alpha: gl.getClearAlpha(), tm: gl.toneMapping, autoClear: gl.autoClear };
  try {
    gl.setRenderTarget(hdrRT); // compile the HalfFloat variants (see bootLoader)
    await safeCompileAsync(gl, scene, cam);
    gl.setRenderTarget(prev.target);
    gl.toneMapping = NoToneMapping;
    gl.autoClear = true;
    gl.setClearColor(0x000000, 0);
    gl.setRenderTarget(hdrRT);
    gl.render(scene, cam);
    tonemap.uniforms.tSrc.value = hdrRT.texture;
    tonemap.uniforms.uRaw.value = opts.silhouette ? 1 : 0;
    gl.setRenderTarget(ldrRT);
    await safeCompileAsync(gl, quadScene(), quadCam);
    // frames ran during the await: re-bind the target + clear state
    gl.setRenderTarget(ldrRT);
    gl.setClearColor(0x000000, 0);
    gl.render(quadScene(), quadCam);
    const px = new Uint8Array(W * H * 4);
    // async (PBO + fence) readback: the sync read stalled ~70 ms per thumbnail
    await gl.readRenderTargetPixelsAsync(ldrRT, 0, 0, W, H, px);
    if (typeof OffscreenCanvas !== 'undefined') return URL.createObjectURL(await bakeClient.png(px, W, H));
    return await encode(px, W, H);
  } finally {
    gl.setRenderTarget(prev.target);
    gl.setClearColor(prev.color, prev.alpha);
    gl.toneMapping = prev.tm;
    gl.autoClear = prev.autoClear;
    hdrRT.dispose();
    ldrRT.dispose();
    (scene.overrideMaterial as MeshBasicMaterial | null)?.dispose();
    ship.dispose();
  }
}

let quad: Scene | null = null;
const quadCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
function quadScene(): Scene {
  if (!quad) {
    quad = new Scene();
    const m = new Mesh(new PlaneGeometry(2, 2), tonemap);
    m.frustumCulled = false;
    quad.add(m);
  }
  return quad;
}

/** Main-thread fallback (no OffscreenCanvas): GL rows are bottom-up, flip while copying. */
async function encode(px: Uint8Array, W: number, H: number): Promise<string> {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  const row = W * 4;
  for (let y = 0; y < H; y++) img.data.set(px.subarray((H - 1 - y) * row, (H - y) * row), y * row);
  ctx.putImageData(img, 0, 0);
  const blob = await new Promise<Blob>((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('thumbnail encode failed'))), 'image/png'));
  return URL.createObjectURL(blob);
}

