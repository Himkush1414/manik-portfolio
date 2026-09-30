// Main-thread client for the bake worker (single instance, promise per request).
import type { MetalSetData, MetalSetOptions } from '../render/tex/bakeData';
import type { ShipGeometryData, Lod } from '../ships/geometry';
import type { ShipId } from '../data/ships';

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, Pending>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./bake.worker.ts', import.meta.url), { type: 'module', name: 'g1-bake' });
  worker.onmessage = (e: MessageEvent<{ id: number; ok: boolean; result?: unknown; error?: string }>) => {
    const p = pending.get(e.data.id);
    if (!p) return;
    pending.delete(e.data.id);
    if (e.data.ok) p.resolve(e.data.result);
    else p.reject(new Error(e.data.error));
  };
  worker.onerror = e => {
    for (const p of pending.values()) p.reject(new Error(e.message));
    pending.clear();
  };
  return worker;
}

function call<T>(msg: Record<string, unknown>, transfer: Transferable[] = []): Promise<T> {
  const id = ++seq;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    getWorker().postMessage({ ...msg, id }, transfer);
  });
}

export const bakeClient = {
  metal: (opts: MetalSetOptions) => call<MetalSetData>({ type: 'metal', opts }),
  erode: (data: Uint8ClampedArray, width: number, rects: { x: number; y: number; w: number; h: number; amount: number }[]) =>
    call<Uint8ClampedArray>({ type: 'erode', data, width, rects }, [data.buffer]),
  shipGeometry: (ship: ShipId, lod: Lod) => call<ShipGeometryData>({ type: 'ship', ship, lod }),
  /** bottom-up RGBA pixels -> PNG blob (row flip + encode off the main thread) */
  png: (px: Uint8Array, w: number, h: number) => call<Blob>({ type: 'png', px, w, h }, [px.buffer]),
};
