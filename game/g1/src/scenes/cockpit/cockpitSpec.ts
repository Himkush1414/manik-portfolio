// Cockpit layout (brief §15). One master cockpit, three parametric variants
// mapped from the ship class (data/ships.ts `cockpit`). Cockpit-local space:
// the pilot's eye at the origin, forward -z, up +y, metres.
export type CockpitVariant = 'light' | 'medium' | 'heavy';

export type CockpitSpec = {
  canopy: { w: number; h: number; sill: number; len: number; bowZ: number };
  dash: { z: number; y: number; w: number; h: number; tilt: number };
  console: { x: number; y: number; z0: number; z1: number; w: number };
};

export const COCKPIT: Record<CockpitVariant, CockpitSpec> = {
  light: {
    canopy: { w: 0.5, h: 0.4, sill: -0.13, len: 1.05, bowZ: -0.66 },
    dash: { z: -0.74, y: -0.38, w: 0.86, h: 0.3, tilt: 0.34 },
    console: { x: 0.42, y: -0.5, z0: -0.1, z1: -0.62, w: 0.16 },
  },
  medium: {
    canopy: { w: 0.56, h: 0.44, sill: -0.14, len: 1.1, bowZ: -0.7 },
    dash: { z: -0.78, y: -0.38, w: 0.96, h: 0.32, tilt: 0.32 },
    console: { x: 0.47, y: -0.52, z0: -0.1, z1: -0.66, w: 0.18 },
  },
  heavy: {
    canopy: { w: 0.62, h: 0.47, sill: -0.16, len: 1.15, bowZ: -0.74 },
    dash: { z: -0.82, y: -0.4, w: 1.06, h: 0.36, tilt: 0.3 },
    console: { x: 0.52, y: -0.54, z0: -0.1, z1: -0.7, w: 0.2 },
  },
};

/** Camera pitch in the cockpit (rad): slightly down so hands + thighs frame the shot. */
export const EYE_PITCH = -0.1;

/** Mirror layout (cockpit-local): centre above the dash, two on the canopy bow. */
export const MIRRORS = [
  { id: 'centre', pos: [0, 0.2, -0.68] as const, w: 0.3, h: 0.075, rt: [512, 256] as const, yaw: 0 },
  { id: 'left', pos: [-0.36, 0.13, -0.6] as const, w: 0.11, h: 0.065, rt: [256, 160] as const, yaw: -0.5 },
  { id: 'right', pos: [0.36, 0.13, -0.6] as const, w: 0.11, h: 0.065, rt: [256, 160] as const, yaw: 0.5 },
];
