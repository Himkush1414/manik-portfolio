// Hangar UI actions shared by several components: pad selection (unlocked =
// also the flown ship), purchase, modals, START MISSION. UI reads stores;
// these are the only writes it makes.
import { useUi } from '../../../state/ui.store';
import { useProfile } from '../../../state/profile.store';
import { unlockState } from '../../../data/unlocks';
import { SHIPS, type ShipId } from '../../../data/ships';
import { sfx } from '../../../audio/sfx';
import { flow } from '../../../app/flow';
import { launch, registerStartMission } from '../../../app/choreo/launchTimeline';

/** The ship on the pad (may be locked). */
export function useViewedShip(): ShipId {
  const viewed = useUi(u => u.viewedShip);
  const selected = useProfile(p => p.selectedShip);
  return viewed ?? selected;
}

export function viewShip(id: ShipId): void {
  const ui = useUi.getState();
  const profile = useProfile.getState();
  if ((ui.viewedShip ?? profile.selectedShip) === id) return;
  ui.setViewedShip(id);
  if (unlockState(id, profile).unlocked) {
    profile.selectShip(id);
    sfx.play('confirm');
  } else sfx.play('locked');
}

export function purchaseViewed(id: ShipId): void {
  const profile = useProfile.getState();
  const res = profile.purchaseShip(id);
  const ui = useUi.getState();
  if (!res.ok) {
    sfx.play('deny');
    ui.toast(res.reason === 'insufficient-credits' ? 'Insufficient credits' : res.reason === 'locked-level' ? 'Clearance level not met' : 'Purchase unavailable', 'danger');
    return;
  }
  sfx.play('purchase');
  profile.selectShip(id);
  ui.toast(`${SHIPS[id].name} unlocked — ${res.cost.toLocaleString('en-US')} CR`, 'ok');
}

/** Upgrades / Settings modals: the FSM owns the transition (guards double opens). */
export function openModal(id: 'upgrades' | 'settings'): void {
  const ev = id === 'upgrades' ? 'OPEN_UPGRADES' : 'OPEN_SETTINGS';
  if (!flow.send(ev)) return;
  const ui = useUi.getState();
  ui.openModal(id);
  // Upgrades act on the flown ship: bring it to the pad
  if (id === 'upgrades') ui.setViewedShip(useProfile.getState().selectedShip);
}

export function closeModal(): void {
  if (!flow.send('CLOSE_MODAL')) return;
  useUi.getState().openModal(null);
}

/** START MISSION: bulkhead -> cockpit (app/choreo/launchTimeline.ts). */
export function startMission(): boolean {
  const ui = useUi.getState();
  const profile = useProfile.getState();
  const viewed = ui.viewedShip ?? profile.selectedShip;
  if (!unlockState(viewed, profile).unlocked) {
    sfx.play('deny');
    return false;
  }
  // the pad shows the flown ship: launch always flies the selected (unlocked) one
  ui.setViewedShip(profile.selectedShip);
  return launch();
}

registerStartMission(startMission);
