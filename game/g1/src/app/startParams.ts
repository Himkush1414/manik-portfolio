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
  registerDebug('flowState', { get: () => flow.state });
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
