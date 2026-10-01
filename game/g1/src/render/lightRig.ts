// Shared light registry (Phase 2, brief §4 rule 3: constant light rig). Every
// light in the scene exists from boot (the light count/type is part of every
// program key: adding one recompiles everything). The mission does not add
// lights: it BORROWS the studio and cockpit rigs while it is live — writing
// positions / colours / intensities (uniforms only) — and restores them on
// exit. Components register their lights here once mounted.
import type { HemisphereLight, Light, Object3D, PointLight, SpotLight, DirectionalLight } from 'three';

export type RigRole = 'key' | 'rimA' | 'rimB' | 'hemi' | 'cockpitKey' | 'cockpitDash' | 'target';

type Saved = { pos: [number, number, number]; color: number; intensity: number; ground?: number; angle?: number; penumbra?: number; distance?: number };

const lights = new Map<RigRole, Light | Object3D>();
const saved = new Map<RigRole, Saved>();
let borrowed = false;

export const lightRig = {
  register(role: RigRole, o: Light | Object3D | null): void {
    if (o) lights.set(role, o);
  },
  get<T extends Light | Object3D>(role: RigRole): T | null {
    return (lights.get(role) as T) ?? null;
  },
  get borrowed(): boolean {
    return borrowed;
  },
  /** snapshot every registered light; the mission now owns them */
  borrow(): void {
    if (borrowed) return;
    borrowed = true;
    for (const [role, o] of lights) {
      const l = o as Light & Partial<SpotLight & HemisphereLight & PointLight>;
      saved.set(role, {
        pos: [o.position.x, o.position.y, o.position.z],
        color: (l as Light).color?.getHex?.() ?? 0,
        intensity: (l as Light).intensity ?? 0,
        ground: (l as HemisphereLight).groundColor?.getHex?.(),
        angle: (l as SpotLight).angle,
        penumbra: (l as SpotLight).penumbra,
        distance: (l as PointLight).distance,
      });
    }
  },
  /** put every light back exactly as the hangar / cockpit left it */
  restore(): void {
    if (!borrowed) return;
    for (const [role, o] of lights) {
      const s = saved.get(role);
      if (!s) continue;
      const l = o as Light & Partial<SpotLight & HemisphereLight & PointLight & DirectionalLight>;
      o.position.set(s.pos[0], s.pos[1], s.pos[2]);
      if ((l as Light).color) (l as Light).color.setHex(s.color);
      if ((l as Light).isLight) (l as Light).intensity = s.intensity;
      if (s.ground !== undefined && (l as HemisphereLight).groundColor) (l as HemisphereLight).groundColor.setHex(s.ground);
      if (s.angle !== undefined) (l as SpotLight).angle = s.angle;
      if (s.penumbra !== undefined) (l as SpotLight).penumbra = s.penumbra;
      if (s.distance !== undefined) (l as PointLight).distance = s.distance;
      o.updateMatrixWorld();
    }
    borrowed = false;
  },
};
