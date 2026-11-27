// LIBRARY DEMO (?demo=eject). The portfolio's Games library (/games) plays this game in its fullscreen
// player as an early-build slice: from the start up to and including the catapult ejection out of the
// launch bay, and nothing after it. With the flag set:
//  - flow.ts refuses every state after mission.launching (no mission, pause, results, next level), so
//    later content is unreachable through the FSM, not just hidden;
//  - missionFlow.enterMission runs the real catapult launch but never cuts into the mission frame:
//    at the breach flash the view fades to black and the game tells the library (postMessage), which
//    shows its "To be continued" end card;
//  - the library can pause / resume the game while its rotate prompt is up.
// Without the flag (the standalone /game/g1/ route) nothing here runs and the game is unchanged.
// All unfinished code stays intact behind this flag.
import gsap from 'gsap';
import { AudioBus } from '../audio/AudioBus';
import { DEMO_END_AT_EJECT } from './demoFlag';

export { DEMO_END_AT_EJECT, DEMO_LOCKED_STATES } from './demoFlag';

/** seconds from the breach flash to black, before the end card */
export const DEMO_FADE = 1.1;

let ended = false;
let paused = false;

function post(type: 'end' | 'ready'): void {
  if (window.parent === window) return;
  window.parent.postMessage({ source: 'g1-demo', type }, location.origin);
}

function setPaused(on: boolean): void {
  if (on === paused) return;
  paused = on;
  if (on) {
    gsap.globalTimeline.pause();
    void AudioBus.ctx?.suspend().catch(() => undefined);
  } else if (!ended) {
    gsap.globalTimeline.resume();
    void AudioBus.ctx?.resume().catch(() => undefined);
  }
}

/** The slice is over (the ship has ejected): freeze, silence, tell the library. */
export function demoEnded(): void {
  if (ended) return;
  ended = true;
  gsap.globalTimeline.pause();
  void AudioBus.ctx?.suspend().catch(() => undefined);
  post('end');
}

/** Listens for the library player's pause / resume (same origin only). Idempotent. */
let installed = false;
export function installDemoBridge(): void {
  if (!DEMO_END_AT_EJECT || installed) return;
  installed = true;
  window.addEventListener('message', e => {
    if (e.origin !== location.origin || e.source !== window.parent) return;
    const d = e.data as { source?: string; cmd?: string } | null;
    if (d?.source !== 'gm-player') return;
    if (d.cmd === 'pause') setPaused(true);
    else if (d.cmd === 'resume') setPaused(false);
  });
  post('ready');
}
