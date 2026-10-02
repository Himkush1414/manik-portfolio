// Mission camera views (brief §8): the rig switcher's view changes applied to
// the scene — cockpit interior on / off (Phase 1 cockpit root riding the
// ship's eye, its lights brought up and placed each frame), the flown ship
// moved to the mirror-only layer while we sit inside it, smaller muzzle
// flashes, and the HUD layout flag (overlay vs diegetic). Layer / visibility
// flips happen only on a view change (no per-frame traversal; layers never
// recompile anything). Cycle Camera + Settings write `camera.mode`.
import type { Light, Object3D } from 'three';
import { Vector3 } from 'three';
import { mission } from './missionRuntime';
import { cockpitInMission, MIRROR_LAYER } from '../sceneBridge';
import { lightRig } from '../../render/lightRig';
import { useSettings } from '../../state/settings.store';
import { CAMERA_MODES, type CameraMode } from '../../render/cameraRig';
import { SPECS } from '../../ships/specs';
import { hudView } from '../../ui/screens/mission/hudView';
import { COCKPIT_LIGHTS } from '../../data/mission';

const _p = new Vector3();

function setShipLayer(o: Object3D | null, mirrorOnly: boolean): void {
  o?.traverse(c => (mirrorOnly ? c.layers.set(MIRROR_LAYER) : c.layers.set(0)));
}

/** the switcher's view callback: cockpit interior on / off */
export function applyCockpitView(on: boolean): void {
  cockpitInMission.on = on;
  setShipLayer(mission.ship?.group ?? null, on);
  mission.vfx?.setCockpitView(on);
  hudView.cockpit = on;
  // the cockpit-key directional is the WORLD SUN in missions (MissionWorld.applySun): only the dash
  // point is the cockpit's own light
  if (!on) {
    const l = lightRig.get<Light>('cockpitDash');
    if (l) l.intensity = 0;
  }
}

/** eye point of the flown ship (canopy centre, the Phase 1 cockpit convention) in attitude-group space */
export function setCockpitEye(shipId: keyof typeof SPECS): void {
  const c = SPECS[shipId].canopy;
  mission.rig.cockpit.setEye(0, c.y + c.h * 0.55, -(c.z0 + c.z1) / 2);
}

/** Per frame while the cockpit interior is shown: the dash point follows the eye (the sun lights the
 *  rest of the cockpit through the canopy). */
export function updateCockpitLights(dashPower: number): void {
  const root = cockpitInMission.root;
  if (!cockpitInMission.on || !root) return;
  const L = COCKPIT_LIGHTS;
  const dash = lightRig.get<Light>('cockpitDash');
  if (dash) {
    dash.position.copy(root.localToWorld(_p.set(L.dash[0], L.dash[1], L.dash[2])));
    dash.intensity = L.dashBase + L.dashPower * dashPower;
  }
}

/** The rig a saved mode flies with: the cockpit view needs the Phase 1 cockpit root
 *  (registered by <Cockpit/>); until it exists the cockpit setting flies third person. */
export function missionMode(mode: CameraMode): CameraMode {
  return mode === 'cockpit' && !cockpitInMission.root ? 'third' : mode;
}

/** Cycle Camera (binding) while flying: writes the setting; `followCameraSetting` blends the rig */
export function cycleCamera(): void {
  const cur = useSettings.getState().camera.mode;
  const next = CAMERA_MODES[(CAMERA_MODES.indexOf(cur) + 1) % CAMERA_MODES.length] as CameraMode;
  useSettings.getState().setCameraMode(next);
}

/** While the mission frame is live: `camera.mode` changes (Cycle Camera, Settings) blend the
 *  rig over RIGS.blend. Returns the unsubscribe. */
export function followCameraSetting(): () => void {
  let last = useSettings.getState().camera.mode;
  return useSettings.subscribe(s => {
    if (s.camera.mode === last) return;
    last = s.camera.mode;
    mission.rig.set(missionMode(last));
  });
}
