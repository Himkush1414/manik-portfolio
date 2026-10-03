// The HUD's flight layer (Control / Camera / Boundary addendum), written per
// frame by MissionHudDriver through `hudDom`: TURBULENCE under a canyon rim /
// the cloud deck (pulsing when severe), the deck's whiteout + lightning
// (never flashes under reduce-flashing), the close-call callout rising off the
// reticle, the skim / wall-run streak, and the tutorial prompt — its text built
// from the player's REAL bindings and steering scheme (input/prompts.ts), shown
// until the action is performed. Writes only when a value changed; no
// allocation per frame except the prompt text when the hint changes.
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
let flashT = 0;
const lastOp = { whiteout: -1, flash: -1, alert: -1, callout: -1, streak: -1 };
let lastAlert = '';
let lastPulse = false;
let lastStreak = '';

function opacity(el: HTMLElement | null, k: keyof typeof lastOp, v: number): void {
  const q = Math.round(v * 50) / 50;
  if (!el || lastOp[k] === q) return;
  lastOp[k] = q;
  el.style.opacity = q.toFixed(2);
}

/** a fresh HUD mount: force every write */
export function hudFlightRemount(): void {
  for (const k in lastOp) lastOp[k as keyof typeof lastOp] = -1;
  lastAlert = lastStreak = shownKey = '';
  lastPulse = false;
  shownHint = undefined;
}

/** rx / ry: the reticle in CSS px (the callout rises from it) */
export function hudFlight(sim: Sim, dt: number, rx: number, ry: number): void {
  const d = hudDom, p = sim.player, H = HUD_FLIGHT;
  const reduceFlash = useSettings.getState().accessibility.reduceFlashing;
  // ---- ceiling: TURBULENCE (rim or deck), the deck whiteout + lightning
  const turb = p.alive ? p.turb : 0;
  const deck = p.alive ? p.deck : 0;
  opacity(d.alert, 'alert', Math.min(1, Math.max(0, (turb - H.alertFrom) / H.alertRamp)));
  const text = deck > 0.05 ? 'CLOUD DECK — DESCEND' : 'TURBULENCE';
  if (d.alert && text !== lastAlert) d.alert.textContent = lastAlert = text;
  const pulse = turb > H.pulseAt;
  if (d.alert && pulse !== lastPulse) d.alert.dataset.pulse = String((lastPulse = pulse));
  opacity(d.whiteout, 'whiteout', deck * H.whiteout);
  flashT = Math.max(0, flashT - dt);
  if (!reduceFlash && deck > H.lightningFrom && Math.random() < H.lightningRate * deck * dt) flashT = H.lightningLife;
  opacity(d.flash, 'flash', reduceFlash ? 0 : flashT / H.lightningLife);
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
