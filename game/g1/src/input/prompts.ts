// Tutorial prompts (Control / Camera / Boundary addendum): the text always comes
// from the player's REAL bindings and steering scheme, never hard-coded keys —
// "MOVE  W A S D / ↑ ← ↓ →", "AIM  MOUSE". Pure: unit-tested.
import { InputAction } from './actions';
import type { Bindings } from './bindings';
import { keyLabel } from './keyLabels';
import type { SteeringScheme } from '../state/schema';
import type { TutorialAction } from '../levels/types';

export type Prompt = { verb: string; keys: string };

const slot = (b: Bindings, a: InputAction, i: 0 | 1) => b[a][i];

/** the bound keys of up to 4 actions as one group per slot: "W A S D / ↑ ← ↓ →" (unbound slots skipped) */
function group(b: Bindings, acts: readonly InputAction[]): string {
  const out: string[] = [];
  for (const i of [0, 1] as const) {
    const codes = acts.map(a => slot(b, a, i));
    if (codes.every(c => !c)) continue;
    out.push(codes.map(c => (c ? keyLabel(c) : '—')).join(' '));
  }
  return out.join(' / ') || 'UNBOUND';
}

/** every bound key of one action: "SPACE / MOUSE 1" */
function keysOf(b: Bindings, a: InputAction): string {
  const k = [slot(b, a, 0), slot(b, a, 1)].filter((c): c is string => !!c).map(keyLabel);
  return k.length ? k.join(' / ') : 'UNBOUND';
}

const MOVE = [InputAction.MoveUp, InputAction.MoveLeft, InputAction.MoveDown, InputAction.MoveRight] as const;

export function tutorialPrompt(action: TutorialAction, b: Bindings, steering: SteeringScheme): Prompt {
  switch (action) {
    case 'move':
      return steering === 'keyboardMouse' ? { verb: 'STEER', keys: `MOUSE + ${group(b, MOVE)}` } : { verb: 'MOVE', keys: group(b, MOVE) };
    case 'aim':
      return { verb: 'AIM', keys: 'MOUSE' };
    case 'fire':
      return { verb: 'FIRE', keys: keysOf(b, InputAction.Fire) };
    case 'roll':
      return { verb: 'ROLL', keys: group(b, [InputAction.RollLeft, InputAction.RollRight]) };
    case 'boost':
      return { verb: 'BOOST', keys: keysOf(b, InputAction.Boost) };
  }
}
