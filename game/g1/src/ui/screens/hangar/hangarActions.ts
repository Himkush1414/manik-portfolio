// Hangar UI actions shared by several components: pad selection (unlocked =
// also the flown ship), purchase, modals, START MISSION. UI reads stores;
// these are the only writes it makes.
import { useUi } from '../../../state/ui.store';
import { useProfile } from '../../../state/profile.store';
import { unlockState } from '../../../data/unlocks';
import { SHIPS, type ShipId } from '../../../data/ships';
import { sfx } from '../../../audio/sfx';
import { flow } from '../../../app/flow';

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

/** Upgrades / Settings modals (the modals themselves land in 1F). */
export function openModal(id: 'upgrades' | 'settings'): void {
  if (flow.state !== 'hangar.idle') return;
  useUi.getState().toast(id === 'upgrades' ? 'Upgrades bay — online in the next build' : 'Settings — online in the next build', 'info');
}

/** START MISSION: the launch sequence (bulkhead, cockpit) lands in 1G. */
export function startMission(): boolean {
  const ui = useUi.getState();
  const profile = useProfile.getState();
  const viewed = ui.viewedShip ?? profile.selectedShip;
  if (!unlockState(viewed, profile).unlocked) {
    sfx.play('deny');
    return false;
  }
  sfx.play('confirm');
  ui.toast('Launch sequence arms in the next build — Sortie 001 standing by', 'info');
  return true;
}
