// Query-param entry points (QA harness + dev). Idempotent.
//   ?boot=0          skip the boot sequence, land in the hangar
//   ?screen=doors    park the camera on the bay doors (seek via __G1__.doors)
// Default: the full boot sequence (flow stays in boot.black until it starts).
import { QUERY } from '../core/constants';
import { flow } from './flow';
import { setView, VIEWS } from '../render/cameraDirector';
import { bootDoors } from '../scenes/sceneBridge';
import { stage } from '../scenes/Stage';
import { bootFx } from '../scenes/boot/bootFxParams';
import { registerDebug } from '../debug/debugApi';
import { shipThumbnail, type ThumbOptions } from '../render/thumbnails';
import type { ShipId } from '../data/ships';
import { hangarCam } from '../scenes/hangar/hangarCamera';
import { turntable } from '../scenes/hangar/turntable';

let applied = false;

export type StartMode = 'boot' | 'hangar' | 'doors';

export function startMode(): StartMode {
  const screen = QUERY.get('screen');
  if (screen === 'doors') return 'doors';
  if (QUERY.get('boot') === '0' || (screen && screen !== 'boot')) return 'hangar';
  return 'boot';
}

export function applyStartParams(): void {
  if (applied) return;
  applied = true;
  registerDebug('doors', {
    seek: (t: number, mode: 'open' | 'close' = 'open') => bootDoors.seek(t, mode),
    open: (d?: number) => bootDoors.open(d),
    close: (d?: number) => bootDoors.close(d),
    state: () => ({ progress: bootDoors.progress, state: bootDoors.state }),
    view: (name: keyof typeof VIEWS) => setView(VIEWS[name]),
  });
  registerDebug('camera', {
    // QA angles own the camera and hold the turntable at yaw 0 (nose +z)
    view: (name: keyof typeof VIEWS) => {
      hangarCam.manual = true;
      Object.assign(turntable, { frozen: true, yaw: 0, pitch: 0, vel: 0 });
      setView(VIEWS[name]);
    },
    hangar: () => {
      hangarCam.manual = false;
      turntable.frozen = false;
    },
    turntable: (patch: Partial<typeof turntable>) => Object.assign(turntable, patch),
    turntableState: () => ({ yaw: turntable.yaw, pitch: turntable.pitch, zoom: turntable.zoom, zoomTarget: turntable.zoomTarget, vel: turntable.vel, enabled: turntable.enabled }),
  });
  registerDebug('flowState', { get: () => flow.state });
  registerDebug('thumbs', {
    // resolves to a data URL so the QA harness can save it
    make: async (id: ShipId, opts: ThumbOptions = {}) => {
      const blob = await (await fetch(await shipThumbnail(id, opts))).blob();
      return await new Promise<string>(res => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.readAsDataURL(blob);
      });
    },
  });
  const mode = startMode();
  if (mode === 'boot') return; // the boot timeline sets up its own initial state
  stage.world = 1;
  bootFx.opacity = 0;
  if (mode === 'doors') {
    setView(VIEWS.bootGate);
    bootDoors.set(0);
  } else {
    setView(VIEWS.hangar);
    bootDoors.set(1);
  }
  flow.force('hangar.idle');
}
