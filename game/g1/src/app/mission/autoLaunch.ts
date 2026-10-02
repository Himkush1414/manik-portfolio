// Production launch path (brief §14 / §17): the hangar's START MISSION runs
// the Phase 1 cockpit sequence (reveal -> briefing -> camera -> standby).
// Here: the mission prepares while the pilot reads the briefing (MISSION
// PREPARE), and STANDBY launches by itself after a beat — Esc / RETURN TO
// HANGAR during the beat cancels it (the flow has left standby). The QA
// entry (?level=) drives its own launch, so this stays out of its way.
import gsap from 'gsap';
import { useFlow } from '../flow';
import { enterMission, prewarmMission } from './missionFlow';
import { DEFAULT_LEVEL } from '../../levels/registry';
import { LAUNCH } from '../../data/mission';
import { QUERY } from '../../core/constants';

let installed = false;
let beat: gsap.core.Tween | null = null;
/** QA (__G1__.launch.holdStandby): keep STANDBY as a resting state (Phase 1 captures) */
export const autoLaunch = { hold: false };

export function installAutoLaunch(): void {
  if (installed || QUERY.has('level')) return;
  installed = true;
  let prev = useFlow.getState().state;
  useFlow.subscribe(({ state }) => {
    if (state === prev) return;
    prev = state;
    if (state === 'launch.briefing') prewarmMission(DEFAULT_LEVEL);
    if (state === 'launch.standby') {
      beat?.kill();
      beat = gsap.delayedCall(LAUNCH.standbyBeat, () => {
        beat = null;
        if (!autoLaunch.hold && useFlow.getState().state === 'launch.standby') void enterMission(DEFAULT_LEVEL);
      });
    } else if (beat) {
      beat.kill();
      beat = null;
    }
  });
}
