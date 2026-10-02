// Program compile + texture upload as small steps (brief §4 rules 2 + 4).
// renderer.compile() on a whole subtree links every new program and uploads
// nothing; compiling it in one go was a ~45 ms task at the cockpit pre-warm.
// Here each distinct (material, object kind) is compiled on its own step
// against an HDR target (program variants are keyed on the output colour
// space — DEV_NOTES §8), then the parallel link is awaited by polling, then
// every texture the materials reference is uploaded one per step.
import { WAIT } from '../core/slicer';
import { HalfFloatType, MeshBasicMaterial, PerspectiveCamera, Scene, WebGLRenderTarget, type Camera, type Material, type Mesh, type Object3D, type Texture, type WebGLRenderer } from 'three';

type Props = { get(m: object): { currentProgram?: { isReady(): boolean } } };

const TEX_KEYS = ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'bumpMap', 'aoMap', 'alphaMap', 'clearcoatNormalMap', 'envMap', 'lightMap', 'displacementMap'] as const;

function materialsOf(o: Object3D): Material[] {
  const m = (o as Mesh).material as Material | Material[] | undefined;
  return !m ? [] : Array.isArray(m) ? m : [m];
}

/** Variant key: the same material on a plain vs instanced/skinned object compiles separately. */
function kindOf(o: Object3D): string {
  const x = o as Object3D & { isInstancedMesh?: boolean; isSkinnedMesh?: boolean; isPoints?: boolean; isLine?: boolean };
  return x.isInstancedMesh ? 'i' : x.isSkinnedMesh ? 's' : x.isPoints ? 'p' : x.isLine ? 'l' : 'm';
}

/**
 * Steps: compile one representative object per (material, kind), wait for the
 * parallel links, upload each referenced texture. `scene` supplies the lights.
 */
export function* compileSteps(gl: WebGLRenderer, roots: Object3D[], camera: Camera, scene: Scene): Generator<unknown, void, void> {
  const reps: Object3D[] = [];
  const seen = new Set<string>();
  const textures = new Set<Texture>();
  const mats = new Set<Material>();
  for (const root of roots) {
    root.traverse(o => {
      for (const m of materialsOf(o)) {
        const key = m.uuid + kindOf(o);
        if (!seen.has(key)) {
          seen.add(key);
          reps.push(o);
        }
        mats.add(m);
        for (const k of TEX_KEYS) {
          const t = (m as unknown as Record<string, Texture | null | undefined>)[k];
          if (t && t.isTexture) textures.add(t);
        }
        const u = (m as unknown as { uniforms?: Record<string, { value: unknown }> }).uniforms;
        if (u) for (const v of Object.values(u)) if (v && (v.value as Texture)?.isTexture) textures.add(v.value as Texture);
      }
    });
  }
  yield;
  const probe = new WebGLRenderTarget(4, 4, { type: HalfFloatType });
  try {
    for (const o of reps) {
      const mask = camera.layers.mask;
      camera.layers.enableAll();
      const prev = gl.getRenderTarget();
      gl.setRenderTarget(probe);
      try {
        gl.compile(o, camera, scene);
      } finally {
        gl.setRenderTarget(prev);
        camera.layers.mask = mask;
      }
      yield;
    }
    // KHR_parallel_shader_compile: wait (without blocking) until every link is done
    const props = (gl as unknown as { properties: Props }).properties;
    const pending = new Set(mats);
    const t0 = performance.now();
    while (pending.size && performance.now() - t0 < 8000) {
      for (const m of Array.from(pending)) {
        const p = props.get(m)?.currentProgram;
        if (!p || p.isReady()) pending.delete(m);
      }
      if (pending.size) yield WAIT;
    }
    for (const t of textures) {
      gl.initTexture(t);
      yield;
    }
  } finally {
    probe.dispose();
  }
}

/** shared by every upload pass: its few program variants (mesh / instanced / points / lines) compile once */
let uploadMat: MeshBasicMaterial | null = null;

/**
 * Geometry buffer upload as steps (compile() uploads none). Each root is drawn
 * once into a 1x1 target with frustum culling off, every layer enabled and an
 * override material, so a mesh first framed mid-mission (a mirror camera, the
 * cockpit eye's head inertia) never uploads its buffers then. Roots are lent
 * to a scratch scene for the draw and handed straight back.
 */
export function* uploadSteps(gl: WebGLRenderer, roots: (Object3D | null)[]): Generator<unknown, void, void> {
  uploadMat ??= new MeshBasicMaterial();
  const warm = new Scene();
  warm.overrideMaterial = uploadMat;
  const cam = new PerspectiveCamera();
  cam.layers.enableAll();
  const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType });
  try {
    for (const root of roots) {
      if (!root) continue;
      const parent = root.parent, vis = root.visible;
      const culled: Object3D[] = [];
      root.traverse(o => {
        if (o.frustumCulled) {
          o.frustumCulled = false;
          culled.push(o);
        }
      });
      root.visible = true;
      warm.add(root);
      const prev = gl.getRenderTarget();
      try {
        gl.setRenderTarget(target);
        gl.render(warm, cam);
      } finally {
        gl.setRenderTarget(prev);
        warm.remove(root);
        parent?.add(root);
        root.visible = vis;
        for (const o of culled) o.frustumCulled = true;
      }
      yield;
    }
  } finally {
    target.dispose();
  }
}
