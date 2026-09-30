// What the UI may ask the 3D hangar (read-only): world positions of the pad
// ship's hardpoints (Upgrades callouts). ShipDisplay registers the live ship.
import { Vector3, type Group } from 'three';
import type { Hardpoint } from '../../ships/types';

let current: { group: Group; hardpoints: Hardpoint[] } | null = null;

export function setBridgeShip(s: typeof current): void {
  current = s;
}

/** World-space positions of every hardpoint of `kind` on the pad ship. */
export function hardpointWorld(kind: Hardpoint['kind'], out: Vector3[] = []): Vector3[] {
  out.length = 0;
  if (!current) return out;
  current.group.updateWorldMatrix(true, false);
  for (const h of current.hardpoints) if (h.kind === kind) out.push(new Vector3(...h.pos).applyMatrix4(current.group.matrixWorld));
  return out;
}
