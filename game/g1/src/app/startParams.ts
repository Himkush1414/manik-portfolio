// Query-param entry points (QA harness + dev): ?boot=0 skips the boot
// sequence; ?screen=doors parks the camera on the bay doors (seekable via
// window.__G1__.doors). Idempotent.
import { QUERY } from '../core/constants';
import { flow } from './flow';
import { setView, VIEWS } from '../render/cameraDirector';
import { bootDoors } from '../scenes/sceneBridge';
import { registerDebug } from '../debug/debugApi';

let applied = false;

export function applyStartParams(): void {
  if (applied) return;
  applied = true;
  const screen = QUERY.get('screen');
  registerDebug('doors', {
    seek: (t: number, mode: 'open' | 'close' = 'open') => bootDoors.seek(t, mode),
    open: (d?: number) => bootDoors.open(d),
    close: (d?: number) => bootDoors.close(d),
    state: () => ({ progress: bootDoors.progress, state: bootDoors.state }),
    view: (name: keyof typeof VIEWS) => setView(VIEWS[name]),
  });
  if (screen === 'doors') {
    setView(VIEWS.bootGate);
    bootDoors.set(0);
    flow.force('hangar.idle');
    return;
  }
  // until the boot timeline lands, every entry lands in the hangar with the
  // bay doors open behind the camera
  setView(VIEWS.hangar);
  bootDoors.set(1);
  flow.force('hangar.idle');
}
