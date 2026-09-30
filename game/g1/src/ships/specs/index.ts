// Spec registry. Ships not yet authored fall back loudly (never silently).
import type { ShipSpec } from '../types';
import type { ShipId } from '../../data/ships';
import { HALCYON } from './halcyon';

const REGISTRY: Partial<Record<ShipId, ShipSpec>> = { halcyon: HALCYON };

export const SPECS = new Proxy(REGISTRY as Record<ShipId, ShipSpec>, {
  get(target, key: string) {
    const spec = target[key as ShipId];
    if (!spec) throw new Error(`ShipSpec "${key}" is not authored yet`);
    return spec;
  },
});

export function hasSpec(id: ShipId): boolean {
  return !!REGISTRY[id];
}
