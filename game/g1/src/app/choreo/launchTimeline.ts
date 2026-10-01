// Cockpit entry (brief §15) and the return (ESC). One GSAP timeline per
// direction; the FSM guards double triggers (every step is a flow event).
//   START MISSION -> UI retracts (0.5 s) -> bulkhead SLAMS (1.0 s: steam, red
//   LEDs, big shake) -> sealed hold 0.6 s ("SEALING BAY / PRESSURE NOMINAL /
//   CANOPY LOCK") -> world swap while occluded -> doors open 1.4 s on the
//   cockpit -> systems boot ~1.5 s -> briefing on the combiner -> LET'S GO ->
//   camera select -> STANDBY. ESC: reverse door sequence, state intact.
import gsap from 'gsap';
import { flow, useFlow } from '../flow';
import { launchDoors, cockpitMount } from '../../scenes/sceneBridge';
import { bulkhead } from '../../scenes/cockpit/Bulkhead';
import { cockpitFx, BRIEFING_CHARS } from '../../scenes/cockpit/displays';
import { stage } from '../../scenes/Stage';
import { director, VIEWS, setView } from '../../render/cameraDirector';
import { postfx } from '../../render/fxController';
import { hangarCam } from '../../scenes/hangar/hangarCamera';
import { useSettings } from '../../state/settings.store';
import { useUi } from '../../state/ui.store';
import { sfx } from '../../audio/sfx';
import type { CameraMode } from '../../render/cameraRig';

let tl: gsap.core.Timeline | null = null;
const reduced = () => useSettings.getState().accessibility.reduceMotion;
const lines = (l: string[]) => useUi.getState().setLaunchLines(l);

/** Point the DOF at the bulkhead while it fills the view (it sits ~0.3 m out). */
function focusDoors(): void {
  const fwd = director.look.clone().sub(director.pos).normalize();
  director.focus.copy(director.pos).addScaledVector(fwd, bulkhead.dist + 0.05);
}

function powerDown(): void {
  const P = cockpitFx.power;
  P.dash = P.mfdL = P.mfdC = P.mfdR = P.hud = 0;
  cockpitFx.hudMode = 'off';
  cockpitFx.typed = 0;
}

export function launch(): boolean {
  if (!flow.send('START_MISSION')) return false;
  cockpitMount.want();
  tl?.kill();
  const R = reduced();
  useUi.getState().setCtaHover(false);
  sfx.play('confirm');
  // DoorController keeps ONE live tween: building the open tween up front
  // killed the close tween. Each door move is started at its beat instead.
  launchDoors.set(1);
  tl = gsap.timeline();
  // 0.0-0.5: the hangar UI retracts (HangarUI reacts to the flow state)
  tl.call(() => {
    bulkhead.active = true;
    focusDoors();
  }, [], 0.45);
  tl.to(postfx, { ao: 0, duration: 0.3 }, 0.4);
  tl.call(() => void launchDoors.close(1.0), [], 0.5);
  // slam (doorFeedback plays the clunk + base shake; this is the BIG one)
  tl.call(() => {
    postfx.pulse({ shake: R ? 0 : 0.9, ca: 0.012, vignette: 0.25, duration: 0.5 });
    sfx.play('hiss');
    lines(['SEALING BAY…']);
  }, [], 1.5);
  tl.call(() => lines(['SEALING BAY…', 'PRESSURE NOMINAL']), [], 1.72);
  tl.call(() => lines(['SEALING BAY…', 'PRESSURE NOMINAL', 'CANOPY LOCK']), [], 1.94);
  // swap while fully occluded (waits for the pre-warmed cockpit if needed)
  tl.addPause(2.05, () => {
    void cockpitMount.whenReady().then(() => {
      if (!flow.send('DOORS_CLOSED')) return;
      powerDown();
      stage.cockpit = 1;
      postfx.aoRadius = 0.12;
      postfx.dof = 0.1;
      tl?.resume();
    });
  });
  tl.call(() => focusDoors(), [], 2.1); // cockpit pose is set by <Cockpit/> this frame
  tl.call(() => void launchDoors.open(1.4), [], 2.15);
  tl.call(() => lines([]), [], 2.3);
  tl.to(postfx, { ao: 1, duration: 0.8 }, 2.8);
  tl.call(() => {
    bulkhead.active = false;
    cockpitFx.hudMode = 'boot';
  }, [], 3.55);
  // systems boot: dash lights, then MFDs and the HUD one by one (~1.5 s)
  const P = cockpitFx.power;
  tl.to(P, { dash: 1, duration: 0.35, ease: 'power2.out', onStart: () => sfx.play('loaderTick') }, 3.6);
  tl.to(P, { mfdL: 1, duration: 0.4, ease: 'steps(4)', onStart: () => sfx.play('loaderTick') }, 3.85);
  tl.to(P, { mfdC: 1, duration: 0.4, ease: 'steps(4)', onStart: () => sfx.play('loaderTick') }, 4.1);
  tl.to(P, { mfdR: 1, duration: 0.4, ease: 'steps(4)', onStart: () => sfx.play('loaderTick') }, 4.35);
  tl.to(P, { hud: 1, duration: 0.5, ease: 'power2.out', onStart: () => sfx.play('confirm') }, 4.6);
  tl.call(() => {
    if (!flow.send('REVEAL_DONE')) return;
    cockpitFx.hudMode = 'briefing';
    cockpitFx.typed = 0;
    gsap.to(cockpitFx, { typed: BRIEFING_CHARS, duration: R ? 0.01 : BRIEFING_CHARS / 95, ease: 'none', overwrite: 'auto' });
  }, [], 5.15);
  return true;
}

/** Skip the briefing typewriter (first press) or acknowledge it (LET'S GO). */
export function briefingAck(): void {
  if (useFlow.getState().state !== 'launch.briefing') return;
  if (cockpitFx.typed < BRIEFING_CHARS) {
    gsap.killTweensOf(cockpitFx);
    cockpitFx.typed = BRIEFING_CHARS;
    return;
  }
  if (!flow.send('BRIEFING_ACK')) return;
  sfx.play('confirm');
  cockpitFx.hudMode = 'select';
}

export function chooseCamera(mode: CameraMode): void {
  if (useFlow.getState().state !== 'launch.cameraSelect') return;
  useSettings.getState().setCameraMode(mode);
  if (!flow.send('CAMERA_CHOSEN')) return;
  sfx.play('purchase');
  cockpitFx.hudMode = 'standby';
}

/** ESC / HUD button: reverse door sequence back to the hangar, state intact. */
export function returnToHangar(): boolean {
  if (!flow.send('ABORT_TO_HANGAR')) return false;
  tl?.kill();
  gsap.killTweensOf(cockpitFx);
  sfx.play('deny');
  tl = gsap.timeline();
  const P = cockpitFx.power;
  tl.to(P, { hud: 0, mfdL: 0, mfdC: 0, mfdR: 0, duration: 0.25, ease: 'power2.in' }, 0);
  launchDoors.set(1);
  tl.call(() => {
    cockpitFx.hudMode = 'off';
    bulkhead.active = true;
    focusDoors();
  }, [], 0.2);
  tl.to(postfx, { ao: 0, duration: 0.25 }, 0.15);
  tl.call(() => void launchDoors.close(1.0), [], 0.25);
  tl.call(() => {
    postfx.pulse({ shake: reduced() ? 0 : 0.6, ca: 0.008, duration: 0.4 });
    lines(['CANOPY RELEASE', 'BAY 07 PRESSURISED']);
  }, [], 1.25);
  // swap back while sealed
  tl.call(() => {
    powerDown();
    stage.cockpit = 0;
    postfx.aoRadius = 1;
    postfx.dof = 1;
    hangarCam.push = 1;
    setView(VIEWS.hangar);
    focusDoors();
  }, [], 1.6);
  tl.call(() => void launchDoors.open(1.4), [], 1.75);
  tl.to(postfx, { ao: 1, duration: 0.6 }, 2.4);
  tl.call(() => lines([]), [], 1.9);
  tl.call(() => {
    bulkhead.active = false;
    director.focus.set(...VIEWS.hangar.focus);
    flow.send('RETURNED');
  }, [], 3.2);
  return true;
}

export type LaunchJump = 'briefing' | 'camera' | 'cockpit';

/** QA / deep-link entry (?screen=briefing|camera|cockpit): runs the REAL
 *  launch flow with GSAP's global clock sped up, then acknowledges the
 *  briefing / picks the saved camera mode as needed. Resolves at the target. */
export function jumpTo(target: LaunchJump, rate = 6): Promise<boolean> {
  if (!startMissionFn?.()) return Promise.resolve(false);
  gsap.globalTimeline.timeScale(rate);
  return new Promise(resolve => {
    const step = (s: string) => {
      if (s === 'launch.briefing') {
        if (target === 'briefing') return done(true);
        briefingAck(); // skip the typewriter
        briefingAck(); // LET'S GO
      } else if (s === 'launch.cameraSelect') {
        if (target === 'camera') return done(true);
        chooseCamera(useSettings.getState().camera.mode);
      } else if (s === 'launch.standby') done(true);
    };
    // flow.send notifies synchronously, mid-callback: act on the next frame
    const unsub = useFlow.subscribe(st => void requestAnimationFrame(() => step(st.state)));
    function done(ok: boolean) {
      unsub();
      gsap.globalTimeline.timeScale(1);
      resolve(ok);
    }
  });
}

// START MISSION goes through the hangar's guard (locked ship check); the
// hangar actions register it here to keep app/ free of ui/ imports.
let startMissionFn: (() => boolean) | null = null;
export function registerStartMission(fn: () => boolean): void {
  startMissionFn = fn;
}
