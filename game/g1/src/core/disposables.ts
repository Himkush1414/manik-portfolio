// Ownership registry for GPU/audio/listener resources. Every scene creates one
// and calls dispose() on unmount, so hangar<->cockpit round trips stay flat.
import type { Object3D, Material, BufferGeometry, Texture, WebGLRenderTarget } from 'three';

type Disposable = { dispose(): void };

export class Disposables {
  private items = new Set<Disposable>();
  private fns = new Set<() => void>();

  add<T extends Disposable>(item: T): T {
    this.items.add(item);
    return item;
  }

  /** Arbitrary cleanup (listeners, GSAP contexts, audio nodes). */
  defer(fn: () => void): void {
    this.fns.add(fn);
  }

  /** Walks an object tree and registers every geometry/material/texture. */
  track(root: Object3D): Object3D {
    root.traverse(obj => {
      const mesh = obj as Object3D & { geometry?: BufferGeometry; material?: Material | Material[] };
      if (mesh.geometry) this.items.add(mesh.geometry);
      const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      for (const m of mats) {
        this.items.add(m);
        for (const value of Object.values(m)) {
          if (value && (value as Texture).isTexture) this.items.add(value as Texture);
        }
      }
    });
    return root;
  }

  target(rt: WebGLRenderTarget): WebGLRenderTarget {
    this.items.add(rt);
    return rt;
  }

  dispose(): void {
    for (const fn of this.fns) {
      try {
        fn();
      } catch {
        /* cleanup must never throw past this point */
      }
    }
    for (const item of this.items) item.dispose();
    this.fns.clear();
    this.items.clear();
  }
}
