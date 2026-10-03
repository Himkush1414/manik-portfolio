// The HUD's flight layer (Planet 1 §1.1 / Control-Camera-Boundary addendum), written per frame by
// MissionHudDriver through `hudDom`: altitude above the valley floor + ground clearance under the ship
// (10 Hz text; climbing is free — nothing warns about it), the close-call callout rising off the
// reticle, the skim / wall-run streak, and the tutorial prompt — its text built from the player's REAL
// bindings and steering scheme (input/prompts.ts), shown until the action is performed. Writes only
// when a value changed; no allocation per frame except the prompt text when the hint changes.
import { cockpitFx } from '../cockpit/displays';
import { mission } from './missionRuntime';
import { hudDom } from '../../ui/screens/mission/hudDom';
import { flightFeedback } from './flightFeedback';
import { FLIGHT_FX, HUD_FLIGHT } from '../../data/mission';
import { InputManager } from '../../input/InputManager';
import { useSettings } from '../../state/settings.store';
import { tutorialPrompt } from '../../input/prompts';
import { TutorialTracker, type TutorialPerformed } from '../../app/mission/tutorial';
import type { Sim } from '../../game/sim';
import type { TutorialHint } from '../../levels/types';

const tracker = new TutorialTracker();
const performed: TutorialPerformed = { move: false, aim: false, fire: false, roll: false, boost: false };
let trackedSim: Sim | null = null;
let lastTick = 0;
let shownHint: TutorialHint | null | undefined;
let shownKey = '';
const lastOp = { callout: -1, streak: -1 };
let lastStreak = '';
let lastAlt = '';
let lastClr = '';
let altT = 0;

function opacity(el: HTMLElement | null, k: keyof typeof lastOp, v: number): void {
  const q = Math.round(v * 50) / 50;
  if (!el || lastOp[k] === q) return;
  lastOp[k] = q;
  el.style.opacity = q.toFixed(2);
}

/** a fresh HUD mount: force every write */
export function hudFlightRemount(): void {
  for (const k in lastOp) lastOp[k as keyof typeof lastOp] = -1;
  lastStreak = shownKey = lastAlt = lastClr = '';
  shownHint = undefined;
}

/** rx / ry: the reticle in CSS px (the callout rises from it) */
export function hudFlight(sim: Sim, dt: number, rx: number, ry: number): void {
  const d = hudDom, p = sim.player, H = HUD_FLIGHT;
  // ---- altitude above the valley floor + ground clearance (10 Hz)
  altT -= dt;
  const world = mission.env;
  if (world && altT <= 0) {
    altT = 0.1;
    const wy = world.path.yAt(p.s) + p.y;
    const altV = wy - world.path.floorAt(p.s), clrV = Math.max(0, wy - world.groundY(p.s, p.x));
    cockpitFx.mission.alt = altV;
    cockpitFx.mission.clr = clrV;
    const alt = `${Math.round(altV)}`, clr = `${Math.round(clrV)}`;
    if (d.alt && alt !== lastAlt) d.alt.textContent = lastAlt = alt;
    if (d.clr && clr !== lastClr) d.clr.textContent = lastClr = clr;
  }
  // ---- close call: the score it paid, rising off the reticle
  const c = flightFeedback.callout / FLIGHT_FX.calloutLife;
  opacity(d.callout, 'callout', c > 0 ? Math.min(1, c * 2) : 0);
  if (c > 0 && d.callout) {
    d.callout.style.transform = `translate3d(${rx.toFixed(1)}px, ${(ry - (1 - c) * H.calloutRise).toFixed(1)}px, 0)`;
    const t = `CLOSE CALL +${flightFeedback.calloutValue}`;
    if (d.callout.textContent !== t) d.callout.textContent = t;
  }
  // ---- skim / wall-run streak
  const on = p.alive && p.skimT >= H.streakFrom;
  opacity(d.streak, 'streak', on ? 1 : 0);
  if (on && d.streak) {
    const t = `${p.streakWall ? 'WALL RUN' : 'SKIM'} ${Math.floor(p.skimT)}s`;
    if (t !== lastStreak) d.streak.textContent = lastStreak = t;
  }
  tutorial(sim);
}

function tutorial(sim: Sim): void {
  const d = hudDom;
  if (sim !== trackedSim || sim.tick < lastTick) {
    trackedSim = sim;
    tracker.reset(sim.level.tutorialHints);
  }
  lastTick = sim.tick;
  const p = sim.player, inp = mission.input, ist = InputManager.state;
  const st = useSettings.getState().controls;
  performed.move = inp.moveX !== 0 || inp.moveY !== 0 || (st.steering === 'keyboardMouse' && Math.abs(ist.cx) + Math.abs(ist.cy) > 0.05);
  performed.aim = Math.abs(ist.cx) + Math.abs(ist.cy) > 0.05;
  performed.fire = inp.fire;
  performed.roll = p.rollT >= 0;
  performed.boost = p.boosting;
  // bots and QA-forced input never get prompts
  const hint = mission.bot || mission.qaForce ? null : tracker.update(p.s, performed);
  const key = hint ? `${hint.action}|${st.steering}` : '';
  if (hint === shownHint && key === shownKey) return;
  shownHint = hint;
  shownKey = key;
  if (d.prompt) d.prompt.dataset.on = String(!!hint);
  if (!hint) return;
  const pr = tutorialPrompt(hint.action, st.bindings, st.steering);
  if (d.promptVerb) d.promptVerb.textContent = pr.verb;
  if (d.promptKeys) d.promptKeys.textContent = pr.keys;
}
