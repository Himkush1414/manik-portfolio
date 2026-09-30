// Bake worker: all heavy CPU work of the boot (procedural texture sets, decal
// erosion, ship geometry) runs here so the boot sequence never stalls the
// main thread (brief §6: no long task > 50 ms; §8: zero hitch).
import { computeMetalSet, erodeData, type MetalSetOptions } from '../render/tex/bakeData';
import { buildShipGeometry, serializeShipGeometry, type Lod } from '../ships/geometry';
import { SPECS } from '../ships/specs';
import type { ShipId } from '../data/ships';

export type BakeRequest =
  | { id: number; type: 'metal'; opts: MetalSetOptions }
  | { id: number; type: 'erode'; data: Uint8ClampedArray; width: number; rects: { x: number; y: number; w: number; h: number; amount: number }[] }
  | { id: number; type: 'ship'; ship: ShipId; lod: Lod };

const post = (msg: unknown, transfer: Transferable[] = []) => (self as unknown as Worker).postMessage(msg, transfer);

self.onmessage = (e: MessageEvent<BakeRequest>) => {
  const req = e.data;
  try {
    if (req.type === 'metal') {
      const m = computeMetalSet(req.opts);
      post({ id: req.id, ok: true, result: m }, [m.albedo.buffer, m.orm.buffer, m.normal.buffer]);
    } else if (req.type === 'erode') {
      erodeData(req.data, req.width, req.rects);
      post({ id: req.id, ok: true, result: req.data }, [req.data.buffer]);
    } else if (req.type === 'ship') {
      const g = buildShipGeometry(SPECS[req.ship], req.lod);
      const { data, transfer } = serializeShipGeometry(g);
      post({ id: req.id, ok: true, result: data }, transfer);
    }
  } catch (err) {
    post({ id: req.id, ok: false, error: String(err) });
  }
};
