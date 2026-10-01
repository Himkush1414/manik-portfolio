// Cockpit pre-warm in idle slices (brief §4 carry-over (a)). Phase 1 mounted
// <Cockpit/> ~2.5 s after the hangar settled and built everything inside that
// React commit (~60 ms task) and then compiled the subtree in one go (~45 ms).
// Now the heavy builders (cockpit interior + MFD canvases, launch tunnel) run
// here through core/slicer in <= 4 ms slices BEFORE the mount; <Cockpit/>
// claims the results, and its compile runs sliced too (render/compileSliced).
import { runSliced } from '../../core/slicer';
import { buildCockpitSteps, type BuiltCockpit } from './buildCockpit';
import { createDisplays, type Displays } from './displays';
import { buildLaunchTunnelSteps, type LaunchTunnelBundle } from './LaunchTunnel';
import type { CockpitVariant } from './cockpitSpec';
import { cockpitMount } from '../sceneBridge';
import { useProfile } from '../../state/profile.store';
import { SHIPS } from '../../data/ships';

type Prebuilt = { variant: CockpitVariant; displays: Displays; built: BuiltCockpit };

let cockpit: Prebuilt | null = null;
let tunnel: LaunchTunnelBundle | null = null;
let tunnelOwned = false;
const pending = new Map<CockpitVariant, Promise<void>>();

/** Build the cockpit for `variant` (and the launch tunnel, once) in idle slices. Idempotent. */
export function prebuildCockpit(variant: CockpitVariant): Promise<void> {
  if (cockpit?.variant === variant) return Promise.resolve();
  const running = pending.get(variant);
  if (running) return running;
  const job = runSliced(
    `cockpit:${variant}`,
    (function* () {
      if (!tunnel && !tunnelOwned) tunnel = yield* buildLaunchTunnelSteps();
      const displays = createDisplays();
      yield;
      const built = yield* buildCockpitSteps(variant, displays);
      // a newer prebuilt for another variant may exist: keep only the latest request
      if (cockpit && cockpit.variant !== variant) disposePrebuilt(cockpit);
      cockpit = { variant, displays, built };
    })(),
  ).finally(() => pending.delete(variant));
  pending.set(variant, job);
  return job;
}

/** The pre-built cockpit for `variant`, if ready (non-destructive: StrictMode replays memos). */
export function peekCockpit(variant: CockpitVariant): Prebuilt | null {
  return cockpit?.variant === variant ? cockpit : null;
}

/** <Cockpit/> took ownership (it disposes them on unmount). */
export function releaseCockpit(p: Prebuilt | null): void {
  if (p && cockpit === p) cockpit = null;
}

/** The pre-built launch tunnel, if ready (non-destructive, like peekCockpit). */
export function peekLaunchTunnel(): LaunchTunnelBundle | null {
  if (tunnel) tunnelOwned = true;
  return tunnel;
}

/** <LaunchTunnel/> unmounted and disposed it. */
export function releaseLaunchTunnel(b: LaunchTunnelBundle): void {
  if (tunnel === b) tunnel = null;
  tunnelOwned = false;
}

function disposePrebuilt(p: Prebuilt): void {
  p.built.dispose();
  p.displays.dispose();
}

/** Pre-warm entry (hangar idle, START MISSION): build sliced, then mount <Cockpit/>.
 *  A failed build still mounts (the cockpit then builds synchronously). */
export function warmCockpit(): Promise<void> {
  const variant = SHIPS[useProfile.getState().selectedShip].cockpit;
  return prebuildCockpit(variant).then(
    () => cockpitMount.want(),
    () => cockpitMount.want(),
  );
}
